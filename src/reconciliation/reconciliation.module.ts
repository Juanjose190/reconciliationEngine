import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ExternalModule } from '../external/external.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Tenant } from '../tenants/tenant.entity';
import { ReconciliationItem } from './reconciliation-item.entity';
import { ReconciliationRun } from './reconciliation-run.entity';
import { ReconciliationReportService } from './reconciliation-report.service';
import { ReconciliationSchedulerService } from './reconciliation-scheduler.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReconciliationRun, ReconciliationItem, Tenant]),
    AuthModule,
    LedgerModule,
    ExternalModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, ReconciliationReportService, ReconciliationSchedulerService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
