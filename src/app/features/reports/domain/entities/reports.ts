// Read-only figures for the administrator: the period summary and the replication state. The backend
// answers in Spanish field names; the repository translates them to these English shapes.

/** A count of records in one state (estado). */
export interface StateCount {
  readonly state: string;
  readonly total: number;
}

/** Payments of one state: how many, and their amount as the backend writes it (two decimals, text). */
export interface PaymentTotal {
  readonly state: string;
  readonly total: number;
  readonly amount: string;
}

export interface ReportSummary {
  readonly from: string;
  readonly to: string;
  readonly appointments: readonly StateCount[];
  readonly labOrders: readonly StateCount[];
  readonly payments: readonly PaymentTotal[];
  readonly treatments: readonly StateCount[];
}

/** Replication state of one destination: deliveries by state, and the age of its oldest pending one. */
export interface ReplicationDestination {
  readonly code: string;
  readonly deliveries: readonly StateCount[];
  readonly oldestPendingAt: string | null;
  readonly lastDeliveryAt: string | null;
}

export interface MonitoringStatus {
  readonly checkedAt: string;
  readonly databaseLatencyMs: number;
  readonly destinations: readonly ReplicationDestination[];
}
