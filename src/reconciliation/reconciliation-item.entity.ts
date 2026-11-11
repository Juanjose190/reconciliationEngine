import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ItemState {
  MATCHED = 'MATCHED',
  BREAK = 'BREAK',
  PENDING = 'PENDING',
}

export enum BreakType {
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  MISSING_IN_EXTERNAL = 'MISSING_IN_EXTERNAL',
  MISSING_IN_LEDGER = 'MISSING_IN_LEDGER',
  DUPLICATE_EXTERNAL = 'DUPLICATE_EXTERNAL',
  DUPLICATE_LEDGER = 'DUPLICATE_LEDGER',
  ASSET_MISMATCH = 'ASSET_MISMATCH',
  TIMING_OFFSET = 'TIMING_OFFSET',
  UNKNOWN = 'UNKNOWN',
}

export enum ResolutionStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum ResolutionAction {
  ACCEPT_LEDGER = 'ACCEPT_LEDGER',
  ACCEPT_EXTERNAL = 'ACCEPT_EXTERNAL',
  ADJUST = 'ADJUST',
  IGNORE = 'IGNORE',
}

@Entity('reconciliation_items')
@Index(['tenantId', 'runId'])
@Index(['tenantId', 'state'])
export class ReconciliationItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 36 })
  runId!: string;

  @Column({ type: 'varchar', length: 16 })
  state!: ItemState;

  @Column({ type: 'varchar', length: 32, nullable: true })
  breakType!: BreakType | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  ledgerTxId!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  externalTxId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  asset!: string | null;

  /** Monto en el ledger como texto (bigint serializado). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  ledgerAmount!: string | null;

  /** Monto en la fuente externa como texto. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  externalAmount!: string | null;

  /** Diferencia calculada (ledger - external) como texto. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  difference!: string | null;

  @Column({ type: 'text', nullable: true })
  probableCause!: string | null;

  @CreateDateColumn()
  detectedAt!: Date;

  // --- Campos de resolución (Sprint 5) ---

  @Column({ type: 'varchar', length: 16, default: ResolutionStatus.OPEN })
  resolutionStatus!: ResolutionStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resolvedBy!: string | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  resolutionAction!: ResolutionAction | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote!: string | null;
}
