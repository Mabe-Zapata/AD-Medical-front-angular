import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionState } from '../../auth/presentation/session.state';
import { GetKnowledgeSummary, ListAnalytes } from '../../knowledge/domain/usecases/knowledge-usecases';
import { ListOrders } from '../../orders/domain/usecases/orders-usecases';
import { ListUsers } from '../../users/domain/usecases/users-usecases';
import { HomePage } from './home.page';

const ADMIN = [
  'conocimiento.leer',
  'conocimiento.administrar',
  'conocimiento.validar',
  'usuarios.administrar',
];
const LAB = ['conocimiento.leer', 'resultados.registrar'];

const users = [
  { id: 'u1', email: 'admin@lab.test', firstName: 'Ana', lastName: 'Admin', active: true, roles: ['ADMINISTRADOR'] },
  { id: 'u2', email: 'medico@lab.test', firstName: 'Mario', lastName: 'Medico', active: true, roles: ['MEDICO'] },
  { id: 'u3', email: 'nuevo@lab.test', firstName: 'Nora', lastName: 'Nueva', active: false, roles: ['PACIENTE'] },
];

const summary = {
  analytes: 24,
  referencesValidated: 52,
  referencesDraft: 6,
  rulesValidated: 14,
  rulesDraft: 3,
};

function render(permissions: string[], calls: string[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ListUsers, useValue: { execute: async () => users } },
      {
        provide: GetKnowledgeSummary,
        useValue: { execute: async () => (calls.push('summary'), summary) },
      },
      { provide: ListAnalytes, useValue: { execute: async () => (calls.push('analytes'), [{}, {}]) } },
      { provide: ListOrders, useValue: { execute: async () => [] } },
      {
        provide: SessionState,
        useValue: {
          user: () => ({ id: 'u1', email: 'admin@lab.test', roles: ['ADMINISTRADOR'] }),
          session: () => ({ expiresAt: Date.now() + 11 * 60_000 + 42_000 }),
          can: (permission: string) => permissions.includes(permission),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

async function settled(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('HomePage', () => {
  it('tells the administrator what needs attention: unactivated accounts and drafts to validate', async () => {
    const { fixture, el } = render(ADMIN);
    await settled(fixture);

    const text = el.textContent!;
    expect(text).toContain('1 cuenta todavía sin activar');
    expect(text).toContain('6 referencias en borrador');
    expect(text).toContain('3 reglas en borrador');
  });

  it('shows the key figures, with "Por validar" adding the draft ranges and rules', async () => {
    const { fixture, el } = render(ADMIN);
    await settled(fixture);

    const kpi = (label: string) =>
      [...el.querySelectorAll('.kpi')].find((k) => k.textContent!.includes(label))!.textContent!;
    expect(kpi('Cuentas activas')).toContain('2');
    expect(kpi('Cuentas activas')).toContain('de 3 cuentas');
    expect(kpi('Por validar')).toContain('9');
    expect(kpi('Analitos activos')).toContain('24');
  });

  it('lists only the unactivated accounts in the table', async () => {
    const { fixture, el } = render(ADMIN);
    await settled(fixture);

    const rows = [...el.querySelectorAll('tbody tr')].map((row) => row.textContent!);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('nuevo@lab.test');
    expect(rows[0]).toContain('Sin activar');
  });

  it('opens the creation forms from the shortcuts (they land with the form open)', async () => {
    const { fixture, el } = render(ADMIN);
    await settled(fixture);

    const hrefs = [...el.querySelectorAll<HTMLAnchorElement>('.actions a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/usuarios?nuevo=1', '/conocimiento/analitos?nuevo=1']);
  });

  it('shows a countdown of the session that is left', async () => {
    const { el } = render(ADMIN);

    expect(el.querySelector('.session')!.textContent).toMatch(/Te quedan\s+11:\d\d de esta sesión/);
  });

  it('a role that cannot administer sees no admin blocks and no shortcuts, and asks for fewer things', async () => {
    const calls: string[] = [];
    const { fixture, el } = render(LAB, calls);
    await settled(fixture);

    expect(el.querySelector('.actions')).toBeNull();
    expect(el.textContent).not.toContain('Pendientes de hoy');
    expect(el.textContent).not.toContain('Cuentas sin activar');
    // Without the validate or administer permission only the analytes count is asked for.
    expect(calls).toEqual(['analytes']);
  });
});
