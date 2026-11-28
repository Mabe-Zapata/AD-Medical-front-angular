import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  AgendaAppointment,
  AppointmentStatus,
  ApproveCancellationCommand,
  CancellationApprovalResult,
  CancellationCandidate,
  CancelDoctorAppointmentCommand,
  ConsultationResult,
  OpenConsultationCommand,
} from '../domain/entities/appointment';
import {
  AgendaRepository,
  ListAgendaFilter,
  ListCancellationCandidatesFilter,
} from '../domain/ports/agenda.ports';

interface AppointmentDto {
  id: string;
  estado: string;
  inicio: string;
  fin: string;
  paciente?: {
    id: string;
    nombre: string;
  } | null;
}

interface AppointmentListDto {
  items: AppointmentDto[];
}

interface CancellationCandidateDto {
  id: string;
  estado: string;
  inicio: string;
  fin: string;
  tiene_aprobacion: boolean;
  medico: {
    id: string;
    nombre: string;
    registro_profesional: string | null;
  };
}

interface CancellationCandidateListDto {
  items: CancellationCandidateDto[];
}

interface CancellationApprovalDto {
  cita_id: string;
  aprobada: boolean;
}

interface ConsultationDto {
  id: string;
  cita_id: string;
  estado: 'ABIERTA' | 'CERRADA';
  inicio_atencion: string | null;
  motivo_consulta: string | null;
}

@Injectable()
export class HttpAgendaRepository extends AgendaRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_SETTINGS).apiBaseUrl;

  async listAppointments(filter?: ListAgendaFilter): Promise<readonly AgendaAppointment[]> {
    try {
      let params = new HttpParams();
      if (filter?.status) {
        params = params.set('estado', filter.status);
      }
      if (filter?.limit !== undefined) {
        params = params.set('limit', String(filter.limit));
      }
      if (filter?.offset !== undefined) {
        params = params.set('offset', String(filter.offset));
      }

      const response = await firstValueFrom(
        this.http.get<AppointmentListDto>(`${this.base}/appointments`, { params }),
      );

      return (response.items ?? []).map((item) => ({
        id: item.id,
        status: item.estado as AppointmentStatus,
        startUtc: item.inicio,
        endUtc: item.fin,
        patient: item.paciente
          ? {
              id: item.paciente.id,
              name: item.paciente.nombre,
            }
          : null,
      }));
    } catch (error) {
      throw toAppError(error);
    }
  }

  async listCancellationCandidates(
    filter?: ListCancellationCandidatesFilter,
  ): Promise<readonly CancellationCandidate[]> {
    try {
      let params = new HttpParams();
      if (filter?.status) {
        params = params.set('estado', filter.status);
      }
      const registration = filter?.doctorRegistration?.trim();
      if (registration) {
        params = params.set('medico_registro', registration);
      }
      if (filter?.limit !== undefined) {
        params = params.set('limit', String(filter.limit));
      }
      if (filter?.offset !== undefined) {
        params = params.set('offset', String(filter.offset));
      }

      const response = await firstValueFrom(
        this.http.get<CancellationCandidateListDto>(
          `${this.base}/appointments/cancellation-approvals`,
          { params },
        ),
      );

      return (response.items ?? []).map((item) => ({
        id: item.id,
        status: item.estado as AppointmentStatus,
        startUtc: item.inicio,
        endUtc: item.fin,
        doctor: {
          id: item.medico.id,
          name: item.medico.nombre,
          professionalRegistration: item.medico.registro_profesional ?? null,
        },
        hasApproval: Boolean(item.tiene_aprobacion),
      }));
    } catch (error) {
      throw toAppError(error);
    }
  }

  async cancelAppointment(command: CancelDoctorAppointmentCommand): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<unknown>(`${this.base}/appointments/${command.appointmentId}/cancel`, {
          motivo_codigo: command.code,
          motivo_texto: command.reason,
        }),
      );
    } catch (error) {
      throw toAppError(error);
    }
  }

  async approveCancellation(
    command: ApproveCancellationCommand,
  ): Promise<CancellationApprovalResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<CancellationApprovalDto>(
          `${this.base}/appointments/${command.appointmentId}/cancellation-approval`,
          { motivo: command.reason },
        ),
      );
      return {
        appointmentId: response.cita_id,
        approved: response.aprobada,
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async openConsultation(command: OpenConsultationCommand): Promise<ConsultationResult> {
    try {
      // One call registers the attention: the diagnosis is required, the treatment plan optional.
      // The backend closes the consultation and moves the appointment to COMPLETADA.
      const response = await firstValueFrom(
        this.http.post<ConsultationDto>(
          `${this.base}/appointments/${command.appointmentId}/consultation/close`,
          {
            observaciones: command.diagnosis?.trim() || null,
            plan_tratamiento: command.treatment?.trim() || null,
          },
        ),
      );

      return {
        id: response.id,
        appointmentId: response.cita_id,
        estado: response.estado,
        inicioAtencion: response.inicio_atencion,
        motivoConsulta: response.motivo_consulta,
      };
    } catch (error) {
      throw toAppError(error);
    }
  }
}

