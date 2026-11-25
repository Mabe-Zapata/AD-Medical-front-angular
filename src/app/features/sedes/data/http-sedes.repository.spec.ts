import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { HttpSedesRepository } from './http-sedes.repository';

describe('HttpSedesRepository', () => {
  let repository: HttpSedesRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_SETTINGS, useValue: { apiBaseUrl: '/api/v1' } },
        HttpSedesRepository,
      ],
    });
    repository = TestBed.inject(HttpSedesRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('translates the Spanish list into English entities, offices included', async () => {
    const promise = repository.listSedes();
    const req = http.expectOne('/api/v1/admin/sedes');
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [
        {
          id: 's1',
          nombre: 'Sede Norte',
          direccion: null,
          activo: true,
          consultorios: [{ id: 'o1', nombre: 'Consultorio 1', activo: false }],
        },
      ],
    });

    expect(await promise).toEqual([
      {
        id: 's1',
        name: 'Sede Norte',
        address: null,
        active: true,
        offices: [{ id: 'o1', name: 'Consultorio 1', active: false }],
      },
    ]);
  });

  it('sends only the fields that changed on a sede', async () => {
    const promise = repository.updateSede('s1', { active: false });
    const req = http.expectOne('/api/v1/admin/sedes/s1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush({});
    await promise;
  });

  it('sends a null address as a clear', async () => {
    const promise = repository.updateSede('s1', { address: null });
    const req = http.expectOne('/api/v1/admin/sedes/s1');
    expect(req.request.body).toEqual({ direccion: null });
    req.flush({});
    await promise;
  });

  it('finds the new consultorio id by its name in the returned sede', async () => {
    const promise = repository.createOffice('s1', 'Consultorio 2');
    const req = http.expectOne('/api/v1/admin/sedes/s1/consultorios');
    expect(req.request.body).toEqual({ nombre: 'Consultorio 2' });
    req.flush({
      id: 's1',
      nombre: 'Sede',
      direccion: null,
      activo: true,
      consultorios: [
        { id: 'o1', nombre: 'Consultorio 1', activo: true },
        { id: 'o2', nombre: 'Consultorio 2', activo: true },
      ],
    });
    expect(await promise).toBe('o2');
  });

  it('keeps the backend business code, so the screen can explain a blocked deactivation', async () => {
    const promise = repository.updateSede('s1', { active: false });
    const req = http.expectOne('/api/v1/admin/sedes/s1');
    req.flush(
      { detail: 'There are future appointments', code: 'CITAS_FUTURAS', correlation_id: 'c-1' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(promise).rejects.toMatchObject({ kind: 'conflict', code: 'CITAS_FUTURAS', status: 409 });
  });

  it('maps a 422 to a validation error', async () => {
    const promise = repository.createSede({ name: 'x', address: null });
    const req = http.expectOne('/api/v1/admin/sedes');
    req.flush({ detail: 'Invalid fields: nombre' }, { status: 422, statusText: 'Unprocessable Entity' });
    await expect(promise).rejects.toMatchObject({ kind: 'validation' });
  });
});
