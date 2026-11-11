import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExternalModule } from '../external/external.module';
import { LedgerModule } from '../ledger/ledger.module';
import { BlockchainSimController } from './blockchain-sim.controller';
import { BlockchainSimService } from './blockchain-sim.service';

@Module({
  imports: [AuthModule, ExternalModule, LedgerModule],
  controllers: [BlockchainSimController],
  providers: [BlockchainSimService],
  exports: [BlockchainSimService],
})
export class BlockchainSimModule {}
