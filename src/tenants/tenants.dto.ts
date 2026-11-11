import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  /** minúsculas, números y guiones; se usa como nombre del ledger. */
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}$/, {
    message: 'slug inválido: usa 2-31 caracteres en minúsculas, números o guiones',
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  adminPassword!: string;
}
