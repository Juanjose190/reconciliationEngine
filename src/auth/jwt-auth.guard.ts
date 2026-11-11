import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest, JwtPayload } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de acceso');
    }
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return true;
  }
}
