import { Injectable } from '@nestjs/common';
import { isWorld } from './account-path';
import {
  Balances,
  DuplicateReferenceError,
  InsufficientFundsError,
  LedgerNotFoundError,
  LedgerPort,
  LedgerTransaction,
  NewTransaction,
} from './ledger.types';

interface LedgerState {
  transactions: LedgerTransaction[];
  /** cuenta -> asset -> saldo */
  balances: Map<string, Map<string, bigint>>;
  references: Set<string>;
}

/**
 * Ledger de partida doble en memoria. Reproduce las reglas de Formance que nos
 * importan: transacciones atómicas, `world` puede quedar en negativo, el resto
 * de cuentas no puede sobregirarse, y las referencias son idempotentes.
 */
@Injectable()
export class InMemoryLedger implements LedgerPort {
  private readonly ledgers = new Map<string, LedgerState>();

  async ensureLedger(ledger: string): Promise<void> {
    if (!this.ledgers.has(ledger)) {
      this.ledgers.set(ledger, { transactions: [], balances: new Map(), references: new Set() });
    }
  }

  async createTransaction(ledger: string, tx: NewTransaction): Promise<LedgerTransaction> {
    const state = this.mustGet(ledger);

    if (tx.reference && state.references.has(tx.reference)) {
      throw new DuplicateReferenceError(tx.reference);
    }

    // 1) Efecto neto de la transacción completa, sin tocar el estado real.
    const delta = new Map<string, Map<string, bigint>>();
    for (const p of tx.postings) {
      this.add(delta, p.source, p.asset, -p.amount);
      this.add(delta, p.destination, p.asset, p.amount);
    }

    // 2) Validar que ninguna cuenta (salvo world) quede en negativo. Todo o nada.
    for (const [account, assets] of delta) {
      if (isWorld(account)) continue;
      for (const [asset, change] of assets) {
        const current = state.balances.get(account)?.get(asset) ?? 0n;
        if (current + change < 0n) throw new InsufficientFundsError(account, asset);
      }
    }

    // 3) Confirmar.
    for (const [account, assets] of delta) {
      for (const [asset, change] of assets) this.add(state.balances, account, asset, change);
    }
    const stored: LedgerTransaction = {
      id: state.transactions.length,
      reference: tx.reference,
      timestamp: new Date(),
      postings: tx.postings.map((p) => ({ ...p })),
      metadata: { ...(tx.metadata ?? {}) },
    };
    state.transactions.push(stored);
    if (tx.reference) state.references.add(tx.reference);
    return stored;
  }

  async getBalances(ledger: string, account: string): Promise<Balances> {
    const state = this.mustGet(ledger);
    const out: Balances = {};
    for (const [asset, value] of state.balances.get(account) ?? []) out[asset] = value;
    return out;
  }

  async listTransactions(ledger: string, filter?: { account?: string }): Promise<LedgerTransaction[]> {
    const { transactions } = this.mustGet(ledger);
    const account = filter?.account;
    const selected = account
      ? transactions.filter((t) => t.postings.some((p) => p.source === account || p.destination === account))
      : transactions;
    return selected.map((t) => ({ ...t, postings: t.postings.map((p) => ({ ...p })) }));
  }

  /** Solo para pruebas: suma de todos los saldos por asset. En partida doble SIEMPRE es 0. */
  trialBalance(ledger: string): Record<string, bigint> {
    const totals: Record<string, bigint> = {};
    for (const assets of this.mustGet(ledger).balances.values()) {
      for (const [asset, value] of assets) totals[asset] = (totals[asset] ?? 0n) + value;
    }
    return totals;
  }

  private mustGet(ledger: string): LedgerState {
    const state = this.ledgers.get(ledger);
    if (!state) throw new LedgerNotFoundError(ledger);
    return state;
  }

  private add(target: Map<string, Map<string, bigint>>, account: string, asset: string, amount: bigint) {
    const assets = target.get(account) ?? new Map<string, bigint>();
    assets.set(asset, (assets.get(asset) ?? 0n) + amount);
    target.set(account, assets);
  }
}
