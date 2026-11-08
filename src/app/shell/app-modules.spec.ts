import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionState } from '../features/auth/presentation/session.state';
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

describe('StaffShell navigation', () => {
  function render(permissions: string[]): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionState,
          useValue: {
            user: () => ({ roles: [] }),
            isSignedIn: () => true,
            endReason: () => null,
            can: (p: string) => permissions.includes(p),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(StaffShell);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('does not list areas that belong to another role', () => {
    const nav = render(DOCTOR).querySelector('nav')!.textContent;

    expect(nav).toContain('Inicio');
    expect(nav).toContain('Conocimiento clínico');
    expect(nav).toContain('Órdenes y resultados');
    expect(nav).not.toContain('Usuarios y roles');
  });

  it('lists the user administration for an administrator', () => {
    expect(render(ADMIN).querySelector('nav')!.textContent).toContain('Usuarios y roles');
  });
});
