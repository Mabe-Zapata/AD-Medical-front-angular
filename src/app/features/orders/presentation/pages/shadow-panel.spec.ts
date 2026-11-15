import { TestBed } from '@angular/core/testing';

import { AppError } from '../../../../core/domain/app-error';
import { ShadowReport, ShadowSnapshot } from '../../domain/entities/shadow';
import {
  EditShadowFinding,
  GetShadowReport,
  ListShadowEdits,
  RecordShadowSnapshot,
} from '../../domain/usecases/shadow-usecases';
import { ShadowPanelComponent } from './shadow-panel';

const ORDER_ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const SNAPSHOT_ID = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';

const report: ShadowReport = {
  findings: [
    {
      key: 'ANEMIA',
      category: 'ANEMIA_LEVE',
      cutoff: { value: 120, unit: 'g/L' },
      reason: null,
      source: null,
      notice: null,
    },
    {
      key: 'HIERRO',
      category: 'NO_EVALUABLE',
      cutoff: null,
      reason: 'falta ferritina',
      source: null,
      notice: null,
    },
  ],
};

const snapshot: ShadowSnapshot = {
  id: SNAPSHOT_ID,
  ruleVersion: 'sombra-hallazgos-2',
  createdAt: '2026-11-14T15:00:00+00:00',
  items: [
    {
      finding: 'ANEMIA',
      category: 'ANEMIA_LEVE',
      cutoff: { value: 120, unit: 'g/L' },
      source: 'WHO 2024',
      reason: null,
      evidence: [{ role: 'hemoglobina', resultId: 'r1', value: 11.2, unit: 'g/dL' }],
    },
  ],
};

/** Plain stubs (not vi.fn): vitest flags the rejected promises of mocks as unhandled. */
interface Stubs {
  reportFails: AppError | null;
  editFails: AppError | null;
  history: unknown[];
  calls: Record<string, unknown[][]>;
}

type Fixture = { whenStable(): Promise<unknown>; detectChanges(): void };

function setup(stubs: Partial<Stubs> = {}, canRecord = true) {
  const state: Stubs = { reportFails: null, editFails: null, history: [], calls: {}, ...stubs };
  const record = (name: string, ...args: unknown[]) => (state.calls[name] ??= []).push(args);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: GetShadowReport,
        useValue: {
          execute: async () => {
            if (state.reportFails) throw state.reportFails;
            return report;
          },
        },
      },
      { provide: RecordShadowSnapshot, useValue: { execute: async () => snapshot } },
      {
        provide: EditShadowFinding,
        useValue: {
          execute: async (...args: unknown[]) => {
            if (state.editFails) throw state.editFails;
            record('edit', ...args);
            return 'ANEMIA_GRAVE';
          },
        },
      },
      { provide: ListShadowEdits, useValue: { execute: async () => state.history } },
    ],
  });
  const fixture = TestBed.createComponent(ShadowPanelComponent);
  fixture.componentRef.setInput('orderId', ORDER_ID);
  fixture.componentRef.setInput('canRecord', canRecord);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, state };
}

async function settle(fixture: Fixture) {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** The modal is rendered by the same component, inside the fixture's element. */
async function press(fixture: Fixture, el: HTMLElement, text: string) {
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!.click();
  await settle(fixture);
}

function type(el: HTMLElement, selector: string, value: string, event = 'input') {
  const field = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(event));
}

const labelsOf = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());

describe('ShadowPanelComponent', () => {
  it('shows nothing until the doctor asks, and says it only informs', () => {
    const { el } = setup();
    expect(el.textContent).toContain('no modifica la orden');
    expect(el.textContent).toContain('Consultar hallazgos');
    expect(el.textContent).not.toContain('Anemia leve');
  });

  it('reads the findings and shows them in Spanish, with the reason when one cannot be evaluated', async () => {
    const { fixture, el } = setup();
    await press(fixture, el, 'Consultar hallazgos');

    expect(el.textContent).toContain('Anemia leve');
    expect(el.textContent).toContain('120 g/L');
    expect(el.textContent).toContain('No evaluable');
    expect(el.textContent).toContain('falta ferritina');
  });

  it('only the ordering doctor is offered the snapshot', () => {
    expect(labelsOf(setup({}, true).el)).toContain('Guardar instantánea');
    TestBed.resetTestingModule();
    expect(labelsOf(setup({}, false).el)).not.toContain('Guardar instantánea');
  });

  it('explains a 409 on the read in plain Spanish', async () => {
    const { fixture, el } = setup({ reportFails: new AppError('conflict', 'x', 'c-1', 409) });
    await press(fixture, el, 'Consultar hallazgos');
    expect(el.textContent).toContain('No se pueden interpretar los resultados');
  });

  it('a snapshot shows its evidence and offers to act on each finding', async () => {
    const { fixture, el } = setup();
    await press(fixture, el, 'Guardar instantánea');

    expect(el.textContent).toContain('Instantánea guardada');
    expect(el.textContent).toContain('Hemoglobina 11.2 g/dL');
    expect(labelsOf(el)).toContain('Registrar acción');
  });

  it('refuses an action without a reason and sends nothing', async () => {
    const { fixture, el, state } = setup();
    await press(fixture, el, 'Guardar instantánea');
    await press(fixture, el, 'Registrar acción');
    // The form inside the modal has its own submit button with the same label.
    const submit = [...el.querySelectorAll<HTMLButtonElement>('form button[type="submit"]')][0];
    submit.click();
    await settle(fixture);

    expect(el.textContent).toContain('Escribe el motivo');
    expect(state.calls['edit']).toBeUndefined();
  });

  it('a modification sends the new category and the reason, then shows the history', async () => {
    const history = [
      {
        id: 'e1',
        action: 'MODIFICAR',
        previousCategory: 'ANEMIA_LEVE',
        newCategory: 'ANEMIA_GRAVE',
        reason: 'Clínica compatible.',
        createdAt: '2026-11-14T15:05:00+00:00',
      },
    ];
    const { fixture, el, state } = setup({ history });
    await press(fixture, el, 'Guardar instantánea');
    await press(fixture, el, 'Registrar acción');

    // Options come in the order CONFIRMAR, DESCARTAR, MODIFICAR; the radio value lives in Angular, not the DOM.
    el.querySelectorAll<HTMLInputElement>('input[type=radio]')[2].click();
    await settle(fixture);
    type(el, '#shadow-category', 'ANEMIA_GRAVE', 'change');
    type(el, '#shadow-reason', 'Clínica compatible.');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    await settle(fixture);

    expect(state.calls['edit']).toEqual([
      [
        ORDER_ID,
        SNAPSHOT_ID,
        'ANEMIA',
        'ANEMIA_LEVE',
        { action: 'MODIFICAR', newCategory: 'ANEMIA_GRAVE', reason: 'Clínica compatible.' },
      ],
    ]);
    expect(el.textContent).toContain('Acción registrada');
    expect(el.textContent).toContain('Anemia leve → Anemia grave');
    expect(el.textContent).toContain('Motivo: Clínica compatible.');
  });

  it('explains a 403 on an edit and keeps the form open', async () => {
    const { fixture, el } = setup({ editFails: new AppError('forbidden', 'x', 'c-1', 403) });
    await press(fixture, el, 'Guardar instantánea');
    await press(fixture, el, 'Registrar acción');

    type(el, '#shadow-reason', 'Ok.');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('Solo el médico que ordenó puede registrar esta acción');
    expect(el.querySelector('#shadow-reason')).not.toBeNull();
  });
});
