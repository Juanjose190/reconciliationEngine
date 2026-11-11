import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Tenant } from './tenant.entity';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AuthModule, LedgerModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
