import {
  Decision,
  LabOrder,
  NewOrder,
  LabResult,
  NewResult,
  OrderSummary,
  Proposal,
  UploadedReport,
} from '../entities/orders';

/** Port to the laboratory and clinical-proposal API. Implementations throw `AppError`. */
export abstract class OrdersRepository {
  abstract createOrder(order: NewOrder): Promise<LabOrder>;
  /** The orders the caller may read, newest first. A doctor sees the ones they placed. */
  abstract listOrders(): Promise<OrderSummary[]>;
  abstract getOrder(orderId: string): Promise<LabOrder>;
  abstract listResults(orderId: string): Promise<LabResult[]>;
  abstract recordResults(
    orderId: string,
    detailId: string,
    results: readonly NewResult[],
  ): Promise<LabOrder>;
  abstract uploadReport(orderId: string, file: File): Promise<UploadedReport>;
  abstract evaluate(orderId: string): Promise<Proposal>;
  /** Null when the order has no proposal yet. */
  abstract getProposal(orderId: string): Promise<Proposal | null>;
  abstract decide(proposalId: string, decision: Decision, text: string): Promise<void>;
  abstract reviewOrder(
    orderId: string,
    conclusion: string,
    recommendations: string | null,
  ): Promise<void>;
}
