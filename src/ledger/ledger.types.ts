/** Un movimiento atómico: `amount` sale de `source` y entra en `destination`. */
export interface Posting {
  source: string;
  destination: string;
  /** Formato UNIDAD/DECIMALES, p. ej. "USD/2", "COP/2", "BTC/8". Los montos son enteros en la unidad mínima. */
  asset: string;
  amount: bigint;
}

export interface NewTransaction {
  /** Clave de idempotencia: repetir una referencia en el mismo ledger falla. */
  reference?: string;
  postings: Posting[];
  metadata?: Record<string, string>;
}

export interface LedgerTransaction {
  id: number;
  reference?: string;
  timestamp: Date;
  postings: Posting[];
  metadata: Record<string, string>;
}

/** asset -> saldo (entrada - salida). `world` suele estar en negativo. */
export type Balances = Record<string, bigint>;

/**
 * Puerto de ledger. La aplicación solo conoce esta interfaz; el motor real
 * (Formance Ledger) o el de memoria se eligen con LEDGER_DRIVER.
 * Un ledger por tenant: el aislamiento contable es total, no solo lógico.
 */
export interface AccountWithBalances {
  address: string;
  balances: Balances;
}

export interface LedgerPort {
  ensureLedger(ledger: string): Promise<void>;
  createTransaction(ledger: string, tx: NewTransaction): Promise<LedgerTransaction>;
  getBalances(ledger: string, account: string): Promise<Balances>;
  listTransactions(ledger: string, filter?: { account?: string }): Promise<LedgerTransaction[]>;
  listAccounts(ledger: string): Promise<AccountWithBalances[]>;
}

export const LEDGER_PORT = Symbol('LEDGER_PORT');

export class InsufficientFundsError extends Error {
  constructor(public readonly account: string, public readonly asset: string) {
    super(`Fondos insuficientes en la cuenta ${account} (${asset})`);
  }
}

export class DuplicateReferenceError extends Error {
  constructor(public readonly reference: string) {
    super(`La referencia ${reference} ya fue usada`);
  }
}

export class LedgerNotFoundError extends Error {
  constructor(public readonly ledger: string) {
    super(`El ledger ${ledger} no existe`);
  }
}
