import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

/** Enteros positivos como texto para no perder precisión (bigint no existe en JSON). */
const AMOUNT = /^[1-9]\d{0,17}$/;

export class PostingDto {
  @IsString() source!: string;
  @IsString() destination!: string;
  @IsString() asset!: string;

  @Matches(AMOUNT, { message: 'amount debe ser un entero positivo como texto, p. ej. "1500"' })
  amount!: string;
}

export class CreateTransactionDto {
  @IsOptional() @IsString() reference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  postings!: PostingDto[];

  @IsOptional() @IsObject() metadata?: Record<string, string>;
}

export class MovementDto {
  @IsString() account!: string;
  @IsString() asset!: string;

  @Matches(AMOUNT, { message: 'amount debe ser un entero positivo como texto, p. ej. "1500"' })
  amount!: string;

  @IsOptional() @IsString() reference?: string;
}
