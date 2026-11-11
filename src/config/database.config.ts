import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ExternalTransaction } from '../external/external-transaction.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';

export const ENTITIES = [Tenant, User, ExternalTransaction];

/**
 * PostgreSQL por defecto. DB_TYPE=sqljs (SQLite en memoria vía WASM) se usa
 * solo en pruebas para no depender de un servidor de base de datos.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const type = config.get<string>('DB_TYPE', 'postgres');

  if (type === 'sqljs') {
    return {
      type: 'sqljs',
      autoSave: false,
      entities: ENTITIES,
      synchronize: true,
    };
  }

  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', '5432')),
    username: config.get<string>('DB_USER', 'recon'),
    password: config.get<string>('DB_PASSWORD', 'recon'),
    database: config.get<string>('DB_NAME', 'recon'),
    entities: ENTITIES,
    synchronize: config.get<string>('DB_SYNC', 'false') === 'true',
  };
}
