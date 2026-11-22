import { MonitoringStatus, ReportSummary } from '../entities/reports';

/** Port to the administrator reports API. Implementations throw `AppError`. */
export abstract class ReportsRepository {
  /** Counts and payment totals for an inclusive period, in ISO dates (YYYY-MM-DD). */
  abstract getSummary(from: string, to: string): Promise<ReportSummary>;
  /** Database latency and the replication backlog of each destination. */
  abstract getMonitoring(): Promise<MonitoringStatus>;
}
