import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionState } from '../../auth/presentation/session.state';
import { DraftsState } from './drafts.state';
import { KnowledgeLayout } from './knowledge.layout';

const ADMIN = ['conocimiento.leer', 'conocimiento.administrar'];
const DOCTOR = ['conocimiento.leer', 'conocimiento.validar'];
const LAB = ['conocimiento.leer'];

function tabs(permissions: string[]): string[] {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DraftsState, useValue: { drafts: () => [] } },
      { provide: SessionState, useValue: { can: (permission: string) => permissions.includes(permission) } },
    ],
  });
  const fixture = TestBed.createComponent(KnowledgeLayout);
  fixture.detectChanges();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map((a) => a.textContent!.trim());
}

describe('KnowledgeLayout tabs', () => {
  it('offers the rules only to the administrator', () => {
    expect(tabs(ADMIN)).toContain('Reglas');
    expect(tabs(DOCTOR)).not.toContain('Reglas');
    expect(tabs(LAB)).not.toContain('Reglas');
  });

  it('offers the review and the drafts only to whoever can validate or administer', () => {
    for (const role of [DOCTOR, ADMIN]) {
      expect(tabs(role)).toContain('Revisión');
      expect(tabs(role)).toContain('Borradores');
    }
    expect(tabs(LAB)).not.toContain('Revisión');
    expect(tabs(LAB)).not.toContain('Borradores');
  });

  it('leaves a read-only role (the lab technician) with just the analytes', () => {
    expect(tabs(LAB)).toEqual(['Analitos']);
  });
});
