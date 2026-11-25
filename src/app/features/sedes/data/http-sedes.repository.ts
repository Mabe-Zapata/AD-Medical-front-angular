import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import { NewSede, OfficeChanges, Consultorio, Sede, SedeChanges } from '../domain/entities/sedes';
import { SedesRepository } from '../domain/ports/sedes.repository';

interface ConsultorioDto {
  id: string;
  nombre: string;
  activo: boolean;
}

interface SedeDto {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  consultorios: ConsultorioDto[];
}

/** Talks to /api/v1/admin/sedes and /api/v1/admin/consultorios and translates the Spanish fields. */
@Injectable()
export class HttpSedesRepository extends SedesRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_SETTINGS).apiBaseUrl}/admin`;

  async listSedes(): Promise<Sede[]> {
    const response = await this.call(this.http.get<{ items: SedeDto[] }>(`${this.base}/sedes`));
    return response.items.map(toSede).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async createSede(sede: NewSede): Promise<string> {
    const created = await this.call(
      this.http.post<SedeDto>(`${this.base}/sedes`, {
        nombre: sede.name,
        direccion: sede.address,
      }),
    );
    return created.id;
  }

  async updateSede(sedeId: string, changes: SedeChanges): Promise<void> {
    await this.call(this.http.patch<SedeDto>(`${this.base}/sedes/${sedeId}`, sedeBody(changes)));
  }

  async createOffice(sedeId: string, name: string): Promise<string> {
    // The response is the whole sede; the new consultorio is the one with this name (unique per sede).
    const sede = await this.call(
      this.http.post<SedeDto>(`${this.base}/sedes/${sedeId}/consultorios`, { nombre: name }),
    );
    const created = sede.consultorios.find((office) => office.nombre === name);
    if (!created) throw toAppError(new Error('consultorio not in response'));
    return created.id;
  }

  async updateOffice(officeId: string, changes: OfficeChanges): Promise<void> {
    await this.call(
      this.http.patch<ConsultorioDto>(`${this.base}/consultorios/${officeId}`, officeBody(changes)),
    );
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toSede(dto: SedeDto): Sede {
  return {
    id: dto.id,
    name: dto.nombre,
    address: dto.direccion,
    active: dto.activo,
    offices: dto.consultorios.map(toOffice),
  };
}

function toOffice(dto: ConsultorioDto): Consultorio {
  return { id: dto.id, name: dto.nombre, active: dto.activo };
}

/** Sends only the fields that changed, so the backend never sees a field the person did not touch. */
function sedeBody(changes: SedeChanges): Record<string, unknown> {
  return {
    ...(changes.name !== undefined ? { nombre: changes.name } : {}),
    ...(changes.address !== undefined ? { direccion: changes.address } : {}),
    ...(changes.active !== undefined ? { activo: changes.active } : {}),
  };
}

function officeBody(changes: OfficeChanges): Record<string, unknown> {
  return {
    ...(changes.name !== undefined ? { nombre: changes.name } : {}),
    ...(changes.active !== undefined ? { activo: changes.active } : {}),
  };
}
