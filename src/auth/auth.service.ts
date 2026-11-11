import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.types';

// Hash de relleno para que el tiempo de respuesta no revele si el usuario existe.
const DUMMY_HASH = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly tenants: TenantsService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(tenantSlug: string, email: string, password: string) {
    const tenant = await this.tenants.findActiveBySlug(tenantSlug);
    const user = tenant ? await this.users.findByEmail(tenant.id, email) : null;

    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!tenant || !user || !user.active || !ok) {
      // Mismo mensaje para todos los casos: no filtra qué dato falló.
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role,
    };
    return { accessToken: await this.jwt.signAsync(payload), role: user.role, tenant: tenant.slug };
  }
}
