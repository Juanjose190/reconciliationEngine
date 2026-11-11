import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ExternalTxStatus } from './external-transaction.entity';

export class ExternalTxQueryDto {
  @IsOptional() @IsString() asset?: string;
  @IsOptional() @IsString() fromAddress?: string;
  @IsOptional() @IsString() toAddress?: string;
  @IsOptional() @IsIn(Object.values(ExternalTxStatus)) status?: ExternalTxStatus;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
