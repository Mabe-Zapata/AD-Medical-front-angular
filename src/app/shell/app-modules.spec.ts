import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionState } from '../features/auth/presentation/session.state';
import { ListUsers } from '../features/users/domain/usecases/users-usecases';
import { visibleModules } from './app-modules';
import { StaffShell } from './staff-shell';

// Permissions each staff role receives from the backend seed (identity and knowledge migrations).
const DOCTOR = [
  'conocimiento.leer',
  'conocimiento.validar',
  'ordenes.crear',
  'resultados.leer_con_acceso',
  'revisiones.registrar',
];
const LAB = ['conocimiento.leer', 'resultados.registrar'];
const ADMIN = ['conocimiento.leer', 'conocimiento.administrar', 'usuarios.administrar'];

const titles = (permissions: string[]) =>
  visibleModules((p) => permissions.includes(p)).map((m) => m.title);

describe('visibleModules', () => {
  it('shows the user administration only to whoever can administer users', () => {
    expect(titles(ADMIN)).toContain('Usuarios y roles');
    expect(titles(DOCTOR)).not.toContain('Usuarios y roles');
    expect(titles(LAB)).not.toContain('Usuarios y roles');
  });

  it('shows orders and results to doctors and lab staff but not to administrators', () => {
    expect(titles(DOCTOR)).toContain('Órdenes y resultados');
    expect(titles(LAB)).toContain('Órdenes y resultados');
    expect(titles(ADMIN)).not.toContain('Órdenes y resultados');
  });

  it('shows nothing to someone without permissions', () => {
    expect(titles([])).toEqual([]);
  });
});

describe('StaffShell', () => {
  const signedOut: string[] = [];

  function render(permissions: string[], users: unknown[] = []) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ListUsers, useValue: { execute: async () => users } },
        {
          provide: SessionState,
          useValue: {
            user: () => ({ id: 'u1', email: 'admin1@synthetic.test', roles: ['ADMINISTRADOR'] }),
            isSignedIn: () => true,
            endReason: () => null,
            can: (p: string) => permissions.includes(p),
            signOut: (reason: string) => signedOut.push(reason),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(StaffShell);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('has no navigation bar: only the logo and the account avatar', () => {
    const { el } = render(DOCTOR);

    expect(el.querySelector('nav')).toBeNull();
    expect(el.querySelector('.avatar')!.textContent!.trim()).toBe('AD');
  });

  it('keeps sign-out inside the avatar menu', () => {
    const { fixture, el } = render(DOCTOR);
    expect(el.textContent).not.toContain('Cerrar sesión');

    el.querySelector<HTMLButtonElement>('.avatar')!.click();
    fixture.detectChanges();
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Cerrar sesión'))!.click();

    expect(signedOut).toEqual(['cerrada']);
  });

  it('uses the initials of the real name when an administrator can read the accounts', async () => {
    const { fixture, el } = render(ADMIN, [
      { id: 'u1', email: 'admin1@synthetic.test', firstName: 'Administrador', lastName: 'Sintético' },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.avatar')!.textContent!.trim()).toBe('AS');
  });
});
