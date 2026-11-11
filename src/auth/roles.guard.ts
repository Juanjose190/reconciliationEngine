import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../common/role.enum';
import { AuthenticatedRequest } from './auth.types';
import { ROLES_KEY } from './decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para esta operación');
    }
    return true;
  }
}
