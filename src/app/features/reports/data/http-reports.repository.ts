import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import {
  MonitoringStatus,
  PaymentTotal,
  ReplicationDestination,
  ReportSummary,
  StateCount,
} from '../domain/entities/reports';
import { ReportsRepository } from '../domain/ports/reports.repository';

interface CountDto {
  estado: string;
  total: number;
}

interface PaymentDto extends CountDto {
  monto: string;
}

interface SummaryDto {
  desde: string;
  hasta: string;
  citas: CountDto[];
  ordenes_laboratorio: CountDto[];
  pagos: PaymentDto[];
  tratamientos: CountDto[];
}

interface DestinationDto {
  codigo: string;
  entregas: CountDto[];
  pendiente_mas_antiguo: string | null;
  ultima_entrega: string | null;
}

interface MonitoringDto {
  revisado_en: string;
  base_principal: { estado: string; latencia_ms: number };
  replicacion: DestinationDto[];
}

const counts = (items: readonly CountDto[]): StateCount[] =>
  items.map((item) => ({ state: item.estado, total: item.total }));

const destination = (item: DestinationDto): ReplicationDestination => ({
  code: item.codigo,
  deliveries: counts(item.entregas),
  oldestPendingAt: item.pendiente_mas_antiguo,
  lastDeliveryAt: item.ultima_entrega,
});

/** Talks to /api/v1/admin and translates the backend's Spanish fields. */
@Injectable()
export class HttpReportsRepository extends ReportsRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_SETTINGS).apiBaseUrl}/admin`;

  async getSummary(from: string, to: string): Promise<ReportSummary> {
    const response = await this.call(
      this.http.get<SummaryDto>(`${this.base}/reportes/resumen`, {
        params: new HttpParams().set('desde', from).set('hasta', to),
      }),
    );
    return {
      from: response.desde,
      to: response.hasta,
      appointments: counts(response.citas),
      labOrders: counts(response.ordenes_laboratorio),
      payments: response.pagos.map(
        (item): PaymentTotal => ({ state: item.estado, total: item.total, amount: item.monto }),
      ),
      treatments: counts(response.tratamientos),
    };
  }

  async getMonitoring(): Promise<MonitoringStatus> {
    const response = await this.call(this.http.get<MonitoringDto>(`${this.base}/monitoreo/estado`));
    return {
      checkedAt: response.revisado_en,
      databaseLatencyMs: response.base_principal.latencia_ms,
      destinations: response.replicacion.map(destination),
    };
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}
