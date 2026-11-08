import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import {
  Decision,
  LabOrder,
  LabResult,
  NewOrder,
  NewResult,
  Proposal,
  UploadedReport,
} from '../entities/orders';
import {
  decisionProblems,
  orderProblems,
  reportProblems,
  resultProblems,
  reviewProblems,
} from '../policies/orders-policies';
import { OrdersRepository } from '../ports/orders.repository';

function requireUuid(value: string, what: string): string {
  const id = value.trim();
  if (!isUuid(id)) throw new AppError('validation', `${what} must be a UUID`);
  return id;
}

export class CreateOrder {
  constructor(private readonly repository: OrdersRepository) {}

  execute(order: NewOrder): Promise<LabOrder> {
    const problems = orderProblems(order.patientId, order.testTypeIds, order.notes ?? '');
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.createOrder({
      ...order,
      patientId: order.patientId.trim(),
      testTypeIds: order.testTypeIds.map((id) => id.trim()),
      notes: order.notes?.trim() || null,
    });
  }
}

export class GetOrder {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string): Promise<LabOrder> {
    return this.repository.getOrder(requireUuid(orderId, 'order id'));
  }
}

export class ListOrderResults {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string): Promise<LabResult[]> {
    return this.repository.listResults(requireUuid(orderId, 'order id'));
  }
}

export class RecordResults {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string, detailId: string, results: readonly NewResult[]): Promise<LabOrder> {
    const problems = resultProblems(results);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.recordResults(
      requireUuid(orderId, 'order id'),
      requireUuid(detailId, 'test detail id'),
      results,
    );
  }
}

export class UploadReport {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string, file: File): Promise<UploadedReport> {
    const problems = reportProblems(file);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.uploadReport(requireUuid(orderId, 'order id'), file);
  }
}

export class EvaluateOrder {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string): Promise<Proposal> {
    return this.repository.evaluate(requireUuid(orderId, 'order id'));
  }
}

export class GetProposal {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string): Promise<Proposal | null> {
    return this.repository.getProposal(requireUuid(orderId, 'order id'));
  }
}

export class DecideProposal {
  constructor(private readonly repository: OrdersRepository) {}

  execute(proposalId: string, decision: Decision, text: string): Promise<void> {
    const problems = decisionProblems(decision, text);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.decide(requireUuid(proposalId, 'proposal id'), decision, text.trim());
  }
}

export class ReviewOrder {
  constructor(private readonly repository: OrdersRepository) {}

  execute(orderId: string, conclusion: string, recommendations: string): Promise<void> {
    const problems = reviewProblems(conclusion, recommendations);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.reviewOrder(
      requireUuid(orderId, 'order id'),
      conclusion.trim(),
      recommendations.trim() || null,
    );
  }
}
