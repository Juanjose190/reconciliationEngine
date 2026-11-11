import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ExternalTxStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity('external_transactions')
@Index(['tenantId', 'chain', 'txHash'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'asset'])
export class ExternalTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64 })
  chain!: string;

  @Column({ type: 'varchar', length: 128 })
  txHash!: string;

  @Column({ type: 'varchar', length: 128 })
  fromAddress!: string;

  @Column({ type: 'varchar', length: 128 })
  toAddress!: string;

  @Column({ type: 'varchar', length: 32 })
  asset!: string;

  /** Monto en la unidad mínima del asset, almacenado como texto para no perder precisión. */
  @Column({ type: 'varchar', length: 40 })
  amount!: string;

  @Column({ type: 'datetime' })
  observedAt!: Date;

  @Column({ type: 'int', default: 0 })
  confirmations!: number;

  @Column({ type: 'varchar', length: 16 })
  status!: ExternalTxStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  scenarioId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  raw!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
