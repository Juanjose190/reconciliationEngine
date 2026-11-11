import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FormanceLedger } from './formance-ledger';
import { InMemoryLedger } from './in-memory-ledger';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { LEDGER_PORT } from './ledger.types';

@Module({
  imports: [AuthModule],
  controllers: [LedgerController],
  providers: [
    InMemoryLedger,
    {
      provide: LEDGER_PORT,
      inject: [ConfigService, InMemoryLedger],
      useFactory: (config: ConfigService, memory: InMemoryLedger) => {
        const driver = config.get<string>('LEDGER_DRIVER', 'memory');
        if (driver === 'formance') return new FormanceLedger(config);
        if (driver === 'memory') return memory;
        throw new Error(`LEDGER_DRIVER desconocido: ${driver}`);
      },
    },
    LedgerService,
  ],
  exports: [LedgerService, LEDGER_PORT],
})
export class LedgerModule {}
