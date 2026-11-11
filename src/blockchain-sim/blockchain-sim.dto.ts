import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class DiscrepancyCountsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) AMOUNT_MISMATCH?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) MISSING_IN_EXTERNAL?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) MISSING_IN_LEDGER?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) DUPLICATE_EXTERNAL?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) DUPLICATE_LEDGER?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) ASSET_MISMATCH?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) TIMING_OFFSET?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) UNCONFIRMED?: number;
}

export class CreateScenarioDto {
  @Type(() => Number)
  @IsInt()
  seed!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  count!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => DiscrepancyCountsDto)
  discrepancies!: DiscrepancyCountsDto;

  @IsOptional()
  @IsString()
  reference?: string;
}
