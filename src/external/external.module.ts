import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ExternalTransaction } from './external-transaction.entity';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalTransaction]), AuthModule],
  controllers: [ExternalController],
  providers: [ExternalService],
  exports: [ExternalService],
})
export class ExternalModule {}
