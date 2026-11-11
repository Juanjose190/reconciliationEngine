import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '../common/role.enum';
import { AuthenticatedRequest, JwtPayload } from './auth.types';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a uno o más roles. Sin decorador: cualquier usuario autenticado. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el usuario autenticado (payload del JWT). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
