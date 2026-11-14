import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import {
  EditableFinding,
  NewShadowEdit,
  ShadowEdit,
  ShadowReport,
  ShadowSnapshot,
} from '../entities/shadow';
import { shadowEditProblems } from '../policies/shadow-policies';
import { ShadowRepository } from '../ports/shadow.repository';

function requireUuid(value: string, what: string): string {
  const id = value.trim();
  if (!isUuid(id)) throw new AppError('validation', `${what} must be a UUID`);
  return id;
}

export class GetShadowReport {
  constructor(private readonly repository: ShadowRepository) {}

  execute(orderId: string): Promise<ShadowReport> {
    return this.repository.getReport(requireUuid(orderId, 'order id'));
  }
}

export class RecordShadowSnapshot {
  constructor(private readonly repository: ShadowRepository) {}

  execute(orderId: string): Promise<ShadowSnapshot> {
    return this.repository.recordSnapshot(requireUuid(orderId, 'order id'));
  }
}

export class EditShadowFinding {
  constructor(private readonly repository: ShadowRepository) {}

  /** [currentCategory] is the suggestion stored in the snapshot, used to check a modification. */
  execute(
    orderId: string,
    snapshotId: string,
    finding: EditableFinding,
    currentCategory: string,
    edit: NewShadowEdit,
  ): Promise<string> {
    const problems = shadowEditProblems(finding, currentCategory, edit);
    if (problems.length > 0) throw new AppError('validation', problems.join(', '));
    return this.repository.editFinding(
      requireUuid(orderId, 'order id'),
      requireUuid(snapshotId, 'snapshot id'),
      finding,
      { ...edit, reason: edit.reason.trim() },
    );
  }
}

export class ListShadowEdits {
  constructor(private readonly repository: ShadowRepository) {}

  execute(orderId: string, snapshotId: string, finding: EditableFinding): Promise<ShadowEdit[]> {
    return this.repository.listEdits(
      requireUuid(orderId, 'order id'),
      requireUuid(snapshotId, 'snapshot id'),
      finding,
    );
  }
}
