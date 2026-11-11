import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../common/role.enum';
import { LedgerService } from '../ledger/ledger.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Crea el tenant y su primer ADMIN de forma atómica. Después prepara su
   * ledger; si el ledger no responde, el tenant queda creado y el ledger se
   * crea de forma perezosa en la primera operación contable (ensureLedger es idempotente).
   */
  async create(input: { slug: string; name: string; adminEmail: string; adminPassword: string }) {
    const slugTaken = await this.tenants.findOne({ where: { slug: input.slug } });
    if (slugTaken) throw new ConflictException('Ya existe un tenant con ese slug');

    const passwordHash = await UsersService.hashPassword(input.adminPassword);

    const { tenant, admin } = await this.dataSource.transaction(async (manager) => {
      const tenant = await manager.save(
        manager.create(Tenant, { slug: input.slug, name: input.name }),
      );
      const admin = await manager.save(
        manager.create(User, {
          tenantId: tenant.id,
          email: input.adminEmail.trim().toLowerCase(),
          passwordHash,
          role: Role.ADMIN,
        }),
      );
      return { tenant, admin };
    });

    try {
      await this.ledger.ensureLedgerFor(tenant.slug);
    } catch (err) {
      this.logger.warn(`Ledger del tenant ${tenant.slug} pendiente: ${(err as Error).message}`);
    }

    return { tenant, admin: UsersService.toPublic(admin) };
  }

  findActiveBySlug(slug: string): Promise<Tenant | null> {
    return this.tenants.findOne({ where: { slug, active: true } });
  }
}
