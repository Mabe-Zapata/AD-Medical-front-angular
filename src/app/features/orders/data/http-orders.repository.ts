import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { AppError } from '../../../core/domain/app-error';
import { toAppError } from '../../../core/http/api-error';
import {
  Decision,
  Finding,
  LabOrder,
  LabResult,
  NewOrder,
  NewResult,
  Proposal,
  UploadedReport,
} from '../domain/entities/orders';
import { OrdersRepository } from '../domain/ports/orders.repository';

interface OrderDto {
  id: string;
  paciente_id: string;
  prioridad: string;
  estado: string;
  observaciones: string | null;
  pruebas: { detalle_id: string; tipo_prueba_id: string; estado: string }[];
}

interface ResultDto {
  id: string;
  detalle_id: string;
  nombre_analito: string;
  unidad: string | null;
  valor_numerico: number | null;
  valor_texto: string | null;
}

interface FindingDto {
  id: string;
  regla_codigo: string;
  regla_version: number;
  tipo: string;
  explicacion: string;
  estado_revision: string;
  evidencia: {
    resultado_id: string;
    valor_observado: number | null;
    unidad_observada: string | null;
  }[];
}

interface ProposalDto {
  id: string;
  orden_id: string;
  estado: string;
  version_motor: string;
  resumen: string;
  aviso: string;
  decision: string | null;
  conclusion_medica: string | null;
  hallazgos: FindingDto[];
}

interface DocumentDto {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
}

/** Talks to /api/v1/lab and /api/v1/clinical and translates the backend's Spanish fields. */
@Injectable()
export class HttpOrdersRepository extends OrdersRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(APP_SETTINGS).apiBaseUrl;

  async createOrder(order: NewOrder): Promise<LabOrder> {
    return toOrder(
      await this.call(
        this.http.post<OrderDto>(`${this.api}/lab/orders`, {
          paciente_id: order.patientId,
          tipo_prueba_ids: order.testTypeIds,
          prioridad: order.priority,
          observaciones: order.notes,
        }),
      ),
    );
  }

  async getOrder(orderId: string): Promise<LabOrder> {
    return toOrder(await this.call(this.http.get<OrderDto>(`${this.api}/lab/orders/${orderId}`)));
  }

  async listResults(orderId: string): Promise<LabResult[]> {
    const response = await this.call(
      this.http.get<{ items: ResultDto[] }>(`${this.api}/lab/orders/${orderId}/results`),
    );
    return response.items.map((r) => ({
      id: r.id,
      detailId: r.detalle_id,
      analyteName: r.nombre_analito,
      unit: r.unidad,
      numericValue: r.valor_numerico,
      textValue: r.valor_texto,
    }));
  }

  async recordResults(
    orderId: string,
    detailId: string,
    results: readonly NewResult[],
  ): Promise<LabOrder> {
    const order = await this.call(
      this.http.post<OrderDto>(`${this.api}/lab/orders/${orderId}/results`, {
        detalle_id: detailId,
        resultados: results.map((r) => ({
          analito_id: r.analyteId,
          nombre_analito: r.analyteName.trim(),
          unidad: r.unit?.trim() || null,
          valor_numerico: r.numericValue,
          valor_texto: r.textValue?.trim() || null,
        })),
      }),
    );
    return toOrder(order);
  }

  async uploadReport(orderId: string, file: File): Promise<UploadedReport> {
    const form = new FormData();
    form.append('archivo', file, file.name);
    const doc = await this.call(
      this.http.post<DocumentDto>(`${this.api}/lab/orders/${orderId}/documents`, form),
    );
    return { id: doc.id, fileName: doc.nombre_archivo, sizeBytes: doc.tamano_bytes };
  }

  async evaluate(orderId: string): Promise<Proposal> {
    return toProposal(
      await this.call(
        this.http.post<ProposalDto>(`${this.api}/lab/orders/${orderId}/evaluate`, null),
      ),
    );
  }

  async getProposal(orderId: string): Promise<Proposal | null> {
    try {
      return toProposal(
        await this.call(this.http.get<ProposalDto>(`${this.api}/lab/orders/${orderId}/proposal`)),
      );
    } catch (error) {
      // 404 means "no proposal yet", which is a normal state of an order and not a failure.
      if (error instanceof AppError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  async decide(proposalId: string, decision: Decision, text: string): Promise<void> {
    await this.call(
      this.http.post(`${this.api}/clinical/proposals/${proposalId}/reviews`, {
        decision,
        conclusion_corregida: decision === 'CORREGIR' ? text : null,
        motivo: decision === 'RECHAZAR' ? text : null,
      }),
    );
  }

  async reviewOrder(
    orderId: string,
    conclusion: string,
    recommendations: string | null,
  ): Promise<void> {
    await this.call(
      this.http.post(`${this.api}/lab/orders/${orderId}/review`, {
        conclusion,
        recomendaciones: recommendations,
      }),
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

function toOrder(dto: OrderDto): LabOrder {
  return {
    id: dto.id,
    patientId: dto.paciente_id,
    priority: dto.prioridad,
    status: dto.estado,
    notes: dto.observaciones,
    tests: dto.pruebas.map((t) => ({
      detailId: t.detalle_id,
      testTypeId: t.tipo_prueba_id,
      status: t.estado,
    })),
  };
}

function toFinding(dto: FindingDto): Finding {
  return {
    id: dto.id,
    ruleCode: dto.regla_codigo,
    ruleVersion: dto.regla_version,
    type: dto.tipo,
    explanation: dto.explicacion,
    reviewStatus: dto.estado_revision,
    evidence: dto.evidencia.map((e) => ({
      resultId: e.resultado_id,
      observedValue: e.valor_observado,
      unit: e.unidad_observada,
    })),
  };
}

function toProposal(dto: ProposalDto): Proposal {
  return {
    id: dto.id,
    orderId: dto.orden_id,
    status: dto.estado,
    summary: dto.resumen,
    notice: dto.aviso,
    engineVersion: dto.version_motor,
    decision: dto.decision,
    medicalConclusion: dto.conclusion_medica,
    findings: dto.hallazgos.map(toFinding),
  };
}
