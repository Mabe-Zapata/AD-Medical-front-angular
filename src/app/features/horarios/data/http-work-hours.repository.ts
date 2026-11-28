import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  Consultorio,
  DoctorHours,
  DoctorOption,
  GenerationResult,
  ProposedSlot,
  WorkBlock,
} from '../domain/entities/work-hours';
import { WorkHoursRepository } from '../domain/ports/work-hours.repository';

interface BlockDto {
  dia_semana: number;
  inicio: string;
  fin: string;
}

interface HoursDto {
  vigente_desde: string;
  actual: BlockDto[];
  proximo: BlockDto[];
}

interface ProposalDto {
  inicio_utc: string;
  fin_utc: string;
  franja: 'MANANA' | 'TARDE';
}

const toBlock = (dto: BlockDto): WorkBlock => ({
  dayOfWeek: dto.dia_semana,
  start: dto.inicio,
  end: dto.fin,
});

const toBlockDto = (block: WorkBlock): BlockDto => ({
  dia_semana: block.dayOfWeek,
  inicio: block.start,
  fin: block.end,
});

const toHours = (dto: HoursDto): DoctorHours => ({
  effectiveFrom: dto.vigente_desde,
  current: dto.actual.map(toBlock),
  next: dto.proximo.map(toBlock),
});

/** Talks to /api/v1 for the doctor's own hours and the administrator's planning. */
@Injectable()
export class HttpWorkHoursRepository extends WorkHoursRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_SETTINGS).apiBaseUrl;

  async getMyHours(): Promise<DoctorHours> {
    return this.call(async () => toHours(await this.get<HoursDto>('/me/horario-trabajo')));
  }

  async saveMyHours(blocks: readonly WorkBlock[]): Promise<DoctorHours> {
    return this.call(async () =>
      toHours(
        await firstValueFrom(
          this.http.put<HoursDto>(`${this.base}/me/horario-trabajo`, {
            bloques: blocks.map(toBlockDto),
          }),
        ),
      ),
    );
  }

  async listDoctors(): Promise<DoctorOption[]> {
    return this.call(async () => {
      const dto = await this.get<{ items: { id: string; nombre: string }[] }>('/doctors');
      return dto.items.map((item) => ({ id: item.id, name: item.nombre }));
    });
  }

  async getDoctorHours(doctorId: string): Promise<DoctorHours> {
    return this.call(async () =>
      toHours(await this.get<HoursDto>(`/admin/medicos/${doctorId}/horario-trabajo`)),
    );
  }

  async listConsultorios(): Promise<Consultorio[]> {
    return this.call(async () => {
      const dto = await this.get<{ items: { id: string; nombre: string; sede: string }[] }>(
        '/admin/consultorios',
      );
      return dto.items.map((item) => ({ id: item.id, name: item.nombre, office: item.sede }));
    });
  }

  async proposeWeek(doctorId: string, weekStart: string): Promise<ProposedSlot[]> {
    return this.call(async () => {
      const params = new HttpParams().set('medico_id', doctorId).set('semana', weekStart);
      const dto = await firstValueFrom(
        this.http.get<{ items: ProposalDto[] }>(`${this.base}/admin/horarios/propuesta`, { params }),
      );
      return dto.items.map((item) => ({
        startUtc: item.inicio_utc,
        endUtc: item.fin_utc,
        window: item.franja,
      }));
    });
  }

  async generateWeek(
    doctorId: string,
    consultorioId: string,
    weekStart: string,
  ): Promise<GenerationResult> {
    return this.call(async () => {
      const dto = await firstValueFrom(
        this.http.post<{ creados: number; existentes: number }>(
          `${this.base}/admin/horarios/generar`,
          { medico_id: doctorId, consultorio_id: consultorioId, semana: weekStart },
        ),
      );
      return { created: dto.creados, existing: dto.existentes };
    });
  }

  private get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${path}`));
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw toAppError(error);
    }
  }
}
