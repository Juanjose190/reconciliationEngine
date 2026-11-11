import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PlatformKeyGuard } from './platform-key.guard';
import { RolesGuard } from './roles.guard';

/**
 * Infraestructura de autenticación reutilizable (JWT + guards). No depende de
 * usuarios ni tenants, así que cualquier módulo puede importarlo sin ciclos.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET es obligatorio');
        return { secret, signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as any } };
      },
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, PlatformKeyGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, PlatformKeyGuard],
})
export class AuthModule {}
