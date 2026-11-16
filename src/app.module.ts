import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthLoginModule } from './auth/auth-login.module';
import { BlockchainSimModule } from './blockchain-sim/blockchain-sim.module';
import { buildTypeOrmOptions } from './config/database.config';
import { ExternalModule } from './external/external.module';
import { LedgerModule } from './ledger/ledger.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    TenantsModule,
    UsersModule,
    LedgerModule,
    AuthLoginModule,
    ExternalModule,
    BlockchainSimModule,
    ReconciliationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
