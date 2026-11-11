process.env.DB_TYPE = 'sqljs';
process.env.JWT_SECRET = 'secreto-de-pruebas-suficientemente-largo';
process.env.PLATFORM_ADMIN_KEY = 'clave-de-plataforma-de-pruebas';
process.env.LEDGER_DRIVER = 'memory';

import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const PLATFORM = { 'x-platform-key': process.env.PLATFORM_ADMIN_KEY! };
const PASSWORD = 'contraseña-segura-1';

describe('Sprint 5 — resolución y auditoría (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const createTenant = (slug: string, adminEmail = 'admin@resol.com') =>
    http().post('/tenants').set(PLATFORM).send({ slug, name: `Empresa ${slug}`, adminEmail, adminPassword: PASSWORD });

  const login = (tenant: string, email: string, password = PASSWORD) =>
    http().post('/auth/login').send({ tenant, email, password });

  const tokenFor = async (tenant: string, email: string) => (await login(tenant, email)).body.accessToken as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let adminToken: string;
  let auditorToken: string;
  let breakItemId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    await createTenant('resol-a').expect(201);
    adminToken = await tokenFor('resol-a', 'admin@resol.com');

    await http().post('/users').set(auth(adminToken)).send({ email: 'aud@resol.com', password: PASSWORD, role: 'AUDITOR' }).expect(201);
    auditorToken = await tokenFor('resol-a', 'aud@resol.com');

    // Generar escenario con breaks
    await http()
      .post('/simulator/scenarios')
      .set(auth(adminToken))
      .send({ seed: 999, count: 10, discrepancies: { AMOUNT_MISMATCH: 2, MISSING_IN_LEDGER: 1 } })
      .expect(201);

    // Ejecutar reconciliación
    const now = new Date();
    const from = new Date(now.getTime() - 31 * 86400_000);
    const to = new Date(now.getTime() + 86400_000);

    const runRes = await http()
      .post('/reconciliation/runs')
      .set(auth(adminToken))
      .send({ periodFrom: from.toISOString(), periodTo: to.toISOString() })
      .expect(201);

    // Obtener un break para pruebas de resolución
    const breaksRes = await http()
      .get('/reconciliation/breaks')
      .set(auth(adminToken))
      .expect(200);

    breakItemId = breaksRes.body.data[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HU 5.1 — resolver un break', () => {
    it('resuelve un break con acción y nota', async () => {
      const res = await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'ACCEPT_LEDGER', note: 'Verificado manualmente con el banco' })
        .expect(200);

      expect(res.body.resolutionStatus).toBe('RESOLVED');
      expect(res.body.resolutionAction).toBe('ACCEPT_LEDGER');
      expect(res.body.resolutionNote).toBe('Verificado manualmente con el banco');
      expect(res.body.resolvedBy).toBeDefined();
      expect(res.body.resolvedAt).toBeDefined();
    });

    it('un break resuelto ya no aparece en GET /breaks', async () => {
      const res = await http()
        .get('/reconciliation/breaks')
        .set(auth(adminToken))
        .expect(200);

      const ids = res.body.data.map((i: any) => i.id);
      expect(ids).not.toContain(breakItemId);
    });

    it('no se puede resolver un break ya resuelto (409)', async () => {
      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'IGNORE', note: 'segundo intento' })
        .expect(409);
    });

    it('reabre un break resuelto', async () => {
      const res = await http()
        .patch(`/reconciliation/items/${breakItemId}/reopen`)
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.resolutionStatus).toBe('OPEN');
      expect(res.body.resolutionAction).toBeNull();
      expect(res.body.resolvedBy).toBeNull();
    });

    it('el break reabierto vuelve a aparecer en GET /breaks', async () => {
      const res = await http()
        .get('/reconciliation/breaks')
        .set(auth(adminToken))
        .expect(200);

      const ids = res.body.data.map((i: any) => i.id);
      expect(ids).toContain(breakItemId);
    });
  });

  describe('HU 5.2 — permisos de resolución', () => {
    it('un AUDITOR no puede resolver breaks', async () => {
      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(auditorToken))
        .send({ action: 'IGNORE', note: 'intento auditor' })
        .expect(403);
    });

    it('un AUDITOR no puede reabrir breaks', async () => {
      // Primero resolver como admin
      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'ACCEPT_EXTERNAL', note: 'para test de permisos' })
        .expect(200);

      await http()
        .patch(`/reconciliation/items/${breakItemId}/reopen`)
        .set(auth(auditorToken))
        .expect(403);
    });

    it('sin token no hay acceso a resolución', async () => {
      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .send({ action: 'IGNORE', note: 'sin auth' })
        .expect(401);
    });
  });

  describe('HU 5.3 — validación de DTOs de resolución', () => {
    it('rechaza acción inválida', async () => {
      // Reabrir el break para poder intentar resolverlo
      await http()
        .patch(`/reconciliation/items/${breakItemId}/reopen`)
        .set(auth(adminToken))
        .expect(200);

      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'INVALID_ACTION', note: 'test' })
        .expect(400);
    });

    it('rechaza sin nota', async () => {
      await http()
        .patch(`/reconciliation/items/${breakItemId}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'IGNORE' })
        .expect(400);
    });
  });
});
