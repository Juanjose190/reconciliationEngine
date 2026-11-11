import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { ReconciliationService } from './reconciliation.service';
import { RunTrigger } from './reconciliation-run.entity';

@Injectable()
export class ReconciliationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationSchedulerService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly windowHours: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly reconciliation: ReconciliationService,
    private readonly config: ConfigService,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {
    this.enabled = this.config.get<string>('RECON_CRON_ENABLED', 'false') === 'true';
    this.intervalMs = Number(this.config.get<string>('RECON_CRON_INTERVAL_MS', '3600000'));
    this.windowHours = Number(this.config.get<string>('RECON_CRON_WINDOW_HOURS', '24'));
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.logger.log(`Scheduler de reconciliación habilitado (intervalo: ${this.intervalMs}ms, ventana: ${this.windowHours}h)`);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    const activeTenants = await this.tenants.find({ where: { active: true } });

    for (const tenant of activeTenants) {
      try {
        const now = new Date();
        const periodFrom = new Date(now.getTime() - this.windowHours * 3600_000);

        await this.reconciliation.startRun(
          tenant.id,
          tenant.slug,
          null,
          RunTrigger.SCHEDULED,
          periodFrom,
          now,
        );

        this.logger.log(`Reconciliación programada completada para tenant ${tenant.slug}`);
      } catch (err) {
        this.logger.warn(
          `Error en reconciliación programada para tenant ${tenant.slug}: ${(err as Error).message}`,
        );
      }
    }
  }
}
