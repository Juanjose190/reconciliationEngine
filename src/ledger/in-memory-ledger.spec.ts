import { validateAccount, validateAsset, WORLD } from './account-path';
import { InMemoryLedger } from './in-memory-ledger';
import { DuplicateReferenceError, InsufficientFundsError, LedgerNotFoundError } from './ledger.types';

const L = 'tenant-test';
const post = (source: string, destination: string, amount: bigint, asset = 'USD/2') => ({
  postings: [{ source, destination, asset, amount }],
});

describe('InMemoryLedger (partida doble)', () => {
  let ledger: InMemoryLedger;

  beforeEach(async () => {
    ledger = new InMemoryLedger();
    await ledger.ensureLedger(L);
  });

  it('world puede quedar en negativo y la suma de todos los saldos siempre es 0', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 10_000n));
    await ledger.createTransaction(L, post('users:alice', 'users:bob', 2_500n));
    await ledger.createTransaction(L, post('users:bob', 'fees:platform', 100n));

    expect(await ledger.getBalances(L, WORLD)).toEqual({ 'USD/2': -10_000n });
    expect(await ledger.getBalances(L, 'users:alice')).toEqual({ 'USD/2': 7_500n });
    expect(await ledger.getBalances(L, 'users:bob')).toEqual({ 'USD/2': 2_400n });
    expect(ledger.trialBalance(L)['USD/2']).toBe(0n);
  });

  it('rechaza sobregiros de cuentas que no son world', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 100n));
    await expect(ledger.createTransaction(L, post('users:alice', 'users:bob', 101n))).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
  });

  it('es atómica: si un posting falla no se aplica ninguno', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 100n));
    await expect(
      ledger.createTransaction(L, {
        postings: [
          { source: 'users:alice', destination: 'users:bob', asset: 'USD/2', amount: 60n },
          { source: 'users:alice', destination: 'users:carol', asset: 'USD/2', amount: 60n },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(await ledger.getBalances(L, 'users:alice')).toEqual({ 'USD/2': 100n });
    expect(await ledger.getBalances(L, 'users:bob')).toEqual({});
    expect(await ledger.listTransactions(L)).toHaveLength(1);
  });

  it('permite que el dinero "pase por" una cuenta dentro de una misma transacción', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 100n));
    await ledger.createTransaction(L, {
      postings: [
        { source: 'users:alice', destination: 'banks:hub:main', asset: 'USD/2', amount: 100n },
        { source: 'banks:hub:main', destination: 'users:bob', asset: 'USD/2', amount: 100n },
      ],
    });
    expect(await ledger.getBalances(L, 'banks:hub:main')).toEqual({ 'USD/2': 0n });
    expect(await ledger.getBalances(L, 'users:bob')).toEqual({ 'USD/2': 100n });
  });

  it('mantiene saldos separados por asset', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 500n, 'USD/2'));
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 7n, 'BTC/8'));
    expect(await ledger.getBalances(L, 'users:alice')).toEqual({ 'USD/2': 500n, 'BTC/8': 7n });
    expect(ledger.trialBalance(L)).toEqual({ 'USD/2': 0n, 'BTC/8': 0n });
  });

  it('las referencias son idempotentes', async () => {
    const tx = { reference: 'dep-001', ...post(WORLD, 'users:alice', 100n) };
    await ledger.createTransaction(L, tx);
    await expect(ledger.createTransaction(L, tx)).rejects.toBeInstanceOf(DuplicateReferenceError);
    expect(await ledger.getBalances(L, 'users:alice')).toEqual({ 'USD/2': 100n });
  });

  it('el historial de una cuenta incluye solo sus movimientos, en orden', async () => {
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 100n));
    await ledger.createTransaction(L, post(WORLD, 'users:bob', 50n));
    await ledger.createTransaction(L, post('users:alice', 'users:bob', 30n));

    const alice = await ledger.listTransactions(L, { account: 'users:alice' });
    expect(alice.map((t) => t.id)).toEqual([0, 2]);
  });

  it('los ledgers están aislados entre sí', async () => {
    await ledger.ensureLedger('tenant-other');
    await ledger.createTransaction(L, post(WORLD, 'users:alice', 100n));
    expect(await ledger.getBalances('tenant-other', 'users:alice')).toEqual({});
    await expect(ledger.getBalances('no-existe', 'users:alice')).rejects.toBeInstanceOf(LedgerNotFoundError);
  });
});

describe('nomenclatura de cuentas', () => {
  it.each(['world', 'users:alice', 'banks:bancolombia:main', 'blockchain:btc:treasury', 'fees:platform'])(
    'acepta %s',
    (a) => expect(validateAccount(a)).toBeNull(),
  );

  it.each([
    ['', 'obligatoria'],
    ['alice', '2 segmentos'],
    ['users:', 'solo admite'],
    ['users:al ice', 'solo admite'],
    ['clientes:alice', 'no permitida'],
    ['users:a:b:c:d:e:f', 'niveles'],
    ['world:extra', 'no permitida'],
  ])('rechaza "%s"', (a, fragment) => expect(validateAccount(a)).toContain(fragment));

  it('valida assets', () => {
    expect(validateAsset('USD/2')).toBeNull();
    expect(validateAsset('COP/2')).toBeNull();
    expect(validateAsset('BTC/8')).toBeNull();
    expect(validateAsset('usd')).not.toBeNull();
    expect(validateAsset('USD/')).not.toBeNull();
  });
});
