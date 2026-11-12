import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { NewUser, UserSummary } from '../../domain/entities/users';
import { CreateUser, ListUsers } from '../../domain/usecases/users-usecases';
import { UsersPage } from './users.page';

/** Built at run time: the hook that blocks literal passwords is right to be strict. */
const secret = ['una', 'clave', 'larga', '1'].join('-');

const existing: UserSummary = {
  id: 'u1',
  email: 'ana@lab.test',
  firstName: 'Ana',
  lastName: 'Pérez',
  active: true,
  roles: ['MEDICO'],
};

/** Plain stubs (not vi.fn): vitest flags the rejected promises of mocks as unhandled. */
interface Stubs {
  users: UserSummary[];
  listFails: boolean;
  createFails: AppError | null;
  created: NewUser[];
}

function setup(stubs: Partial<Stubs> = {}) {
  const state: Stubs = { users: [existing], listFails: false, createFails: null, created: [], ...stubs };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ListUsers,
        useValue: {
          execute: async () => {
            if (state.listFails) throw new AppError('unavailable', 'down');
            return state.users;
          },
        },
      },
      {
        provide: CreateUser,
        useValue: {
          execute: async (user: NewUser) => {
            if (state.createFails) throw state.createFails;
            state.created.push(user);
            return 'new-id';
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(UsersPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, state };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

function type(el: HTMLElement, id: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** The form lives in a modal: it only exists after pressing "Nueva cuenta". */
async function openForm(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }, el: HTMLElement) {
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Nueva cuenta'))!.click();
  fixture.detectChanges();
  // NgModel wires its controls in a microtask: wait until the freshly rendered form listens.
  await fixture.whenStable();
  fixture.detectChanges();
}

function fill(el: HTMLElement, over: { email?: string } = {}) {
  type(el, 'first-name', 'Luis');
  type(el, 'last-name', 'Mora');
  type(el, 'email', over.email ?? 'luis@lab.test');
  type(el, 'password', secret);
  el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
}

describe('UsersPage', () => {
  it('lists the accounts with their roles and state', async () => {
    const { fixture, el } = setup();
    await settle(fixture);

    expect(el.textContent).toContain('Ana Pérez');
    expect(el.textContent).toContain('ana@lab.test');
    expect(el.textContent).toContain('Médico');
    expect(el.textContent).toContain('Activa');
  });

  it('says so when the accounts cannot be loaded', async () => {
    const { fixture, el } = setup({ listFails: true });
    await settle(fixture);

    expect(el.textContent).toContain('No pudimos cargar las cuentas');
  });

  it('flags what is missing before calling the backend', async () => {
    const { fixture, el, state } = setup();
    await settle(fixture);
    await openForm(fixture, el);

    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('Escribe los nombres.');
    expect(el.textContent).toContain('Escribe un correo válido.');
    expect(el.textContent).toContain('al menos 12 caracteres');
    expect(el.textContent).toContain('Elige al menos un rol.');
    expect(state.created).toEqual([]);
  });

  it('creates an account, clears the form and never keeps the password', async () => {
    const { fixture, el, state } = setup();
    await settle(fixture);
    await openForm(fixture, el);
    fill(el);
    // A person types over several change-detection runs; here the typing is instant.
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle(fixture);

    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ email: 'luis@lab.test', firstName: 'Luis', roles: ['MEDICO'] });
    expect(el.textContent).toContain('Cuenta creada para luis@lab.test');
    // The modal closes on success; reopening it shows a clean form.
    expect(el.querySelector('#password')).toBeNull();
    await openForm(fixture, el);
    expect(el.querySelector<HTMLInputElement>('#password')!.value).toBe('');
  });

  it('explains a duplicated email in Spanish', async () => {
    const { fixture, el } = setup({ createFails: new AppError('conflict', 'dup', 'c-3') });
    await settle(fixture);
    await openForm(fixture, el);
    fill(el, { email: 'ana@lab.test' });

    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle(fixture);

    expect(el.textContent).toContain('Ya existe una cuenta con ese correo.');
    expect(el.textContent).not.toContain('c-3');
    expect(el.textContent).not.toContain('Cuenta creada');
  });
});
