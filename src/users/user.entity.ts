import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../common/role.enum';

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Columna discriminadora: TODA consulta de usuarios debe filtrar por ella. */
  @Index()
  @Column({ type: 'varchar', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: Role;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
