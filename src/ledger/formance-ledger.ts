import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountWithBalances,
  Balances,
  DuplicateReferenceError,
  InsufficientFundsError,
  LedgerNotFoundError,
  LedgerPort,
  LedgerTransaction,
  NewTransaction,
  Posting,
} from './ledger.types';

/**
 * Adaptador HTTP para Formance Ledger v2.
 *
 * AVISO: escrito contra la API v2 documentada, pero NO verificado contra una
 * instancia real de Formance (no hay una disponible en el entorno de desarrollo).
 * Antes de usarlo, correr un smoke test contra tu servidor:
 *   LEDGER_DRIVER=formance FORMANCE_URL=http://localhost:3068
 */
@Injectable()
export class FormanceLedger implements LedgerPort {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('FORMANCE_URL', 'http://localhost:3068').replace(/\/$/, '');
  }

  async ensureLedger(ledger: string): Promise<void> {
    const res = await this.call('POST', `/api/ledger/v2/${encodeURIComponent(ledger)}`, {});
    if (res.ok) return;
    const body = await this.safeJson(res);
    if (body?.errorCode === 'LEDGER_ALREADY_EXISTS') return;
    throw new Error(`Formance: no se pudo crear el ledger (${res.status})`);
  }

  async createTransaction(ledger: string, tx: NewTransaction): Promise<LedgerTransaction> {
    const body = {
      reference: tx.reference,
      metadata: tx.metadata ?? {},
      postings: tx.postings.map((p) => ({
        source: p.source,
        destination: p.destination,
        asset: p.asset,
        amount: this.toSafeNumber(p.amount),
      })),
    };
    const res = await this.call('POST', `/api/ledger/v2/${encodeURIComponent(ledger)}/transactions`, body);
    if (!res.ok) {
      const err = await this.safeJson(res);
      if (err?.errorCode === 'INSUFFICIENT_FUND') {
        const first = tx.postings[0];
        throw new InsufficientFundsError(first.source, first.asset);
      }
      if (err?.errorCode === 'CONFLICT' && tx.reference) throw new DuplicateReferenceError(tx.reference);
      if (res.status === 404) throw new LedgerNotFoundError(ledger);
      throw new Error(`Formance: transacción rechazada (${res.status} ${err?.errorCode ?? ''})`);
    }
    return this.mapTransaction(((await res.json()) as any).data);
  }

  async getBalances(ledger: string, account: string): Promise<Balances> {
    const res = await this.call(
      'GET',
      `/api/ledger/v2/${encodeURIComponent(ledger)}/accounts/${encodeURIComponent(account)}?expand=volumes`,
    );
    if (res.status === 404) return {};
    if (!res.ok) throw new Error(`Formance: no se pudo leer la cuenta (${res.status})`);
    const volumes = ((await res.json()) as any).data?.volumes ?? {};
    const out: Balances = {};
    for (const [asset, v] of Object.entries<any>(volumes)) out[asset] = BigInt(v.balance);
    return out;
  }

  async listTransactions(ledger: string, filter?: { account?: string }): Promise<LedgerTransaction[]> {
    const result: LedgerTransaction[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (filter?.account) params.set('account', filter.account);
      if (cursor) params.set('cursor', cursor);
      const res = await this.call('GET', `/api/ledger/v2/${encodeURIComponent(ledger)}/transactions?${params}`);
      if (!res.ok) throw new Error(`Formance: no se pudo listar transacciones (${res.status})`);
      const page = ((await res.json()) as any).data;
      for (const t of page?.data ?? []) result.push(this.mapTransaction(t));
      cursor = page?.hasMore ? page.next : undefined;
    } while (cursor);
    return result;
  }

  async listAccounts(ledger: string): Promise<AccountWithBalances[]> {
    const result: AccountWithBalances[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({ pageSize: '100', expand: 'volumes' });
      if (cursor) params.set('cursor', cursor);
      const res = await this.call('GET', `/api/ledger/v2/${encodeURIComponent(ledger)}/accounts?${params}`);
      if (!res.ok) throw new Error(`Formance: no se pudo listar cuentas (${res.status})`);
      const page = ((await res.json()) as any).data;
      for (const a of page?.data ?? []) {
        const balances: Balances = {};
        for (const [asset, v] of Object.entries<any>(a.volumes ?? {})) {
          balances[asset] = BigInt(v.balance);
        }
        result.push({ address: a.address, balances });
      }
      cursor = page?.hasMore ? page.next : undefined;
    } while (cursor);
    return result.sort((a, b) => a.address.localeCompare(b.address));
  }

  private mapTransaction(raw: any): LedgerTransaction {
    return {
      id: Number(raw.id),
      reference: raw.reference || undefined,
      timestamp: new Date(raw.timestamp),
      metadata: raw.metadata ?? {},
      postings: (raw.postings ?? []).map(
        (p: any): Posting => ({
          source: p.source,
          destination: p.destination,
          asset: p.asset,
          amount: BigInt(p.amount),
        }),
      ),
    };
  }

  private toSafeNumber(value: bigint): number {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Monto demasiado grande para enviarse como número JSON a Formance');
    }
    return Number(value);
  }

  private call(method: string, path: string, body?: unknown) {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async safeJson(res: Response): Promise<any | null> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
