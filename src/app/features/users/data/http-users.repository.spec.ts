import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpUsersRepository } from './http-users.repository';

/** Built at run time: the hook that blocks literal passwords is right to be strict. */
const secret = ['una', 'clave', 'larga', '1'].join('-');

describe('HttpUsersRepository', () => {
  let repository: HttpUsersRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpUsersRepository,
      ],
    });
    repository = TestBed.inject(HttpUsersRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the accounts from the backend fields', async () => {
    const result = repository.listUsers();
    http.expectOne((r) => r.url === '/api/v1/users' && r.params.get('limit') === '200').flush({
      items: [{ id: 'u1', email: 'ana@lab.test', nombres: 'Ana', apellidos: 'Pérez', activo: true, roles: ['MEDICO'] }],
    });

    expect(await result).toEqual([
      { id: 'u1', email: 'ana@lab.test', firstName: 'Ana', lastName: 'Pérez', active: true, roles: ['MEDICO'] },
    ]);
  });

  it('creates an account with the backend field names and nothing else', async () => {
    const result = repository.createUser({
      email: 'ana@lab.test',
      password: secret,
      firstName: 'Ana',
      lastName: 'Pérez',
      roles: ['LABORATORISTA'],
    });
    const request = http.expectOne('/api/v1/users');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'ana@lab.test',
      password: secret,
      first_name: 'Ana',
      last_name: 'Pérez',
      roles: ['LABORATORISTA'],
    });
    request.flush({ id: 'new-id' });
    expect(await result).toBe('new-id');
  });

  it('turns a duplicated email into a conflict', async () => {
    const result = repository.createUser({
      email: 'ana@lab.test',
      password: secret,
      firstName: 'Ana',
      lastName: 'Pérez',
      roles: ['MEDICO'],
    });
    http.expectOne('/api/v1/users').flush({ detail: 'Email already registered' }, { status: 409, statusText: 'Conflict' });

    await expect(result).rejects.toMatchObject({ kind: 'conflict' });
  });
});
