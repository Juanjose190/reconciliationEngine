import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalTransaction, ExternalTxStatus } from './external-transaction.entity';

export interface ExternalTxFilter {
  asset?: string;
  fromAddress?: string;
  toAddress?: string;
  status?: ExternalTxStatus;
  from?: Date;
  to?: Date;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

@Injectable()
export class ExternalService {
  constructor(
    @InjectRepository(ExternalTransaction)
    private readonly repo: Repository<ExternalTransaction>,
  ) {}

  async save(tx: Partial<ExternalTransaction>): Promise<ExternalTransaction> {
    return this.repo.save(this.repo.create(tx));
  }

  async saveMany(txs: Partial<ExternalTransaction>[]): Promise<ExternalTransaction[]> {
    const entities = txs.map((tx) => this.repo.create(tx));
    return this.repo.save(entities);
  }

  async list(
    tenantId: string,
    filter: ExternalTxFilter = {},
    pagination: PaginationParams = { limit: 50, offset: 0 },
  ): Promise<{ data: ExternalTransaction[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('et')
      .where('et.tenantId = :tenantId', { tenantId });

    if (filter.asset) qb.andWhere('et.asset = :asset', { asset: filter.asset });
    if (filter.fromAddress) qb.andWhere('et.fromAddress = :fromAddress', { fromAddress: filter.fromAddress });
    if (filter.toAddress) qb.andWhere('et.toAddress = :toAddress', { toAddress: filter.toAddress });
    if (filter.status) qb.andWhere('et.status = :status', { status: filter.status });
    if (filter.from) qb.andWhere('et.observedAt >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('et.observedAt <= :to', { to: filter.to });

    qb.orderBy('et.observedAt', 'ASC').addOrderBy('et.id', 'ASC');
    qb.skip(pagination.offset).take(pagination.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findByTenantAndHash(tenantId: string, txHash: string): Promise<ExternalTransaction | null> {
    return this.repo.findOne({ where: { tenantId, txHash } });
  }

  async listByTenantAndPeriod(
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
    offset: number,
  ): Promise<ExternalTransaction[]> {
    return this.repo
      .createQueryBuilder('et')
      .where('et.tenantId = :tenantId', { tenantId })
      .andWhere('et.observedAt >= :from', { from })
      .andWhere('et.observedAt <= :to', { to })
      .orderBy('et.observedAt', 'ASC')
      .addOrderBy('et.id', 'ASC')
      .skip(offset)
      .take(limit)
      .getMany();
  }

  async countByTenantAndPeriod(tenantId: string, from: Date, to: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('et')
      .where('et.tenantId = :tenantId', { tenantId })
      .andWhere('et.observedAt >= :from', { from })
      .andWhere('et.observedAt <= :to', { to })
      .getCount();
  }
}
