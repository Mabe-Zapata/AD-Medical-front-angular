import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  Cutoff,
  EditableFinding,
  NewShadowEdit,
  ShadowAction,
  ShadowEdit,
  ShadowFinding,
  ShadowReport,
  ShadowSnapshot,
} from '../domain/entities/shadow';
import { ShadowRepository } from '../domain/ports/shadow.repository';

interface ReportDto {
  anemia: { categoria: string; corte_g_l: number | null; motivo: string | null };
  hierro: {
    categoria: string;
    corte_ug_l: number | null;
    motivo: string | null;
    fuente: string | null;
  };
  diabetes: { categoria: string; motivo: string | null };
  microcitosis?: {
    categoria: string;
    limite_inferior_fl: number | null;
    motivo: string | null;
    aviso: string | null;
    fuente: string | null;
  } | null;
}

interface SnapshotDto {
  id: string;
  version_regla: string;
  creado_en: string;
  items: {
    hallazgo: EditableFinding;
    categoria: string;
    corte_valor: number | null;
    corte_unidad: string | null;
    fuente: string | null;
    motivo: string | null;
    evidencia: { rol: string; resultado_id: string; valor: number; unidad: string | null }[];
  }[];
}

interface EditDto {
  id: string;
  accion: ShadowAction;
  categoria_anterior: string;
  categoria_nueva: string;
  motivo: string;
  creado_en: string;
}

/** Talks to the `sombra` endpoints under /api/v1/lab/orders and translates the backend's Spanish fields. */
@Injectable()
export class HttpShadowRepository extends ShadowRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(APP_SETTINGS).apiBaseUrl;

  async getReport(orderId: string): Promise<ShadowReport> {
    return toReport(
      await this.call(this.http.get<ReportDto>(`${this.api}/lab/orders/${orderId}/sombra`)),
    );
  }

  async recordSnapshot(orderId: string): Promise<ShadowSnapshot> {
    return toSnapshot(
      await this.call(
        this.http.post<SnapshotDto>(`${this.api}/lab/orders/${orderId}/sombra/snapshots`, null),
      ),
    );
  }

  async editFinding(
    orderId: string,
    snapshotId: string,
    finding: EditableFinding,
    edit: NewShadowEdit,
  ): Promise<string> {
    const saved = await this.call(
      this.http.post<{ categoria_guardada: string }>(
        this.editsUrl(orderId, snapshotId, finding),
        {
          accion: edit.action,
          categoria_nueva: edit.action === 'MODIFICAR' ? edit.newCategory : null,
          motivo: edit.reason,
        },
      ),
    );
    return saved.categoria_guardada;
  }

  async listEdits(
    orderId: string,
    snapshotId: string,
    finding: EditableFinding,
  ): Promise<ShadowEdit[]> {
    const response = await this.call(
      this.http.get<{ items: EditDto[] }>(this.editsUrl(orderId, snapshotId, finding)),
    );
    return response.items.map((dto) => ({
      id: dto.id,
      action: dto.accion,
      previousCategory: dto.categoria_anterior,
      newCategory: dto.categoria_nueva,
      reason: dto.motivo,
      createdAt: dto.creado_en,
    }));
  }

  private editsUrl(orderId: string, snapshotId: string, finding: EditableFinding): string {
    return `${this.api}/lab/orders/${orderId}/sombra/snapshots/${snapshotId}/hallazgos/${finding}/ediciones`;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

const cutoff = (value: number | null, unit: string | null): Cutoff | null =>
  value === null || unit === null ? null : { value, unit };

function toReport(dto: ReportDto): ShadowReport {
  const findings: ShadowFinding[] = [
    {
      key: 'ANEMIA',
      category: dto.anemia.categoria,
      cutoff: cutoff(dto.anemia.corte_g_l, 'g/L'),
      reason: dto.anemia.motivo,
      source: null,
      notice: null,
    },
    {
      key: 'HIERRO',
      category: dto.hierro.categoria,
      cutoff: cutoff(dto.hierro.corte_ug_l, 'µg/L'),
      reason: dto.hierro.motivo,
      source: dto.hierro.fuente,
      notice: null,
    },
    {
      key: 'DIABETES',
      category: dto.diabetes.categoria,
      cutoff: null,
      reason: dto.diabetes.motivo,
      source: null,
      notice: null,
    },
  ];
  const micro = dto.microcitosis;
  if (micro) {
    findings.push({
      key: 'MICROCITOSIS',
      category: micro.categoria,
      cutoff: cutoff(micro.limite_inferior_fl, 'fL'),
      reason: micro.motivo,
      source: micro.fuente,
      notice: micro.aviso,
    });
  }
  return { findings };
}

function toSnapshot(dto: SnapshotDto): ShadowSnapshot {
  return {
    id: dto.id,
    ruleVersion: dto.version_regla,
    createdAt: dto.creado_en,
    items: dto.items.map((item) => ({
      finding: item.hallazgo,
      category: item.categoria,
      cutoff: cutoff(item.corte_valor, item.corte_unidad),
      source: item.fuente,
      reason: item.motivo,
      evidence: item.evidencia.map((e) => ({
        role: e.rol,
        resultId: e.resultado_id,
        value: e.valor,
        unit: e.unidad,
      })),
    })),
  };
}
