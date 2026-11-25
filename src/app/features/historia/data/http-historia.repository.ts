import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  CatalogItem,
  CatalogName,
  ClinicalHistory,
  DateRange,
  AllergySeverity,
  ENTRY_KIND_PATH,
  EntryDetails,
  EntryDraft,
  EntryKind,
  EventFilter,
  EventPage,
  HistoryEntry,
  HistoryEvent,
  PatientOption,
  VitalMeasures,
  VitalSigns,
} from '../domain/entities/historia';
import { HistoriaRepository } from '../domain/ports/historia.repository';

/** Backend entries carry their kind as `tipo` and the fields in Spanish; this is the wire shape. */
interface EntryDto {
  id: string;
  tipo: string;
  estado: string | null;
  origen: 'REGISTRADA_MEDICO' | 'DECLARADA_PACIENTE';
  verificada: boolean;
  verificada_en: string | null;
  registrada_en: string | null;
  [field: string]: unknown;
}

interface VitalsDto {
  id: string;
  cita_id: string;
  corrige_a: string | null;
  motivo_correccion: string | null;
  registrada_en: string | null;
  peso_kg?: number | null;
  talla_cm?: number | null;
  pa_sistolica?: number | null;
  pa_diastolica?: number | null;
  frecuencia_cardiaca?: number | null;
  temperatura_c?: number | null;
  saturacion?: number | null;
}

interface HistoryDto {
  paciente_id: string;
  alergias: EntryDto[];
  antecedentes: EntryDto[];
  medicacion: EntryDto[];
  problemas: EntryDto[];
  vacunas: EntryDto[];
  signos_vitales: VitalsDto[];
}

interface EventDto {
  id: number;
  entidad: string;
  entidad_id: string;
  accion: HistoryEvent['action'];
  motivo: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  ocurrido_en: string;
  actor_usuario_id?: string;
}

