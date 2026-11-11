import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtPayload } from './auth.types';
import { CurrentUser } from './decorators';
import { JwtAuthGuard } from './jwt-auth.guard';

export class LoginDto {
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}$/)
  tenant!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.tenant, dto.email, dto.password);
  }

  /** Útil para que el frontend sepa a qué tenant y rol pertenece el token. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return { userId: user.sub, tenant: user.tenantSlug, role: user.role };
  }
}
