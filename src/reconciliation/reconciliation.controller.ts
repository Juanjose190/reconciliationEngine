import { Controller, Get, Param, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../common/role.enum';
import { BreaksQueryDto, CreateRunDto, ReportQueryDto, ResolveItemDto, RunItemsQueryDto } from './reconciliation.dto';
import { ReconciliationReportService } from './reconciliation-report.service';
import { ReconciliationService } from './reconciliation.service';
import { RunTrigger } from './reconciliation-run.entity';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliation: ReconciliationService,
    private readonly reports: ReconciliationReportService,
  ) {}

  @Post('runs')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async createRun(@CurrentUser() me: JwtPayload, @Body() dto: CreateRunDto) {
    const run = await this.reconciliation.startRun(
      me.tenantId,
      me.tenantSlug,
      me.sub,
      RunTrigger.MANUAL,
      new Date(dto.periodFrom),
      new Date(dto.periodTo),
      {
        toleranceWindowHours: dto.toleranceWindowHours,
        minConfirmations: dto.minConfirmations,
      },
    );
    return this.serializeRun(run);
  }

  @Get('runs')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async listRuns(@CurrentUser() me: JwtPayload) {
    const runs = await this.reconciliation.listRuns(me.tenantId);
    return runs.map((r) => this.serializeRun(r));
  }

  @Get('runs/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async getRun(@CurrentUser() me: JwtPayload, @Param('id') id: string) {
    return this.serializeRun(await this.reconciliation.getRun(me.tenantId, id));
  }

  @Get('runs/:id/items')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async getRunItems(
    @CurrentUser() me: JwtPayload,
    @Param('id') runId: string,
    @Query() query: RunItemsQueryDto,
  ) {
    const { data, total } = await this.reconciliation.listItems(
      me.tenantId,
      runId,
      { state: query.state, breakType: query.breakType, asset: query.asset },
      { limit: query.limit ?? 50, offset: query.offset ?? 0 },
    );
    return {
      data: data.map((i) => this.serializeItem(i)),
      page: { limit: query.limit ?? 50, offset: query.offset ?? 0, total },
    };
  }

  @Get('breaks')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async listBreaks(@CurrentUser() me: JwtPayload, @Query() query: BreaksQueryDto) {
    const { data, total } = await this.reconciliation.listBreaks(
      me.tenantId,
      { limit: query.limit ?? 50, offset: query.offset ?? 0 },
    );
    return {
      data: data.map((i) => this.serializeItem(i)),
      page: { limit: query.limit ?? 50, offset: query.offset ?? 0, total },
    };
  }

  @Get('report')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async getReport(@CurrentUser() me: JwtPayload, @Query() query: ReportQueryDto) {
    return this.reports.generateReport(
      me.tenantId,
      new Date(query.periodFrom),
      new Date(query.periodTo),
    );
  }

  @Patch('items/:id/resolve')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async resolveItem(
    @CurrentUser() me: JwtPayload,
    @Param('id') itemId: string,
    @Body() dto: ResolveItemDto,
  ) {
    const item = await this.reconciliation.resolveItem(
      me.tenantId, itemId, me.sub, dto.action, dto.note,
    );
    return this.serializeItem(item);
  }

  @Patch('items/:id/reopen')
  @Roles(Role.ADMIN, Role.OPERATOR)
  async reopenItem(
    @CurrentUser() me: JwtPayload,
    @Param('id') itemId: string,
  ) {
    const item = await this.reconciliation.reopenItem(me.tenantId, itemId);
    return this.serializeItem(item);
  }

  private serializeRun(run: any) {
    return {
      ...run,
      periodFrom: run.periodFrom instanceof Date ? run.periodFrom.toISOString() : run.periodFrom,
      periodTo: run.periodTo instanceof Date ? run.periodTo.toISOString() : run.periodTo,
      startedAt: run.startedAt instanceof Date ? run.startedAt.toISOString() : run.startedAt,
      finishedAt: run.finishedAt instanceof Date ? run.finishedAt.toISOString() : run.finishedAt,
    };
  }

  private serializeItem(item: any) {
    return {
      ...item,
      detectedAt: item.detectedAt instanceof Date ? item.detectedAt.toISOString() : item.detectedAt,
      resolvedAt: item.resolvedAt instanceof Date ? item.resolvedAt.toISOString() : item.resolvedAt,
    };
  }
}
