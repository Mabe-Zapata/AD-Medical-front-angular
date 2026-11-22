import { AppError } from '../../../../core/domain/app-error';
import { MonitoringStatus, ReportSummary } from '../entities/reports';
import { periodProblem } from '../policies/reports-policies';
import { ReportsRepository } from '../ports/reports.repository';

export class GetReportSummary {
  constructor(private readonly repository: ReportsRepository) {}

  execute(from: string, to: string): Promise<ReportSummary> {
    const problem = periodProblem(from, to);
    if (problem) throw new AppError('validation', `Invalid period: ${problem}`);
    return this.repository.getSummary(from, to);
  }
}

export class GetMonitoringStatus {
  constructor(private readonly repository: ReportsRepository) {}

  execute(): Promise<MonitoringStatus> {
    return this.repository.getMonitoring();
  }
}
