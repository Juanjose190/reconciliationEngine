import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identificador estable y legible; define también el nombre del ledger. */
  @Column({ type: 'varchar', length: 32, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
