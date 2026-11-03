import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../../../auth/presentation/session.state';
import { Analyte } from '../../domain/entities/knowledge';
import {
  CreateAnalyte,
  ListAnalytes,
  ValidateReference,
  ValidateRule,
} from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';
import { AnalytesPage } from './analytes.page';
import { DraftsPage } from './drafts.page';

const analytes: Analyte[] = [
  { id: 'a1', name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO' },
  { id: 'a2', name: 'Glucosa', unit: 'mg/dL', valueType: 'NUMERICO' },
];

function permissions(...granted: string[]) {
  return {
    provide: SessionState,
    useValue: { can: (p: string) => granted.includes(p), isSignedIn: () => true },
  };
}

describe('AnalytesPage', () => {
  const create = { execute: vi.fn() };

  function setup(...granted: string[]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        permissions(...granted),
        { provide: ListAnalytes, useValue: { execute: async () => analytes } },
        { provide: CreateAnalyte, useValue: create },
      ],
    });
    const fixture = TestBed.createComponent(AnalytesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists the analytes for a reader and hides the creation form', async () => {
    const { fixture, el } = setup('conocimiento.leer');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Hemoglobina');
    expect(el.textContent).toContain('Glucosa');
    expect(el.querySelector('app-analyte-form')).toBeNull();
  });

  it('shows the creation form to an administrator and creates an analyte', async () => {
    create.execute.mockResolvedValue('new-id');
    const { fixture, el } = setup('conocimiento.leer', 'conocimiento.administrar');
    await fixture.whenStable();
    fixture.detectChanges();

    const name = el.querySelector<HTMLInputElement>('#analyte-name')!;
    name.value = 'Creatinina';
    name.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('app-analyte-form button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(create.execute).toHaveBeenCalledWith({
      name: 'Creatinina',
      unit: null,
      valueType: 'NUMERICO',
    });
    expect(el.textContent).toContain('Analito «Creatinina» creado.');
  });
});

describe('DraftsPage', () => {
  const validateReference = { execute: vi.fn() };
  const validateRule = { execute: vi.fn() };

  function setup(...granted: string[]) {
    TestBed.configureTestingModule({
      providers: [
        permissions(...granted),
        { provide: ValidateReference, useValue: validateReference },
        { provide: ValidateRule, useValue: validateRule },
      ],
    });
    TestBed.inject(DraftsState).add({
      kind: 'reference',
      id: 'r1',
      label: 'Hb · 12 – 16 g/dL',
      state: 'BORRADOR',
    });
    const fixture = TestBed.createComponent(DraftsPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    validateReference.execute.mockReset();
    validateRule.execute.mockReset();
  });

  it('lets a doctor validate a draft', async () => {
    validateReference.execute.mockResolvedValue(undefined);
    const { fixture, el } = setup('conocimiento.validar');

    el.querySelector<HTMLButtonElement>('tbody button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(validateReference.execute).toHaveBeenCalledWith('r1');
    expect(el.textContent).toContain('Referencia validada');
    expect(el.querySelector('tbody button')).toBeNull();
  });

  it('hides the validate buttons from someone without the validate permission', () => {
    const { el } = setup('conocimiento.leer');
    expect(el.querySelector('tbody button')).toBeNull();
    expect(el.textContent).toContain('Solo los médicos pueden validar');
  });

  it('explains an overlap conflict in Spanish', async () => {
    validateReference.execute.mockRejectedValue(new AppError('conflict', 'overlaps', 'c-7'));
    const { fixture, el } = setup('conocimiento.validar');

    el.querySelector<HTMLButtonElement>('tbody button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('se solapa con una referencia ya validada');
    expect(el.textContent).toContain('c-7');
  });
});
