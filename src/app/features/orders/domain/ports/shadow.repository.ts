import {
  EditableFinding,
  NewShadowEdit,
  ShadowEdit,
  ShadowReport,
  ShadowSnapshot,
} from '../entities/shadow';

/** Port to the shadow-findings API of the ordering doctor. Implementations throw `AppError`. */
export abstract class ShadowRepository {
  /** Live read: nothing is stored. */
  abstract getReport(orderId: string): Promise<ShadowReport>;
  /** Freezes the findings with their evidence. Every call creates a new snapshot. */
  abstract recordSnapshot(orderId: string): Promise<ShadowSnapshot>;
  /** Appends one physician action. Returns the category that was stored. */
  abstract editFinding(
    orderId: string,
    snapshotId: string,
    finding: EditableFinding,
    edit: NewShadowEdit,
  ): Promise<string>;
  /** Oldest first, as the backend keeps them. */
  abstract listEdits(
    orderId: string,
    snapshotId: string,
    finding: EditableFinding,
  ): Promise<ShadowEdit[]>;
}
