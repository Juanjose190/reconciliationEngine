import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum RunTrigger {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
}

@Entity('reconciliation_runs')
@Index(['tenantId', 'status'])
export class ReconciliationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: RunStatus;

  @Column({ type: 'varchar', length: 16 })
  triggeredBy!: RunTrigger;

  @Column({ type: 'varchar', length: 36, nullable: true })
  triggeredByUserId!: string | null;

  @Column({ type: 'datetime' })
  periodFrom!: Date;

  @Column({ type: 'datetime' })
  periodTo!: Date;

  @Column({ type: 'simple-json', nullable: true })
  params!: Record<string, unknown> | null;

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  matched!: number;

  @Column({ type: 'int', default: 0 })
  breaks!: number;

  @Column({ type: 'int', default: 0 })
  pending!: number;

  @Column({ type: 'int', default: 0 })
  totalLedger!: number;

  @Column({ type: 'int', default: 0 })
  totalExternal!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
