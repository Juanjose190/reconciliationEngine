import { Request } from 'express';
import { Role } from '../common/role.enum';

/** Contenido del JWT. El tenant viaja firmado: el cliente no puede cambiarlo. */
export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
