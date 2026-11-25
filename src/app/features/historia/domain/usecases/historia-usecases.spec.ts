import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../../core/domain/app-error';
import { HistoriaRepository } from '../ports/historia.repository';
import {
  ChangeEntryState,
  CorrectVitals,
  CreateEntry,
  ReadHistory,
  RecordVitals,
} from './historia-usecases';

const TODAY = '2026-11-25';
const PATIENT = 'p1';

/** A repository whose every method is a spy: the use cases must refuse before any of them is called. */
function spyRepository() {
  return {
    listPatients: vi.fn(async () => []),
    readHistory: vi.fn(async () => ({ patientId: PATIENT, allergies: [], antecedents: [], medications: [], problems: [], vaccines: [], vitals: [] })),
    readEvents: vi.fn(),
    createEntry: vi.fn(async () => ({ id: 'e1' })),
    verifyEntry: vi.fn(),
    changeState: vi.fn(async () => ({ id: 'e1' })),
    recordVitals: vi.fn(async () => ({ id: 'v1' })),
    correctVitals: vi.fn(async () => ({ id: 'v2' })),
    searchCatalog: vi.fn(async () => []),
  };
}

const asPort = (spy: ReturnType<typeof spyRepository>) => spy as unknown as HistoriaRepository;

describe('history use cases', () => {
  it('refuses a reversed date range before asking the API', async () => {
    const repo = spyRepository();
    const read = new ReadHistory(asPort(repo), () => TODAY);
    await expect(read.execute(PATIENT, { from: '2026-02-01', to: '2026-01-01' })).rejects.toBeInstanceOf(AppError);
    expect(repo.readHistory).not.toHaveBeenCalled();
  });

  it('reads the history when the range is valid', async () => {
    const repo = spyRepository();
    await new ReadHistory(asPort(repo), () => TODAY).execute(PATIENT, { from: '2026-01-01', to: '2026-06-30' });
    expect(repo.readHistory).toHaveBeenCalledWith(PATIENT, { from: '2026-01-01', to: '2026-06-30' });
  });

  it('refuses an allergy with no catalog code and never creates it', async () => {
    const repo = spyRepository();
    const create = new CreateEntry(asPort(repo), () => TODAY);
    await expect(create.execute(PATIENT, { kind: 'allergy', substanceCode: '', severity: 'GRAVE', reaction: null }))
      .rejects.toMatchObject({ kind: 'validation' });
    expect(repo.createEntry).not.toHaveBeenCalled();
  });

  it('refuses a vaccine dated in the future', async () => {
    const repo = spyRepository();
    const create = new CreateEntry(asPort(repo), () => TODAY);
    await expect(create.execute(PATIENT, {
      kind: 'vaccine', vaccineCode: 'INFLUENZA', doseNumber: 1, date: '2026-12-01', lot: null,
    })).rejects.toMatchObject({ kind: 'validation' });
    expect(repo.createEntry).not.toHaveBeenCalled();
  });

  it('refuses a state change with no motivo', async () => {
    const repo = spyRepository();
    await expect(new ChangeEntryState(asPort(repo)).execute(PATIENT, 'allergy', 'e1', {
      expected: 'ACTIVA', target: 'RESUELTA', reason: '   ',
    })).rejects.toMatchObject({ kind: 'validation' });
    expect(repo.changeState).not.toHaveBeenCalled();
  });

  it('refuses empty vital signs and a correction with no motivo', async () => {
    const repo = spyRepository();
    const empty = { weightKg: null, heightCm: null, systolic: null, diastolic: null, heartRate: null, temperatureC: null, oxygen: null };
    await expect(new RecordVitals(asPort(repo)).execute('c1', empty)).rejects.toMatchObject({ kind: 'validation' });
    await expect(new CorrectVitals(asPort(repo)).execute('v1', { ...empty, weightKg: 70 }, ''))
      .rejects.toMatchObject({ kind: 'validation' });
    expect(repo.recordVitals).not.toHaveBeenCalled();
    expect(repo.correctVitals).not.toHaveBeenCalled();
  });
});
