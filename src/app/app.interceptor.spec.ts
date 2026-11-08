import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { authInterceptor } from './app.interceptor';
import { APP_SETTINGS } from './core/config/app-settings';
import { Session } from './features/auth/domain/entities/session';
import { SessionState } from './features/auth/presentation/session.state';

describe('authInterceptor', () => {
  const signOut = vi.fn();
  let session: Session | null;
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    signOut.mockClear();
    session = new Session('jwt', Date.now() + 60_000, { id: 'u', roles: [], permissions: [] });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1', defaultSourceId: null } },
        { provide: SessionState, useValue: { session: () => session, signOut } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('adds the bearer token to API calls', () => {
    void firstValueFrom(http.get('/api/v1/knowledge/analytes'));
    const request = controller.expectOne('/api/v1/knowledge/analytes');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({});
  });

  it('does not leak the token to other hosts', () => {
    void firstValueFrom(http.get('https://fonts.googleapis.com/css2'));
    const request = controller.expectOne('https://fonts.googleapis.com/css2');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush('');
  });

  it('keeps an Authorization header that was set explicitly', () => {
    void firstValueFrom(http.get('/api/v1/me', { headers: { Authorization: 'Bearer other' } }));
    const request = controller.expectOne('/api/v1/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer other');
    request.flush({});
  });

  it('ends the session when the API rejects the token', async () => {
    const result = firstValueFrom(http.get('/api/v1/knowledge/analytes'));
    controller
      .expectOne('/api/v1/knowledge/analytes')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeTruthy();
    expect(signOut).toHaveBeenCalledWith('expirada');
  });

  it('does not end the session for a failed login attempt', async () => {
    session = null;
    const result = firstValueFrom(http.post('/api/v1/auth/login', {}));
    controller
      .expectOne('/api/v1/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not end the session for other errors', async () => {
    const result = firstValueFrom(http.get('/api/v1/knowledge/analytes'));
    controller
      .expectOne('/api/v1/knowledge/analytes')
      .flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });
});
