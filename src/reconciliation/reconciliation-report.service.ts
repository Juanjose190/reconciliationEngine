import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BreakType, ItemState, ReconciliationItem, ResolutionStatus } from './reconciliation-item.entity';
import { ReconciliationRun, RunStatus } from './reconciliation-run.entity';

export interface ReconciliationReport {
  tenantId: string;
  period: { from: string; to: string };
  runs: {
    total: number;
    completed: number;
    failed: number;
  };
  items: {
    total: number;
    matched: number;
    breaks: number;
    pending: number;
  };
  breaksByType: Record<string, number>;
  resolution: {
    open: number;
    resolved: number;
    resolutionRate: string;
  };
  lastRunAt: string | null;
}

@Injectable()
export class ReconciliationReportService {
  constructor(
    @InjectRepository(ReconciliationRun) private readonly runs: Repository<ReconciliationRun>,
    @InjectRepository(ReconciliationItem) private readonly items: Repository<ReconciliationItem>,
  ) {}

  async generateReport(
    tenantId: string,
    periodFrom: Date,
    periodTo: Date,
  ): Promise<ReconciliationReport> {
    const runs = await this.runs
      .createQueryBuilder('run')
      .where('run.tenantId = :tenantId', { tenantId })
      .andWhere('run.startedAt >= :from', { from: periodFrom })
      .andWhere('run.startedAt <= :to', { to: periodTo })
      .getMany();

    const runIds = runs.map((r) => r.id);

    let items: ReconciliationItem[] = [];
    if (runIds.length > 0) {
      items = await this.items
        .createQueryBuilder('item')
        .where('item.tenantId = :tenantId', { tenantId })
        .andWhere('item.runId IN (:...runIds)', { runIds })
        .getMany();
    }

    const matched = items.filter((i) => i.state === ItemState.MATCHED).length;
    const breaks = items.filter((i) => i.state === ItemState.BREAK).length;
    const pending = items.filter((i) => i.state === ItemState.PENDING).length;

    const breaksByType: Record<string, number> = {};
    for (const bt of Object.values(BreakType)) {
      const count = items.filter((i) => i.breakType === bt).length;
      if (count > 0) breaksByType[bt] = count;
    }

    const openBreaks = items.filter(
      (i) => i.state === ItemState.BREAK && i.resolutionStatus === ResolutionStatus.OPEN,
    ).length;
    const resolvedBreaks = items.filter(
      (i) => i.state === ItemState.BREAK && i.resolutionStatus === ResolutionStatus.RESOLVED,
    ).length;

    const resolutionRate = breaks > 0
      ? ((resolvedBreaks / breaks) * 100).toFixed(1)
      : '0.0';

    const completedRuns = runs.filter((r) => r.status === RunStatus.COMPLETED);
    const lastRun = completedRuns.sort(
      (a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0),
    )[0];

    return {
      tenantId,
      period: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      runs: {
        total: runs.length,
        completed: completedRuns.length,
        failed: runs.filter((r) => r.status === RunStatus.FAILED).length,
      },
      items: {
        total: items.length,
        matched,
        breaks,
        pending,
      },
      breaksByType,
      resolution: {
        open: openBreaks,
        resolved: resolvedBreaks,
        resolutionRate: `${resolutionRate}%`,
      },
      lastRunAt: lastRun?.finishedAt?.toISOString() ?? null,
    };
  }
}
