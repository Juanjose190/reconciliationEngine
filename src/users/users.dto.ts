import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ALL_ROLES, Role } from '../common/role.enum';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // límite de bcrypt
  password!: string;

  @IsIn(ALL_ROLES)
  role!: Role;
}

export class ChangeRoleDto {
  @IsIn(ALL_ROLES)
  role!: Role;
}

export class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}
