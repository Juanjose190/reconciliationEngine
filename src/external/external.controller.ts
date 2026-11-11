import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PaginatedResponse } from '../common/pagination.dto';
import { ExternalTxQueryDto } from './external.dto';
import { ExternalTransaction } from './external-transaction.entity';
import { ExternalService } from './external.service';

const serialize = (tx: ExternalTransaction) => ({
  id: tx.id,
  chain: tx.chain,
  txHash: tx.txHash,
  fromAddress: tx.fromAddress,
  toAddress: tx.toAddress,
  asset: tx.asset,
  amount: tx.amount,
  observedAt: tx.observedAt instanceof Date ? tx.observedAt.toISOString() : tx.observedAt,
  confirmations: tx.confirmations,
  status: tx.status,
  scenarioId: tx.scenarioId,
});

@Controller('external')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExternalController {
  constructor(private readonly external: ExternalService) {}

  @Get('transactions')
  async list(
    @CurrentUser() me: JwtPayload,
    @Query() query: ExternalTxQueryDto,
  ): Promise<PaginatedResponse<ReturnType<typeof serialize>>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { data, total } = await this.external.list(
      me.tenantId,
      {
        asset: query.asset,
        fromAddress: query.fromAddress,
        toAddress: query.toAddress,
        status: query.status,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { limit, offset },
    );
    return { data: data.map(serialize), page: { limit, offset, total } };
  }
}
