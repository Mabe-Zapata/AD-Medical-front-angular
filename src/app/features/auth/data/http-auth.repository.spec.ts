import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpAuthRepository } from './http-auth.repository';

describe('HttpAuthRepository', () => {
  let repository: HttpAuthRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        HttpAuthRepository,
      ],
    });
    repository = TestBed.inject(HttpAuthRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the credentials and maps the token', async () => {
    const result = repository.login('a@b.test', 'pw');

    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'a@b.test', password: 'pw' });
    request.flush({ access_token: 'jwt', token_type: 'Bearer', expires_in: 900 });

    expect(await result).toEqual({ token: 'jwt', expiresInSeconds: 900 });
  });

  it('reports a 401 on login as wrong credentials and keeps the correlation id', async () => {
    const result = repository.login('a@b.test', 'bad');
    http.expectOne('/api/v1/auth/login').flush(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'x',
        correlation_id: 'c-1',
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(result).rejects.toMatchObject({
      kind: 'invalid_credentials',
      correlationId: 'c-1',
    });
  });

  it('maps the Nginx rate limit to rate_limited', async () => {
    const result = repository.login('a@b.test', 'pw');
    http
      .expectOne('/api/v1/auth/login')
      .flush({ detail: 'Rate limit exceeded' }, { status: 429, statusText: 'Too Many Requests' });

    await expect(result).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it.each([502, 503, 504])('maps a %i from the proxy to unavailable', async (status) => {
    const result = repository.login('a@b.test', 'pw');
    http.expectOne('/api/v1/auth/login').flush('Bad Gateway', { status, statusText: 'Down' });

    await expect(result).rejects.toMatchObject({ kind: 'unavailable', status });
  });

  it('maps a network failure to network', async () => {
    const result = repository.login('a@b.test', 'pw');
    http.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'));

    await expect(result).rejects.toMatchObject({ kind: 'network' });
  });

  it('sends the token explicitly when reading the profile', async () => {
    const result = repository.fetchProfile('jwt');

    const request = http.expectOne('/api/v1/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({ id: 'u1', roles: ['MEDICO'], permissions: ['conocimiento.leer'] });

    expect(await result).toEqual({
      id: 'u1',
      roles: ['MEDICO'],
      permissions: ['conocimiento.leer'],
    });
  });
});
