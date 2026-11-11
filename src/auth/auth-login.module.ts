import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from './auth.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Login: une usuarios + tenants + JWT. Separado de AuthModule para evitar ciclos. */
@Module({
  imports: [AuthModule, TenantsModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthLoginModule {}
