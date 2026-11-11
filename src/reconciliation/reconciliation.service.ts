import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalTransaction, ExternalTxStatus } from '../external/external-transaction.entity';
import { ExternalService } from '../external/external.service';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerTransaction } from '../ledger/ledger.types';
import { BreakType, ItemState, ReconciliationItem, ResolutionAction, ResolutionStatus } from './reconciliation-item.entity';
import { ReconciliationRun, RunStatus, RunTrigger } from './reconciliation-run.entity';

export interface RunParams {
  toleranceWindowHours: number;
  minConfirmations: number;
  assets?: string[];
}

const DEFAULT_PARAMS: RunParams = {
  toleranceWindowHours: 24,
  minConfirmations: 3,
};

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(ReconciliationRun) private readonly runs: Repository<ReconciliationRun>,
    @InjectRepository(ReconciliationItem) private readonly items: Repository<ReconciliationItem>,
    private readonly ledger: LedgerService,
    private readonly external: ExternalService,
  ) {}

  async startRun(
    tenantId: string,
    tenantSlug: string,
    userId: string | null,
    trigger: RunTrigger,
    periodFrom: Date,
    periodTo: Date,
    params?: Partial<RunParams>,
  ): Promise<ReconciliationRun> {
    // Candado: no permitir dos corridas simultáneas del mismo tenant
    const running = await this.runs.findOne({
      where: { tenantId, status: RunStatus.RUNNING },
    });
    if (running) {
      throw new ConflictException(
        'Ya hay una corrida en ejecución para este tenant. Espera a que termine.',
      );
    }

    const mergedParams = { ...DEFAULT_PARAMS, ...params };

    const run = await this.runs.save(
      this.runs.create({
        tenantId,
        status: RunStatus.RUNNING,
        triggeredBy: trigger,
        triggeredByUserId: userId,
        periodFrom,
        periodTo,
        params: mergedParams as unknown as Record<string, unknown>,
      }),
    );

    try {
      await this.executeRun(run, tenantSlug, mergedParams);
    } catch (err) {
      run.status = RunStatus.FAILED;
      run.error = (err as Error).message;
      run.finishedAt = new Date();
      await this.runs.save(run);
      throw err;
    }

    return run;
  }

  private async executeRun(
    run: ReconciliationRun,
    tenantSlug: string,
    params: RunParams,
  ): Promise<void> {
    // Cargar transacciones del ledger del período
    const allLedgerTxs = await this.ledger.history(tenantSlug);
    const ledgerTxs = allLedgerTxs.filter(
      (t) => t.timestamp >= run.periodFrom && t.timestamp <= run.periodTo,
    );

    // Cargar transacciones externas del período
    const PAGE_SIZE = 1000;
    const externalTxs: ExternalTransaction[] = [];
    let offset = 0;
    let batch: ExternalTransaction[];
    do {
      batch = await this.external.listByTenantAndPeriod(
        run.tenantId, run.periodFrom, run.periodTo, PAGE_SIZE, offset,
      );
      externalTxs.push(...batch);
      offset += PAGE_SIZE;
    } while (batch.length === PAGE_SIZE);

    run.totalLedger = ledgerTxs.length;
    run.totalExternal = externalTxs.length;

    const results: Partial<ReconciliationItem>[] = [];

    // --- Pasada 1: correspondencia exacta por txHash ↔ metadata.externalRef ---
    const externalByHash = new Map<string, ExternalTransaction[]>();
    for (const ext of externalTxs) {
      const list = externalByHash.get(ext.txHash) ?? [];
      list.push(ext);
      externalByHash.set(ext.txHash, list);
    }

    const ledgerByRef = new Map<string, LedgerTransaction[]>();
    for (const lt of ledgerTxs) {
      const ref = lt.metadata?.externalRef;
      if (ref) {
        const list = ledgerByRef.get(ref) ?? [];
        list.push(lt);
        ledgerByRef.set(ref, list);
      }
    }

    const matchedExternalIds = new Set<string>();
    const matchedLedgerIds = new Set<number>();

    // Detectar duplicados idénticos por txHash en la fuente externa
    for (const [hash, extList] of externalByHash) {
      if (extList.length > 1) {
        for (const ext of extList) {
          const ledgerMatches = ledgerByRef.get(hash) ?? [];
          const lt = ledgerMatches[0];
          results.push(this.buildItem(run, ItemState.BREAK, BreakType.DUPLICATE_EXTERNAL, {
            txHash: hash,
            externalTxId: ext.id,
            ledgerTxId: lt ? String(lt.id) : null,
            asset: ext.asset,
            externalAmount: ext.amount,
            ledgerAmount: lt ? this.sumPostingAmounts(lt).toString() : null,
            cause: `El txHash ${hash} aparece ${extList.length} veces en la fuente externa`,
          }));
          matchedExternalIds.add(ext.id);
        }
        const lts = ledgerByRef.get(hash) ?? [];
        for (const lt of lts) matchedLedgerIds.add(lt.id);
      }
    }

    // Detectar duplicados idénticos por externalRef en el ledger
    for (const [ref, ltList] of ledgerByRef) {
      if (ltList.length > 1) {
        for (const lt of ltList) {
          const extMatches = externalByHash.get(ref);
          const ext = extMatches?.[0];
          results.push(this.buildItem(run, ItemState.BREAK, BreakType.DUPLICATE_LEDGER, {
            txHash: ref,
            ledgerTxId: String(lt.id),
            externalTxId: ext?.id ?? null,
            asset: lt.postings[0]?.asset ?? null,
            ledgerAmount: this.sumPostingAmounts(lt).toString(),
            externalAmount: ext?.amount ?? null,
            cause: `El txHash ${ref} se registró ${ltList.length} veces en el ledger`,
          }));
          matchedLedgerIds.add(lt.id);
        }
        const exts = externalByHash.get(ref);
        if (exts) for (const e of exts) matchedExternalIds.add(e.id);
      }
    }

    // Correspondencia exacta 1:1 — solo compara montos y assets (no tiempos)
    for (const [ref, ltList] of ledgerByRef) {
      if (ltList.length !== 1) continue;
      const lt = ltList[0];
      if (matchedLedgerIds.has(lt.id)) continue;

      const extList = externalByHash.get(ref);
      if (!extList || extList.length !== 1) continue;
      const ext = extList[0];
      if (matchedExternalIds.has(ext.id)) continue;

      const item = this.compareExactMatch(run, lt, ext, params);
      results.push(item);
      matchedLedgerIds.add(lt.id);
      matchedExternalIds.add(ext.id);
    }

    // --- Pasada 2: correspondencia difusa para transacciones sin referencia ---
    const unmatchedLedger = ledgerTxs.filter(
      (lt) => !matchedLedgerIds.has(lt.id) && !lt.metadata?.externalRef,
    );
    let unmatchedExternal = externalTxs.filter((ext) => !matchedExternalIds.has(ext.id));

    const fuzzyExtIndex = new Map<string, ExternalTransaction[]>();
    for (const ext of unmatchedExternal) {
      const key = `${ext.asset}:${ext.amount}`;
      const list = fuzzyExtIndex.get(key) ?? [];
      list.push(ext);
      fuzzyExtIndex.set(key, list);
    }

    for (const lt of unmatchedLedger) {
      const amount = this.sumPostingAmounts(lt);
      const asset = lt.postings[0]?.asset;
      if (!asset) continue;

      const key = `${asset}:${amount}`;
      const candidates = fuzzyExtIndex.get(key);
      if (!candidates || candidates.length === 0) continue;

      let best: ExternalTransaction | null = null;
      let bestDiff = Infinity;
      for (const c of candidates) {
        if (matchedExternalIds.has(c.id)) continue;
        const diff = Math.abs(lt.timestamp.getTime() - c.observedAt.getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = c;
        }
      }
      if (best) {
        const item = this.compareExactMatch(run, lt, best, params);
        results.push(item);
        matchedLedgerIds.add(lt.id);
        matchedExternalIds.add(best.id);
      }
    }

    // --- Pasada 3: detectar duplicados por similitud de datos ---
    // Reconstruir lista de no-emparejados
    unmatchedExternal = externalTxs.filter((ext) => !matchedExternalIds.has(ext.id));
    const unmatchedLedgerPost = ledgerTxs.filter((lt) => !matchedLedgerIds.has(lt.id));

    // Índice de txs ya emparejadas (matched) para buscar duplicados
    const matchedExtByKey = new Map<string, ExternalTransaction[]>();
    for (const ext of externalTxs) {
      if (!matchedExternalIds.has(ext.id)) continue;
      const key = `${ext.asset}:${ext.amount}:${ext.fromAddress}:${ext.toAddress}`;
      const list = matchedExtByKey.get(key) ?? [];
      list.push(ext);
      matchedExtByKey.set(key, list);
    }

    const matchedLedgerByKey = new Map<string, LedgerTransaction[]>();
    for (const lt of ledgerTxs) {
      if (!matchedLedgerIds.has(lt.id)) continue;
      if (!lt.postings[0]) continue;
      const p = lt.postings[0];
      const key = `${p.asset}:${p.amount}:${p.source}:${p.destination}`;
      const list = matchedLedgerByKey.get(key) ?? [];
      list.push(lt);
      matchedLedgerByKey.set(key, list);
    }

    // Externos huérfanos que se parecen a un emparejado → DUPLICATE_EXTERNAL
    for (const ext of unmatchedExternal) {
      const key = `${ext.asset}:${ext.amount}:${ext.fromAddress}:${ext.toAddress}`;
      const siblings = matchedExtByKey.get(key);
      if (siblings && siblings.length > 0) {
        results.push(this.buildItem(run, ItemState.BREAK, BreakType.DUPLICATE_EXTERNAL, {
          txHash: ext.txHash,
          externalTxId: ext.id,
          ledgerTxId: null,
          asset: ext.asset,
          externalAmount: ext.amount,
          ledgerAmount: null,
          cause: `Transacción externa duplicada: mismos datos (${ext.asset}, monto ${ext.amount}) que otra ya conciliada`,
        }));
        matchedExternalIds.add(ext.id);
        continue;
      }
    }

    // Ledger huérfanos que se parecen a un emparejado → DUPLICATE_LEDGER
    for (const lt of unmatchedLedgerPost) {
      if (matchedLedgerIds.has(lt.id)) continue;
      if (!lt.postings[0]) continue;
      const p = lt.postings[0];
      const key = `${p.asset}:${p.amount}:${p.source}:${p.destination}`;
      const siblings = matchedLedgerByKey.get(key);
      if (siblings && siblings.length > 0) {
        results.push(this.buildItem(run, ItemState.BREAK, BreakType.DUPLICATE_LEDGER, {
          txHash: lt.metadata?.externalRef ?? null,
          ledgerTxId: String(lt.id),
          externalTxId: null,
          asset: p.asset,
          ledgerAmount: p.amount.toString(),
          externalAmount: null,
          cause: `Asiento duplicado en el ledger: mismos datos (${p.asset}, monto ${p.amount}) que otro ya conciliado`,
        }));
        matchedLedgerIds.add(lt.id);
        continue;
      }
    }

    // Huérfanos finales: ledger sin correspondencia → MISSING_IN_EXTERNAL
    for (const lt of ledgerTxs) {
      if (matchedLedgerIds.has(lt.id)) continue;
      const ref = lt.metadata?.externalRef ?? null;
      results.push(this.buildItem(run, ItemState.BREAK, BreakType.MISSING_IN_EXTERNAL, {
        txHash: ref,
        ledgerTxId: String(lt.id),
        externalTxId: null,
        asset: lt.postings[0]?.asset ?? null,
        ledgerAmount: this.sumPostingAmounts(lt).toString(),
        externalAmount: null,
        cause: ref
          ? `Existe en el ledger (ref: ${ref}) pero no hay contraparte en la fuente externa`
          : 'Existe en el ledger sin referencia externa y no se encontró coincidencia difusa',
      }));
    }

    // Huérfanos finales: externa sin correspondencia → MISSING_IN_LEDGER
    for (const ext of externalTxs) {
      if (matchedExternalIds.has(ext.id)) continue;
      results.push(this.buildItem(run, ItemState.BREAK, BreakType.MISSING_IN_LEDGER, {
        txHash: ext.txHash,
        ledgerTxId: null,
        externalTxId: ext.id,
        asset: ext.asset,
        ledgerAmount: null,
        externalAmount: ext.amount,
        cause: `Existe en la fuente externa (txHash: ${ext.txHash}) pero no hay asiento en el ledger`,
      }));
    }

    // Guardar items en lotes
    if (results.length > 0) {
      const entities = results.map((r) => this.items.create(r));
      const BATCH = 500;
      for (let i = 0; i < entities.length; i += BATCH) {
        await this.items.save(entities.slice(i, i + BATCH));
      }
    }

    // Actualizar contadores
    run.matched = results.filter((r) => r.state === ItemState.MATCHED).length;
    run.breaks = results.filter((r) => r.state === ItemState.BREAK).length;
    run.pending = results.filter((r) => r.state === ItemState.PENDING).length;
    run.status = RunStatus.COMPLETED;
    run.finishedAt = new Date();
    await this.runs.save(run);
  }

  private compareExactMatch(
    run: ReconciliationRun,
    lt: LedgerTransaction,
    ext: ExternalTransaction,
    params: RunParams,
  ): Partial<ReconciliationItem> {
    const ledgerAmount = this.sumPostingAmounts(lt);
    const externalAmount = BigInt(ext.amount);
    const ledgerAsset = lt.postings[0]?.asset ?? '';

    // UNCONFIRMED → PENDING
    if (ext.status === ExternalTxStatus.PENDING && ext.confirmations < params.minConfirmations) {
      return this.buildItem(run, ItemState.PENDING, null, {
        txHash: ext.txHash,
        ledgerTxId: String(lt.id),
        externalTxId: ext.id,
        asset: ext.asset,
        ledgerAmount: ledgerAmount.toString(),
        externalAmount: ext.amount,
        cause: `Transacción pendiente con ${ext.confirmations} confirmaciones (mínimo requerido: ${params.minConfirmations})`,
      });
    }

    // ASSET_MISMATCH
    if (ledgerAsset !== ext.asset) {
      return this.buildItem(run, ItemState.BREAK, BreakType.ASSET_MISMATCH, {
        txHash: ext.txHash,
        ledgerTxId: String(lt.id),
        externalTxId: ext.id,
        asset: ext.asset,
        ledgerAmount: ledgerAmount.toString(),
        externalAmount: ext.amount,
        cause: `Assets distintos: el ledger registró ${ledgerAsset} y la fuente externa ${ext.asset}`,
      });
    }

    // AMOUNT_MISMATCH
    if (ledgerAmount !== externalAmount) {
      const diff = ledgerAmount - externalAmount;
      return this.buildItem(run, ItemState.BREAK, BreakType.AMOUNT_MISMATCH, {
        txHash: ext.txHash,
        ledgerTxId: String(lt.id),
        externalTxId: ext.id,
        asset: ext.asset,
        ledgerAmount: ledgerAmount.toString(),
        externalAmount: ext.amount,
        difference: diff.toString(),
        cause: `Montos distintos: el ledger registró ${ledgerAmount} y la fuente externa ${externalAmount} (diferencia: ${diff})`,
      });
    }

    // MATCHED
    return this.buildItem(run, ItemState.MATCHED, null, {
      txHash: ext.txHash,
      ledgerTxId: String(lt.id),
      externalTxId: ext.id,
      asset: ext.asset,
      ledgerAmount: ledgerAmount.toString(),
      externalAmount: ext.amount,
      cause: null,
    });
  }

  private buildItem(
    run: ReconciliationRun,
    state: ItemState,
    breakType: BreakType | null,
    data: {
      txHash: string | null;
      ledgerTxId: string | null;
      externalTxId: string | null;
      asset: string | null;
      ledgerAmount: string | null;
      externalAmount: string | null;
      difference?: string;
      cause: string | null;
    },
  ): Partial<ReconciliationItem> {
    return {
      tenantId: run.tenantId,
      runId: run.id,
      state,
      breakType,
      txHash: data.txHash,
      ledgerTxId: data.ledgerTxId,
      externalTxId: data.externalTxId,
      asset: data.asset,
      ledgerAmount: data.ledgerAmount,
      externalAmount: data.externalAmount,
      difference: data.difference ?? null,
      probableCause: data.cause,
      resolutionStatus: state === ItemState.BREAK ? ResolutionStatus.OPEN : ResolutionStatus.OPEN,
    };
  }

  private sumPostingAmounts(lt: LedgerTransaction): bigint {
    // Para la reconciliación, usamos el monto del primer posting como el monto de la tx
    // (cada tx del simulador tiene un solo posting relevante)
    if (lt.postings.length === 0) return 0n;
    return lt.postings[0].amount;
  }

  // --- Consultas ---

  async getRun(tenantId: string, runId: string): Promise<ReconciliationRun> {
    const run = await this.runs.findOne({ where: { tenantId, id: runId } });
    if (!run) throw new NotFoundException('Corrida de reconciliación no encontrada');
    return run;
  }

  async listRuns(tenantId: string): Promise<ReconciliationRun[]> {
    return this.runs.find({ where: { tenantId }, order: { startedAt: 'DESC' } });
  }

  async listItems(
    tenantId: string,
    runId: string,
    filter: { state?: ItemState; breakType?: BreakType; asset?: string },
    pagination: { limit: number; offset: number },
  ): Promise<{ data: ReconciliationItem[]; total: number }> {
    // Verificar que la corrida pertenece al tenant
    await this.getRun(tenantId, runId);

    const qb = this.items
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.runId = :runId', { runId });

    if (filter.state) qb.andWhere('item.state = :state', { state: filter.state });
    if (filter.breakType) qb.andWhere('item.breakType = :breakType', { breakType: filter.breakType });
    if (filter.asset) qb.andWhere('item.asset = :asset', { asset: filter.asset });

    qb.orderBy('item.detectedAt', 'ASC').addOrderBy('item.id', 'ASC');
    qb.skip(pagination.offset).take(pagination.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async listBreaks(
    tenantId: string,
    pagination: { limit: number; offset: number },
  ): Promise<{ data: ReconciliationItem[]; total: number }> {
    const qb = this.items
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.state = :state', { state: ItemState.BREAK })
      .andWhere('item.resolutionStatus = :resStatus', { resStatus: ResolutionStatus.OPEN });

    qb.orderBy('item.detectedAt', 'ASC').addOrderBy('item.id', 'ASC');
    qb.skip(pagination.offset).take(pagination.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getItem(tenantId: string, itemId: string): Promise<ReconciliationItem> {
    const item = await this.items.findOne({ where: { tenantId, id: itemId } });
    if (!item) throw new NotFoundException('Item de reconciliación no encontrado');
    return item;
  }

  async resolveItem(
    tenantId: string,
    itemId: string,
    userId: string,
    action: ResolutionAction,
    note: string,
  ): Promise<ReconciliationItem> {
    const item = await this.getItem(tenantId, itemId);
    if (item.state !== ItemState.BREAK) {
      throw new ConflictException('Solo se pueden resolver items con estado BREAK');
    }
    if (item.resolutionStatus === ResolutionStatus.RESOLVED) {
      throw new ConflictException('Este item ya fue resuelto');
    }
    item.resolutionStatus = ResolutionStatus.RESOLVED;
    item.resolutionAction = action;
    item.resolutionNote = note;
    item.resolvedBy = userId;
    item.resolvedAt = new Date();
    return this.items.save(item);
  }

  async reopenItem(tenantId: string, itemId: string): Promise<ReconciliationItem> {
    const item = await this.getItem(tenantId, itemId);
    if (item.resolutionStatus !== ResolutionStatus.RESOLVED) {
      throw new ConflictException('Este item no está resuelto');
    }
    item.resolutionStatus = ResolutionStatus.OPEN;
    item.resolutionAction = null;
    item.resolutionNote = null;
    item.resolvedBy = null;
    item.resolvedAt = null;
    return this.items.save(item);
  }
}
