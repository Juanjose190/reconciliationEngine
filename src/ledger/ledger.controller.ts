import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../common/role.enum';
import { CreateTransactionDto, MovementDto } from './ledger.dto';
import { LedgerService } from './ledger.service';
import { Balances, LedgerTransaction } from './ledger.types';

const serializeTx = (t: LedgerTransaction) => ({
  id: t.id,
  reference: t.reference ?? null,
  timestamp: t.timestamp.toISOString(),
  metadata: t.metadata,
  postings: t.postings.map((p) => ({ ...p, amount: p.amount.toString() })),
});

const serializeBalances = (b: Balances) =>
  Object.fromEntries(Object.entries(b).map(([asset, v]) => [asset, v.toString()]));

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('transactions')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async create(@CurrentUser() me: JwtPayload, @Body() dto: CreateTransactionDto) {
    const tx = await this.ledger.post(me.tenantSlug, me.sub, {
      reference: dto.reference,
      metadata: dto.metadata,
      postings: dto.postings.map((p) => ({ ...p, amount: BigInt(p.amount) })),
    });
    return serializeTx(tx);
  }

  /** world → cuenta: ingreso de dinero externo al sistema. */
  @Post('fund')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async fund(@CurrentUser() me: JwtPayload, @Body() dto: MovementDto) {
    return serializeTx(await this.ledger.fund(me.tenantSlug, me.sub, { ...dto, amount: BigInt(dto.amount) }));
  }

  /** cuenta → world: salida de dinero hacia el exterior. */
  @Post('withdraw')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async withdraw(@CurrentUser() me: JwtPayload, @Body() dto: MovementDto) {
    return serializeTx(await this.ledger.withdraw(me.tenantSlug, me.sub, { ...dto, amount: BigInt(dto.amount) }));
  }

  @Get('world')
  async world(@CurrentUser() me: JwtPayload) {
    return { account: 'world', balances: serializeBalances(await this.ledger.worldBalance(me.tenantSlug)) };
  }

  @Get('transactions')
  async all(@CurrentUser() me: JwtPayload) {
    return (await this.ledger.history(me.tenantSlug)).map(serializeTx);
  }

  @Get('accounts/:address/balances')
  async balances(@CurrentUser() me: JwtPayload, @Param('address') address: string) {
    return { account: address, balances: serializeBalances(await this.ledger.balances(me.tenantSlug, address)) };
  }

  @Get('accounts/:address/transactions')
  async history(@CurrentUser() me: JwtPayload, @Param('address') address: string) {
    return (await this.ledger.history(me.tenantSlug, address)).map(serializeTx);
  }
}
