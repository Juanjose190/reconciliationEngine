import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class FormanceLedger implements LedgerPort {
  private readonly logger = new Logger(FormanceLedger.name);
  private readonly baseUrl: string;
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('FORMANCE_URL', 'http://localhost:3068').replace(/\/$/, '');
    this.clientId = config.get<string>('FORMANCE_CLIENT_ID', '') || null;
    this.clientSecret = config.get<string>('FORMANCE_CLIENT_SECRET', '') || null;
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
      timestamp: tx.timestamp?.toISOString(),
      postings: tx.postings.map((p) => ({
        source: p.source,
        destination: p.destination,
        asset: p.asset,
        amount: p.amount.toString(),
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

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (!this.clientId || !this.clientSecret) return headers;

    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.refreshToken();
    }
    if (this.accessToken) {
      headers['authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  private async refreshToken(): Promise<void> {
    try {
      const tokenUrl = `${this.baseUrl}/api/auth/oauth/token`;
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
        }),
      });
      if (!res.ok) {
        this.logger.error(`Formance OAuth falló: ${res.status}`);
        this.accessToken = null;
        return;
      }
      const data = (await res.json()) as any;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
    } catch (err) {
      this.logger.error(`Formance OAuth error: ${(err as Error).message}`);
      this.accessToken = null;
    }
  }

  private async call(method: string, path: string, body?: unknown) {
    const headers = await this.getAuthHeaders();
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
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
