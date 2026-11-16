import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Role } from '../common/role.enum';
import { ENTITIES } from './database.config';

const SEED_TENANT_SLUG = process.env.SEED_TENANT_SLUG || 'demo';
const SEED_TENANT_NAME = process.env.SEED_TENANT_NAME || 'Demo Company';
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo.com';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'recon',
    password: process.env.DB_PASSWORD || 'recon',
    database: process.env.DB_NAME || 'recon',
    entities: ENTITIES,
    synchronize: true,
  });

  await ds.initialize();
  console.log('Conectado a la base de datos.');

  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);

  let tenant = await tenantRepo.findOne({ where: { slug: SEED_TENANT_SLUG } });
  if (tenant) {
    console.log(`Tenant "${SEED_TENANT_SLUG}" ya existe (${tenant.id}).`);
  } else {
    tenant = await tenantRepo.save(tenantRepo.create({ slug: SEED_TENANT_SLUG, name: SEED_TENANT_NAME }));
    console.log(`Tenant "${SEED_TENANT_SLUG}" creado (${tenant.id}).`);
  }

  let admin = await userRepo.findOne({ where: { tenantId: tenant.id, email: SEED_ADMIN_EMAIL } });
  if (admin) {
    console.log(`Admin "${SEED_ADMIN_EMAIL}" ya existe.`);
  } else {
    const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
    admin = await userRepo.save(userRepo.create({
      tenantId: tenant.id,
      email: SEED_ADMIN_EMAIL,
      passwordHash: hash,
      role: Role.ADMIN,
    }));
    console.log(`Admin "${SEED_ADMIN_EMAIL}" creado.`);
  }

  await ds.destroy();
  console.log('Seed completado.');
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
