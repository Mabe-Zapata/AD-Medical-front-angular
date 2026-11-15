import { ResultsFormDraft } from './widgets/results-form';

/** A results form not sent yet, for one order. Kept in this browser tab only; the server never sees it. */
export interface ResultsDraft extends ResultsFormDraft {
  readonly orderId: string;
}

const PREFIX = 'medilo.results-draft.';

/** Storage can be blocked or full: a draft is a convenience, so every access is guarded. */
export function readResultsDraft(orderId: string): ResultsDraft | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + orderId);
    return raw ? (JSON.parse(raw) as ResultsDraft) : null;
  } catch {
    return null;
  }
}

export function writeResultsDraft(draft: ResultsDraft): boolean {
  try {
    sessionStorage.setItem(PREFIX + draft.orderId, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearResultsDraft(orderId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + orderId);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
