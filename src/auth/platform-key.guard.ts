import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Protege las operaciones de plataforma (crear tenants). No pertenece a ningún
 * tenant: se autentica con una clave de operador definida en el entorno.
 */
@Injectable()
export class PlatformKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('PLATFORM_ADMIN_KEY');
    if (!expected) {
      throw new UnauthorizedException('La clave de plataforma no está configurada');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-platform-key'];
    if (typeof provided !== 'string') {
      throw new UnauthorizedException('Clave de plataforma inválida');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Clave de plataforma inválida');
    }
    return true;
  }
}
