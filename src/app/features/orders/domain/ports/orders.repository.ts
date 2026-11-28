import {
  Decision,
  LabOrder,
  NewOrder,
  LabResult,
  NewResult,
  ResultReview,
  OrderSummary,
  PatientOption,
  OrderDocument,
  TestAnalyte,
  TestTypeOption,
  WorklistOrder,
  Proposal,
  UploadedReport,
} from '../entities/orders';

/** Port to the laboratory and clinical-proposal API. Implementations throw `AppError`. */
export abstract class OrdersRepository {
  abstract createOrder(order: NewOrder): Promise<LabOrder>;
  /** The orders the caller may read, newest first. A doctor sees the ones they placed. */
  abstract listOrders(): Promise<OrderSummary[]>;
  /** Only the patients the calling doctor treats. */
  abstract listPatients(): Promise<PatientOption[]>;
  /** The active catalog of laboratory tests. */
  abstract listTestTypes(): Promise<TestTypeOption[]>;
  /** Pending orders of both origins for the laboratory, oldest first. */
  abstract listWorklist(): Promise<WorklistOrder[]>;
  /** The analytes a test asks for, in presentation order. */
  abstract listTestAnalytes(testTypeId: string): Promise<TestAnalyte[]>;
  abstract getOrder(orderId: string): Promise<LabOrder>;
  abstract listResults(orderId: string): Promise<LabResult[]>;

  abstract reviewResults(orderId: string, reviews: readonly ResultReview[]): Promise<void>;
  abstract recordResults(
    orderId: string,
    detailId: string,
    results: readonly NewResult[],
  ): Promise<LabOrder>;
  abstract uploadReport(orderId: string, file: File): Promise<UploadedReport>;
  /** The uploaded reports of an order; empty when there are none. */
  abstract listOrderDocuments(orderId: string): Promise<OrderDocument[]>;
  /** Downloads one stored PDF report as a binary blob. */
  abstract downloadDocument(documentId: string): Promise<Blob>;
  /** Closes a completed order: its results and reports can no longer change. */
  abstract confirmOrder(orderId: string): Promise<void>;
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
