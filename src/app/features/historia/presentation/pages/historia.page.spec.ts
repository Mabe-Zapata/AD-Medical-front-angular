import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClinicalHistory, HistoryEntry } from '../../domain/entities/historia';
import {
  ChangeEntryState,
  CorrectVitals,
  CreateEntry,
  ListHistoryPatients,
  ReadEvents,
  ReadHistory,
  RecordVitals,
  SearchCatalog,
  VerifyEntry,
} from '../../domain/usecases/historia-usecases';
import { HistoriaPageComponent } from './historia.page';

const PATIENT = { id: 'p1', name: 'Ana Pérez' };

const ALLERGY: HistoryEntry = {
  id: 'a1',
  state: 'ACTIVA',
  origin: 'PATIENT',
  verified: false,
  verifiedAt: null,
  recordedAt: '2026-11-20T10:00:00Z',
  details: {
    kind: 'allergy',
    substanceCode: 'PENICILINA',
    substance: 'Penicilina',
    category: 'MEDICAMENTO',
    severity: 'GRAVE',
    reaction: 'Urticaria',
  },
};

const HISTORY: ClinicalHistory = {
  patientId: 'p1',
  allergies: [ALLERGY],
  antecedents: [],
  medications: [],
  problems: [],
  vaccines: [],
  vitals: [],
};

function render() {
  const fixture = TestBed.createComponent(HistoriaPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('HistoriaPageComponent', () => {
  let listPatients: ReturnType<typeof vi.fn>;
  let readHistory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listPatients = vi.fn(async () => [PATIENT]);
    readHistory = vi.fn(async () => HISTORY);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ListHistoryPatients, useValue: { execute: listPatients } },
        { provide: ReadHistory, useValue: { execute: readHistory } },
        { provide: ReadEvents, useValue: { execute: vi.fn(async () => ({ items: [], total: 0, limit: 5, offset: 0, includesActor: true })) } },
        { provide: CreateEntry, useValue: { execute: vi.fn() } },
        { provide: VerifyEntry, useValue: { execute: vi.fn() } },
        { provide: ChangeEntryState, useValue: { execute: vi.fn() } },
        { provide: RecordVitals, useValue: { execute: vi.fn() } },
        { provide: CorrectVitals, useValue: { execute: vi.fn() } },
        { provide: SearchCatalog, useValue: { execute: vi.fn(async () => []) } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('asks for a patient first and lists only the patients the doctor treats', async () => {
    const fixture = render();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Elige un paciente para ver su historia');
    expect(el.querySelector('select[name="patient"]')?.textContent).toContain('Ana Pérez');
    expect(readHistory).not.toHaveBeenCalled();
  });

  it('loads the history when a patient is chosen and shows the allergy', async () => {
    const fixture = render();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as { choosePatient(id: string): void };
    component.choosePatient('p1');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(readHistory).toHaveBeenCalledWith('p1', { from: null, to: null });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Penicilina');
  });

  it('refuses a reversed date range on screen and does not ask the API', async () => {
    const fixture = render();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      choosePatient(id: string): void;
      setRange(side: 'from' | 'to', text: string): void;
    };
    component.choosePatient('p1');
    await fixture.whenStable();
    component.setRange('from', '2026-11-20');
    component.setRange('to', '2026-11-01');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('La fecha final no puede ser anterior');
    const reversed = readHistory.mock.calls.some(([, range]) => range.from && range.to && range.to < range.from);
    expect(reversed).toBe(false);
  });

  it('opens the registration form for the active section', async () => {
    const fixture = render();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as { choosePatient(id: string): void; openCreate(kind: 'allergy'): void };
    component.choosePatient('p1');
    await fixture.whenStable();
    component.openCreate('allergy');
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role=dialog]');
    expect(dialog?.getAttribute('aria-label')).toContain('Nueva alergia');
    expect(dialog?.querySelector('select[name="substance"]')).not.toBeNull();
  });
});
