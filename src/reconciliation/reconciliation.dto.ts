import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BreakType, ItemState, ResolutionAction } from './reconciliation-item.entity';

export class CreateRunDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  @Type(() => Number)
  toleranceWindowHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  minConfirmations?: number;
}

export class RunItemsQueryDto {
  @IsOptional()
  @IsEnum(ItemState)
  state?: ItemState;

  @IsOptional()
  @IsEnum(BreakType)
  breakType?: BreakType;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

export class ResolveItemDto {
  @IsEnum(ResolutionAction)
  action!: ResolutionAction;

  @IsString()
  @MaxLength(1000)
  note!: string;
}

export class ReportQueryDto {
  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;
}

export class BreaksQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
