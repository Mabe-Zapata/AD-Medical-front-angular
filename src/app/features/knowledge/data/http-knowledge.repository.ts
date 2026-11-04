import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  Analyte,
  NewAnalyte,
  NewReference,
  NewRule,
  ReferenceRange,
} from '../domain/entities/knowledge';
import { KnowledgeRepository } from '../domain/ports/knowledge.repository';

interface AnalyteDto {
  id: string;
  nombre: string;
  unidad: string | null;
  tipo_valor: string;
}

interface ReferenceDto {
  id: string;
  version: number;
  unidad: string;
  minimo: number | null;
  maximo: number | null;
  sexo: string | null;
  edad_min_dias: number | null;
  edad_max_dias: number | null;
  metodo: string | null;
  tipo_muestra: string | null;
  contexto: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
}

interface IdDto {
  id: string;
}

/** Talks to /api/v1/knowledge and translates between the backend's Spanish fields and the domain. */
@Injectable()
export class HttpKnowledgeRepository extends KnowledgeRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_SETTINGS).apiBaseUrl}/knowledge`;

  async listAnalytes(): Promise<Analyte[]> {
    const response = await this.call(
      this.http.get<{ items: AnalyteDto[] }>(`${this.base}/analytes`),
    );
    return response.items.map((a) => ({
      id: a.id,
      name: a.nombre,
      unit: a.unidad,
      valueType: a.tipo_valor,
    }));
  }

  async createAnalyte(analyte: NewAnalyte): Promise<string> {
    const response = await this.call(
      this.http.post<IdDto>(`${this.base}/analytes`, {
        nombre: analyte.name,
        unidad: analyte.unit,
        tipo_valor: analyte.valueType,
      }),
    );
    return response.id;
  }

  async listReferences(analyteId: string, onDate: string | null): Promise<ReferenceRange[]> {
    const params = onDate ? new HttpParams().set('fecha', onDate) : undefined;
    const response = await this.call(
      this.http.get<{ items: ReferenceDto[] }>(`${this.base}/analytes/${analyteId}/references`, {
        params,
      }),
    );
    return response.items.map((r) => ({
      id: r.id,
      version: r.version,
      unit: r.unidad,
      min: r.minimo,
      max: r.maximo,
      sex: r.sexo,
      minAgeDays: r.edad_min_dias,
      maxAgeDays: r.edad_max_dias,
      method: r.metodo,
      sampleType: r.tipo_muestra,
      context: r.contexto,
      startDate: r.fecha_inicio,
      endDate: r.fecha_fin,
    }));
  }

  async createReference(analyteId: string, reference: NewReference): Promise<string> {
    const response = await this.call(
      this.http.post<IdDto>(`${this.base}/analytes/${analyteId}/references`, {
        fuente_id: reference.sourceId,
        unidad: reference.unit,
        minimo: reference.min,
        maximo: reference.max,
        sexo: reference.sex,
        edad_min_dias: reference.minAgeDays,
        edad_max_dias: reference.maxAgeDays,
        metodo: reference.method,
        tipo_muestra: reference.sampleType,
        contexto: reference.context,
        fecha_inicio: reference.startDate,
        fecha_fin: reference.endDate,
      }),
    );
    return response.id;
  }

  async validateReference(referenceId: string): Promise<void> {
    await this.call(this.http.post(`${this.base}/references/${referenceId}/validate`, null));
  }

  async createRule(rule: NewRule): Promise<string> {
    const response = await this.call(
      this.http.post<IdDto>(`${this.base}/rules`, {
        codigo: rule.code,
        nombre: rule.name,
        descripcion: rule.description,
        tipo: rule.type,
        expresion_logica: rule.logic,
        mensaje: rule.message,
        prioridad: rule.priority,
        criterios: rule.criteria.map((c) => ({
          analito_id: c.analyteId,
          operador: c.operator,
          umbral: c.threshold,
          unidad: c.unit,
        })),
      }),
    );
    return response.id;
  }

  async validateRule(ruleId: string): Promise<void> {
    await this.call(this.http.post(`${this.base}/rules/${ruleId}/validate`, null));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}
