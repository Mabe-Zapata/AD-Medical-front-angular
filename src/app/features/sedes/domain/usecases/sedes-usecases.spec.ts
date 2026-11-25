import { describe, expect, it } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import { NewSede, OfficeChanges, Sede, SedeChanges } from '../entities/sedes';
import { SedesRepository } from '../ports/sedes.repository';
import { AddOffice, CreateSedeWithOffices, UpdateOffice, UpdateSede } from './sedes-usecases';

/** In-memory repository. `failOn` makes a call throw, to test partial saves. */
class FakeRepository extends SedesRepository {
  readonly created: NewSede[] = [];
  readonly offices: { sedeId: string; name: string }[] = [];
  readonly updates: { id: string; changes: SedeChanges | OfficeChanges }[] = [];
  failOn: (call: string, arg: string) => boolean = () => false;
  private seq = 0;

  async listSedes(): Promise<Sede[]> {
    return [];
  }

  async createSede(sede: NewSede): Promise<string> {
    if (this.failOn('createSede', sede.name)) throw new AppError('unavailable', 'down');
    this.created.push(sede);
    return `sede-${++this.seq}`;
  }

  async updateSede(sedeId: string, changes: SedeChanges): Promise<void> {
    this.updates.push({ id: sedeId, changes });
  }

  async createOffice(sedeId: string, name: string): Promise<string> {
    if (this.failOn('createOffice', name)) {
      throw new AppError('conflict', 'duplicate', undefined, 409, 'CONSULTORIO_DUPLICADO');
    }
    this.offices.push({ sedeId, name });
    return `office-${++this.seq}`;
  }

  async updateOffice(officeId: string, changes: OfficeChanges): Promise<void> {
    this.updates.push({ id: officeId, changes });
  }
}

describe('CreateSedeWithOffices', () => {
  it('creates the sede and every consultorio, trimming values and dropping duplicates', async () => {
    const repo = new FakeRepository();
    const result = await new CreateSedeWithOffices(repo).execute({
      name: '  Sede Norte ',
      address: ' Av. 1 ',
      offices: ['Consultorio 1', 'consultorio 1', '  ', 'Consultorio 2'],
    });

    expect(repo.created).toEqual([{ name: 'Sede Norte', address: 'Av. 1' }]);
    expect(repo.offices.map((o) => o.name)).toEqual(['Consultorio 1', 'Consultorio 2']);
    expect(result.failedOffices).toEqual([]);
  });

  it('stores an empty address as null', async () => {
    const repo = new FakeRepository();
    await new CreateSedeWithOffices(repo).execute({ name: 'Sede', address: '  ', offices: [] });
    expect(repo.created[0].address).toBeNull();
  });

  it('keeps the sede when some consultorios fail, and reports only those names', async () => {
    const repo = new FakeRepository();
    repo.failOn = (call, arg) => call === 'createOffice' && arg === 'Consultorio 2';
    const result = await new CreateSedeWithOffices(repo).execute({
      name: 'Sede',
      address: '',
      offices: ['Consultorio 1', 'Consultorio 2', 'Consultorio 3'],
    });

    expect(result.sedeId).toBeTruthy();
    expect(result.failedOffices).toEqual(['Consultorio 2']);
    expect(repo.offices.map((o) => o.name)).toEqual(['Consultorio 1', 'Consultorio 3']);
  });

  it('creates no consultorio when the sede itself fails', async () => {
    const repo = new FakeRepository();
    repo.failOn = (call) => call === 'createSede';
    await expect(
      new CreateSedeWithOffices(repo).execute({ name: 'Sede', address: '', offices: ['C1'] }),
    ).rejects.toThrow();
    expect(repo.offices).toEqual([]);
  });

  it('refuses an invalid draft before calling the API', async () => {
    const repo = new FakeRepository();
    await expect(
      new CreateSedeWithOffices(repo).execute({ name: '   ', address: 'x'.repeat(301), offices: [] }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(repo.created).toEqual([]);
  });
});

describe('UpdateSede', () => {
  it('sends only the fields that are present, with the address trimmed', async () => {
    const repo = new FakeRepository();
    await new UpdateSede(repo).execute('s1', { address: '  Av. 2 ' });
    expect(repo.updates).toEqual([{ id: 's1', changes: { address: 'Av. 2' } }]);
  });

  it('sends a null address as a clear, and an explicit active flag as is', async () => {
    const repo = new FakeRepository();
    await new UpdateSede(repo).execute('s1', { address: null, active: false });
    expect(repo.updates[0].changes).toEqual({ address: null, active: false });
  });

  it('refuses an empty name before calling the API', async () => {
    const repo = new FakeRepository();
    await expect(new UpdateSede(repo).execute('s1', { name: '  ' })).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(repo.updates).toEqual([]);
  });
});

describe('office use cases', () => {
  it('AddOffice refuses an over-long name and trims a valid one', async () => {
    const repo = new FakeRepository();
    await expect(new AddOffice(repo).execute('s1', 'x'.repeat(81))).rejects.toMatchObject({
      kind: 'validation',
    });
    await new AddOffice(repo).execute('s1', ' Consultorio 9 ');
    expect(repo.offices).toEqual([{ sedeId: 's1', name: 'Consultorio 9' }]);
  });

  it('UpdateOffice sends only the change asked for', async () => {
    const repo = new FakeRepository();
    await new UpdateOffice(repo).execute('o1', { active: true });
    expect(repo.updates).toEqual([{ id: 'o1', changes: { active: true } }]);
  });
});