/** Talks to the clinical history endpoints and translates Spanish fields into English entities. */
@Injectable()
export class HttpHistoriaRepository extends HistoriaRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_SETTINGS).apiBaseUrl;

  async listPatients(): Promise<PatientOption[]> {
    const limit = 100;
    const patients: PatientOption[] = [];
    for (let offset = 0; ; offset += limit) {
      const page = await this.call(
        this.http.get<{ items: { id: string; nombres: string; apellidos: string }[] }>(`${this.base}/patients`, {
          params: { limit, offset },
        }),
      );
      patients.push(...page.items.map((p) => ({ id: p.id, name: `${p.nombres} ${p.apellidos}`.trim() })));
      if (page.items.length < limit) return patients;
    }
  }

  async readHistory(patientId: string, range: DateRange): Promise<ClinicalHistory> {
    const dto = await this.call(
      this.http.get<HistoryDto>(`${this.patientUrl(patientId)}/historia`, { params: rangeParams(range) }),
    );
    return {
      patientId: dto.paciente_id,
      allergies: dto.alergias.map((e) => toEntry(e)),
      antecedents: dto.antecedentes.map((e) => toEntry(e)),
      medications: dto.medicacion.map((e) => toEntry(e)),
      problems: dto.problemas.map((e) => toEntry(e)),
      vaccines: dto.vacunas.map((e) => toEntry(e)),
      vitals: dto.signos_vitales.map(toVitals),
    };
  }

  async readEvents(patientId: string, filter: EventFilter): Promise<EventPage> {
    let params = rangeParams(filter);
    if (filter.entity) params = params.set('entidad', filter.entity);
    if (filter.action) params = params.set('accion', filter.action);
    if (filter.limit !== undefined) params = params.set('limit', String(filter.limit));
    if (filter.offset !== undefined) params = params.set('offset', String(filter.offset));
    const dto = await this.call(
      this.http.get<{ items: EventDto[]; total: number; limit: number; offset: number; incluye_actor: boolean }>(
        `${this.patientUrl(patientId)}/historia/eventos`,
        { params },
      ),
    );
    return {
      items: dto.items.map(toEvent),
      total: dto.total,
      limit: dto.limit,
      offset: dto.offset,
      includesActor: dto.incluye_actor,
    };
  }

  async createEntry(patientId: string, draft: EntryDraft): Promise<HistoryEntry> {
    const { kind, body } = toEntryBody(draft);
    const dto = await this.call(
      this.http.post<EntryDto>(`${this.patientUrl(patientId)}/historia/${ENTRY_KIND_PATH[kind]}`, body),
    );
    return toEntry(dto);
  }

  async verifyEntry(patientId: string, kind: EntryKind, entryId: string): Promise<HistoryEntry> {
    const dto = await this.call(
      this.http.post<EntryDto>(
        `${this.patientUrl(patientId)}/historia/${ENTRY_KIND_PATH[kind]}/${entryId}/verificar`,
        {},
      ),
    );
    return toEntry(dto);
  }

  async changeState(
    patientId: string,
    kind: EntryKind,
    entryId: string,
    change: { expected: string; target: string; reason: string },
  ): Promise<HistoryEntry> {
    const dto = await this.call(
      this.http.patch<EntryDto>(`${this.patientUrl(patientId)}/historia/${ENTRY_KIND_PATH[kind]}/${entryId}/estado`, {
        expected_estado: change.expected,
        estado: change.target,
        motivo: change.reason,
      }),
    );
    return toEntry(dto);
  }

  async recordVitals(appointmentId: string, measures: VitalMeasures): Promise<VitalSigns> {
    const dto = await this.call(
      this.http.post<VitalsDto>(`${this.base}/citas/${appointmentId}/signos-vitales`, vitalsBody(measures)),
    );
    return toVitals(dto);
  }

  async correctVitals(vitalsId: string, measures: VitalMeasures, reason: string): Promise<VitalSigns> {
    const dto = await this.call(
      this.http.post<VitalsDto>(`${this.base}/signos-vitales/${vitalsId}/correccion`, {
        ...vitalsBody(measures),
        motivo: reason,
      }),
    );
    return toVitals(dto);
  }

  async searchCatalog(catalog: CatalogName, query: string | null, limit: number): Promise<CatalogItem[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (query) params = params.set('q', query);
    const response = await this.call(
      this.http.get<{ items: { codigo: string; nombre: string; categoria?: string }[] }>(
        `${this.base}/catalogos/${catalog}`,
        { params },
      ),
    );
    return response.items.map((item) => ({
      code: item.codigo,
      name: item.nombre,
      category: item.categoria ?? null,
    }));
  }

  private patientUrl(patientId: string): string {
    return `${this.base}/patients/${patientId}`;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function rangeParams(range: DateRange): HttpParams {
  let params = new HttpParams();
  if (range.from) params = params.set('desde', range.from);
  if (range.to) params = params.set('hasta', range.to);
  return params;
}

function toEntry(dto: EntryDto): HistoryEntry {
  return {
    id: dto.id,
    state: dto.estado,
    origin: dto.origen === 'REGISTRADA_MEDICO' ? 'DOCTOR' : 'PATIENT',
    verified: dto.verificada,
    verifiedAt: dto.verificada_en,
    recordedAt: dto.registrada_en,
    details: toDetails(dto),
  };
}

function toDetails(dto: EntryDto): EntryDetails {
  const text = (key: string): string | null => (typeof dto[key] === 'string' ? (dto[key] as string) : null);
  switch (dto.tipo) {
    case 'alergia':
      return {
        kind: 'allergy',
        substanceCode: text('sustancia_codigo') ?? '',
        substance: text('sustancia') ?? '',
        category: text('categoria') ?? '',
        severity: (text('severidad') ?? 'DESCONOCIDA') as AllergySeverity,
        reaction: text('reaccion'),
      };
    case 'antecedente':
      return {
        kind: 'antecedent',
        type: (text('tipo') ?? 'PERSONAL') as 'PERSONAL' | 'FAMILIAR' | 'QUIRURGICO',
        description: text('descripcion') ?? '',
        relative: text('parentesco'),
        cie11: text('cie11'),
      };
    case 'medicacion':
      return {
        kind: 'medication',
        name: text('medicamento') ?? '',
        dose: text('dosis'),
        frequency: text('frecuencia'),
        startDate: text('inicio'),
      };
    case 'problema':
      return { kind: 'problem', description: text('descripcion') ?? '', cie11: text('cie11'), startDate: text('inicio') };
    default:
      return {
        kind: 'vaccine',
        code: text('vacuna_codigo') ?? '',
        name: text('vacuna') ?? '',
        doseNumber: typeof dto['dosis_numero'] === 'number' ? (dto['dosis_numero'] as number) : 0,
        date: text('fecha') ?? '',
        lot: text('lote'),
      };
  }
}

function toEntryBody(draft: EntryDraft): { kind: EntryKind; body: Record<string, unknown> } {
  switch (draft.kind) {
    case 'allergy':
      return {
        kind: 'allergy',
        body: { sustancia_codigo: draft.substanceCode, severidad: draft.severity, reaccion: draft.reaction },
      };
    case 'antecedent':
      return {
        kind: 'antecedent',
        body: { tipo: draft.type, descripcion: draft.description, parentesco: draft.relative, cie11: draft.cie11 },
      };
    case 'medication':
      return {
        kind: 'medication',
        body: { medicamento: draft.name, dosis: draft.dose, frecuencia: draft.frequency, inicio: draft.startDate },
      };
    case 'problem':
      return { kind: 'problem', body: { descripcion: draft.description, cie11: draft.cie11, inicio: draft.startDate } };
    case 'vaccine':
      return {
        kind: 'vaccine',
        body: { vacuna_codigo: draft.vaccineCode, dosis_numero: draft.doseNumber, fecha: draft.date, lote: draft.lot },
      };
  }
}

function toVitals(dto: VitalsDto): VitalSigns {
  return {
    id: dto.id,
    appointmentId: dto.cita_id,
    recordedAt: dto.registrada_en,
    correctsId: dto.corrige_a,
    reason: dto.motivo_correccion,
    weightKg: dto.peso_kg ?? null,
    heightCm: dto.talla_cm ?? null,
    systolic: dto.pa_sistolica ?? null,
    diastolic: dto.pa_diastolica ?? null,
    heartRate: dto.frecuencia_cardiaca ?? null,
    temperatureC: dto.temperatura_c ?? null,
    oxygen: dto.saturacion ?? null,
  };
}

/** Sends only the measures filled in; the backend requires at least one. */
function vitalsBody(measures: VitalMeasures): Record<string, number> {
  const pairs: [keyof VitalMeasures, string][] = [
    ['weightKg', 'peso_kg'],
    ['heightCm', 'talla_cm'],
    ['systolic', 'pa_sistolica'],
    ['diastolic', 'pa_diastolica'],
    ['heartRate', 'frecuencia_cardiaca'],
    ['temperatureC', 'temperatura_c'],
    ['oxygen', 'saturacion'],
  ];
  const body: Record<string, number> = {};
  for (const [key, field] of pairs) {
    const value = measures[key];
    if (value !== null && value !== undefined) body[field] = value;
  }
  return body;
}

function toEvent(dto: EventDto): HistoryEvent {
  return {
    id: dto.id,
    entity: dto.entidad,
    entityId: dto.entidad_id,
    action: dto.accion,
    reason: dto.motivo,
    before: dto.antes,
    after: dto.despues,
    at: dto.ocurrido_en,
    actorId: dto.actor_usuario_id ?? null,
  };
}
