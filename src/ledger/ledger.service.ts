import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { validateAccount, validateAsset, WORLD } from './account-path';
import {
  AccountWithBalances,
  Balances,
  DuplicateReferenceError,
  InsufficientFundsError,
  LEDGER_PORT,
  LedgerPort,
  LedgerTransaction,
  Posting,
} from './ledger.types';

export interface PostTransactionInput {
  reference?: string;
  postings: Posting[];
  metadata?: Record<string, string>;
}

/**
 * Operaciones contables de un tenant. El nombre del ledger se deriva SIEMPRE
 * del slug firmado en el JWT, nunca de un dato enviado por el cliente.
 */
@Injectable()
export class LedgerService {
  private readonly ready = new Set<string>();

  constructor(@Inject(LEDGER_PORT) private readonly port: LedgerPort) {}

  static ledgerName(tenantSlug: string): string {
    return `tenant-${tenantSlug}`;
  }

  async ensureLedgerFor(tenantSlug: string): Promise<string> {
    const name = LedgerService.ledgerName(tenantSlug);
    if (!this.ready.has(name)) {
      await this.port.ensureLedger(name);
      this.ready.add(name);
    }
    return name;
  }

  /** HU 2.1: registrar una transacción balanceada por construcción (cada posting debita y acredita el mismo monto). */
  async post(tenantSlug: string, userId: string, input: PostTransactionInput): Promise<LedgerTransaction> {
    this.assertValid(input);
    const ledger = await this.ensureLedgerFor(tenantSlug);
    try {
      return await this.port.createTransaction(ledger, {
        reference: input.reference,
        postings: input.postings,
        metadata: { ...(input.metadata ?? {}), postedBy: userId },
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  /** HU 2.3: el World Account es la contraparte del dinero que entra al sistema desde fuera. */
  fund(
    tenantSlug: string,
    userId: string,
    input: { account: string; asset: string; amount: bigint; reference?: string },
  ) {
    return this.post(tenantSlug, userId, {
      reference: input.reference,
      postings: [{ source: WORLD, destination: input.account, asset: input.asset, amount: input.amount }],
      metadata: { kind: 'fund' },
    });
  }

  /** Retiro hacia el exterior: devuelve el dinero al World Account. */
  withdraw(
    tenantSlug: string,
    userId: string,
    input: { account: string; asset: string; amount: bigint; reference?: string },
  ) {
    return this.post(tenantSlug, userId, {
      reference: input.reference,
      postings: [{ source: input.account, destination: WORLD, asset: input.asset, amount: input.amount }],
      metadata: { kind: 'withdraw' },
    });
  }

  async balances(tenantSlug: string, account: string): Promise<Balances> {
    this.assertAccount(account);
    const ledger = await this.ensureLedgerFor(tenantSlug);
    return this.port.getBalances(ledger, account);
  }

  /** `world` en negativo = total de dinero que ha entrado al sistema desde fuera. */
  worldBalance(tenantSlug: string): Promise<Balances> {
    return this.balances(tenantSlug, WORLD);
  }

  async listAccounts(tenantSlug: string): Promise<AccountWithBalances[]> {
    const ledger = await this.ensureLedgerFor(tenantSlug);
    return this.port.listAccounts(ledger);
  }

  /** HU 2.4: historial completo (trazabilidad) de una cuenta, o de todo el ledger. */
  async history(tenantSlug: string, account?: string): Promise<LedgerTransaction[]> {
    if (account) this.assertAccount(account);
    const ledger = await this.ensureLedgerFor(tenantSlug);
    return this.port.listTransactions(ledger, account ? { account } : undefined);
  }

  // ---------- validación ----------

  private assertAccount(account: string) {
    const error = validateAccount(account);
    if (error) throw new BadRequestException(error);
  }

  private assertValid(input: PostTransactionInput) {
    if (!input.postings || input.postings.length === 0) {
      throw new BadRequestException('La transacción necesita al menos un posting');
    }
    for (const p of input.postings) {
      this.assertAccount(p.source);
      this.assertAccount(p.destination);
      const assetError = validateAsset(p.asset);
      if (assetError) throw new BadRequestException(assetError);
      if (p.source === p.destination) {
        throw new BadRequestException('El origen y el destino no pueden ser la misma cuenta');
      }
      if (typeof p.amount !== 'bigint' || p.amount <= 0n) {
        throw new BadRequestException('El monto debe ser un entero positivo (unidad mínima del asset)');
      }
    }
    if (input.reference !== undefined && !/^[\w.:-]{1,128}$/.test(input.reference)) {
      throw new BadRequestException('Referencia inválida (1-128 caracteres: letras, números, . _ : -)');
    }
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      if (typeof v !== 'string' || v.length > 256 || k.length > 64) {
        throw new BadRequestException('metadata solo admite textos cortos (clave ≤64, valor ≤256)');
      }
    }
  }

  private translate(err: unknown): Error {
    if (err instanceof InsufficientFundsError) return new UnprocessableEntityException(err.message);
    if (err instanceof DuplicateReferenceError) return new ConflictException(err.message);
    return err as Error;
  }
}
