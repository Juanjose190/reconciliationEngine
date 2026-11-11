import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExternalTransaction, ExternalTxStatus } from '../external/external-transaction.entity';
import { ExternalService } from '../external/external.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  DiscrepancyCounts,
  DiscrepancyType,
  InjectedDiscrepancy,
  ScenarioSummary,
} from './discrepancy.types';
import { Mulberry32 } from './prng';

const CHAIN = 'fakechain';
const ASSETS = ['USD/2', 'COP/2', 'BTC/8'] as const;
const USERS = ['alice', 'bob', 'carol', 'dave', 'eve'] as const;
const MAX_COUNT = 10_000;

interface TxData {
  index: number;
  txHash: string;
  user: string;
  asset: string;
  amount: bigint;
  timestamp: Date;
}

@Injectable()
export class BlockchainSimService {
  constructor(
    private readonly external: ExternalService,
    private readonly ledger: LedgerService,
  ) {}

  async runScenario(
    tenantId: string,
    tenantSlug: string,
    userId: string,
    input: {
      seed: number;
      count: number;
      discrepancies: DiscrepancyCounts;
      reference?: string;
    },
  ): Promise<ScenarioSummary> {
    const { seed, count, discrepancies } = input;

    if (count < 1 || count > MAX_COUNT) {
      throw new BadRequestException(`count debe estar entre 1 y ${MAX_COUNT}`);
    }

    const totalDisc = Object.values(discrepancies).reduce((s, n) => s + (n ?? 0), 0);
    if (totalDisc > count) {
      throw new BadRequestException(
        `La suma de discrepancias (${totalDisc}) no puede superar count (${count})`,
      );
    }

    const scenarioId = randomUUID();
    const rng = new Mulberry32(seed);
    const injected: InjectedDiscrepancy[] = [];

    const discIndexes = this.assignDiscrepancyIndexes(count, discrepancies, rng);
    const healthy = count - totalDisc;

    // Pre-generar datos
    const txDataList: TxData[] = [];
    for (let i = 0; i < count; i++) {
      txDataList.push({
        index: i,
        txHash: `0x${rng.hex(64)}`,
        user: rng.pick(USERS),
        asset: rng.pick(ASSETS),
        amount: BigInt(rng.int(100, 1_000_000)),
        timestamp: new Date(
          Date.now() - rng.int(0, 30) * 86400_000 - rng.int(0, 23) * 3600_000,
        ),
      });
    }

    // Calcular fondeo necesario por asset (incluye duplicados de ledger)
    const totalByAsset = new Map<string, bigint>();
    for (const txData of txDataList) {
      const discType = discIndexes.get(txData.index);
      if (discType === DiscrepancyType.MISSING_IN_LEDGER) continue;
      const extra = discType === DiscrepancyType.DUPLICATE_LEDGER ? txData.amount * 2n : txData.amount;
      totalByAsset.set(txData.asset, (totalByAsset.get(txData.asset) ?? 0n) + extra);
    }

    for (const [asset, total] of totalByAsset) {
      await this.ledger.fund(tenantSlug, userId, {
        account: `blockchain:${CHAIN}:treasury`,
        asset,
        amount: total,
        reference: `scenario-fund-${scenarioId}-${asset.replace('/', '_')}`,
      });
    }

    // Generar transacciones una a una (secuencial para determinismo)
    const externalBatch: Partial<ExternalTransaction>[] = [];

    for (const txData of txDataList) {
      const discType = discIndexes.get(txData.index);

      if (!discType) {
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng));
      } else {
        const detail = await this.injectDiscrepancy(
          discType,
          tenantId, tenantSlug, userId, scenarioId, txData, rng, externalBatch,
        );
        injected.push({ txHash: txData.txHash, type: discType, detail });
      }
    }

    if (externalBatch.length > 0) {
      await this.external.saveMany(externalBatch);
    }

    return {
      scenarioId,
      seed,
      totalGenerated: count,
      healthy,
      discrepancies: Object.fromEntries(
        Object.entries(discrepancies).filter(([, v]) => v && v > 0),
      ),
      injected,
    };
  }

  private async postToLedger(
    tenantSlug: string,
    userId: string,
    scenarioId: string,
    txData: TxData,
    refSuffix = '',
    externalRefOverride?: string,
  ) {
    await this.ledger.post(tenantSlug, userId, {
      reference: `sim-${scenarioId}-${txData.index}${refSuffix}`,
      postings: [{
        source: `blockchain:${CHAIN}:treasury`,
        destination: `users:${txData.user}`,
        asset: txData.asset,
        amount: txData.amount,
      }],
      metadata: {
        externalRef: externalRefOverride ?? txData.txHash,
        scenarioId,
      },
    });
  }

  private async injectDiscrepancy(
    type: DiscrepancyType,
    tenantId: string,
    tenantSlug: string,
    userId: string,
    scenarioId: string,
    txData: TxData,
    rng: Mulberry32,
    externalBatch: Partial<ExternalTransaction>[],
  ): Promise<string> {
    switch (type) {
      case DiscrepancyType.AMOUNT_MISMATCH: {
        const externalAmount = txData.amount + BigInt(rng.int(1, 1000));
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng, {
          amount: externalAmount.toString(),
        }));
        return `Ledger: ${txData.amount}, Externa: ${externalAmount}`;
      }

      case DiscrepancyType.MISSING_IN_EXTERNAL: {
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        return `txHash ${txData.txHash} solo existe en el ledger`;
      }

      case DiscrepancyType.MISSING_IN_LEDGER: {
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng));
        return `txHash ${txData.txHash} solo existe en la fuente externa`;
      }

      case DiscrepancyType.DUPLICATE_EXTERNAL: {
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng));
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng, {
          txHash: `${txData.txHash}-dup`,
        }));
        return `txHash ${txData.txHash} aparece dos veces en la fuente externa`;
      }

      case DiscrepancyType.DUPLICATE_LEDGER: {
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        await this.postToLedger(tenantSlug, userId, scenarioId, txData, '-dup', `${txData.txHash}-dup-ledger`);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng));
        return `txHash ${txData.txHash} se registró dos veces en el ledger`;
      }

      case DiscrepancyType.ASSET_MISMATCH: {
        const wrongAsset = txData.asset === 'USD/2' ? 'COP/2' : 'USD/2';
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng, {
          asset: wrongAsset,
        }));
        return `Ledger: ${txData.asset}, Externa: ${wrongAsset}`;
      }

      case DiscrepancyType.TIMING_OFFSET: {
        const offsetHours = rng.int(25, 72);
        const offsetMs = offsetHours * 3600_000;
        const offsetTime = new Date(txData.timestamp.getTime() + offsetMs);
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng, {
          observedAt: offsetTime,
        }));
        return `Desfase temporal de ${offsetHours}h`;
      }

      case DiscrepancyType.UNCONFIRMED: {
        const confs = rng.int(0, 2);
        await this.postToLedger(tenantSlug, userId, scenarioId, txData);
        externalBatch.push(this.buildExternal(tenantId, scenarioId, txData, rng, {
          confirmations: confs,
          status: ExternalTxStatus.PENDING,
        }));
        return `Transacción con solo ${confs} confirmaciones`;
      }

      default:
        return 'Tipo de discrepancia no reconocido';
    }
  }

  private buildExternal(
    tenantId: string,
    scenarioId: string,
    txData: TxData,
    rng: Mulberry32,
    overrides: Partial<{
      txHash: string;
      amount: string;
      asset: string;
      observedAt: Date;
      confirmations: number;
      status: ExternalTxStatus;
    }> = {},
  ): Partial<ExternalTransaction> {
    return {
      tenantId,
      chain: CHAIN,
      txHash: overrides.txHash ?? txData.txHash,
      fromAddress: `${CHAIN}:treasury`,
      toAddress: `${CHAIN}:${txData.user}`,
      asset: overrides.asset ?? txData.asset,
      amount: overrides.amount ?? txData.amount.toString(),
      observedAt: overrides.observedAt ?? txData.timestamp,
      confirmations: overrides.confirmations ?? rng.int(6, 100),
      status: overrides.status ?? ExternalTxStatus.CONFIRMED,
      scenarioId,
      raw: null,
    };
  }

  private assignDiscrepancyIndexes(
    count: number,
    discrepancies: DiscrepancyCounts,
    rng: Mulberry32,
  ): Map<number, DiscrepancyType> {
    const result = new Map<number, DiscrepancyType>();
    const available = Array.from({ length: count }, (_, i) => i);

    for (const [typeStr, qty] of Object.entries(discrepancies)) {
      if (!qty || qty <= 0) continue;
      const type = typeStr as DiscrepancyType;
      for (let j = 0; j < qty; j++) {
        const freeIndexes = available.filter((i) => !result.has(i));
        if (freeIndexes.length === 0) break;
        const chosen = rng.pick(freeIndexes);
        result.set(chosen, type);
      }
    }

    return result;
  }
}
