export enum DiscrepancyType {
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  MISSING_IN_EXTERNAL = 'MISSING_IN_EXTERNAL',
  MISSING_IN_LEDGER = 'MISSING_IN_LEDGER',
  DUPLICATE_EXTERNAL = 'DUPLICATE_EXTERNAL',
  DUPLICATE_LEDGER = 'DUPLICATE_LEDGER',
  ASSET_MISMATCH = 'ASSET_MISMATCH',
  TIMING_OFFSET = 'TIMING_OFFSET',
  UNCONFIRMED = 'UNCONFIRMED',
}

export const ALL_DISCREPANCY_TYPES = Object.values(DiscrepancyType);

export interface DiscrepancyCounts {
  AMOUNT_MISMATCH?: number;
  MISSING_IN_EXTERNAL?: number;
  MISSING_IN_LEDGER?: number;
  DUPLICATE_EXTERNAL?: number;
  DUPLICATE_LEDGER?: number;
  ASSET_MISMATCH?: number;
  TIMING_OFFSET?: number;
  UNCONFIRMED?: number;
}

export interface ScenarioSummary {
  scenarioId: string;
  seed: number;
  totalGenerated: number;
  healthy: number;
  discrepancies: Record<string, number>;
  injected: InjectedDiscrepancy[];
}

export interface InjectedDiscrepancy {
  txHash: string;
  type: DiscrepancyType;
  detail: string;
}
