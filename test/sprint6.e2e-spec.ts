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

describe('Sprint 6 — reportes y métricas (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const createTenant = (slug: string, adminEmail = 'admin@report.com') =>
    http().post('/tenants').set(PLATFORM).send({ slug, name: `Empresa ${slug}`, adminEmail, adminPassword: PASSWORD });

  const login = (tenant: string, email: string, password = PASSWORD) =>
    http().post('/auth/login').send({ tenant, email, password });

  const tokenFor = async (tenant: string, email: string) => (await login(tenant, email)).body.accessToken as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let adminToken: string;
  let auditorToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    await createTenant('report-a').expect(201);
    adminToken = await tokenFor('report-a', 'admin@report.com');

    await http().post('/users').set(auth(adminToken)).send({ email: 'aud@report.com', password: PASSWORD, role: 'AUDITOR' }).expect(201);
    auditorToken = await tokenFor('report-a', 'aud@report.com');

    // Generar escenario y reconciliar
    await http()
      .post('/simulator/scenarios')
      .set(auth(adminToken))
      .send({ seed: 555, count: 15, discrepancies: { AMOUNT_MISMATCH: 2, MISSING_IN_LEDGER: 1 } })
      .expect(201);

    const now = new Date();
    const from = new Date(now.getTime() - 31 * 86400_000);
    const to = new Date(now.getTime() + 86400_000);

    await http()
      .post('/reconciliation/runs')
      .set(auth(adminToken))
      .send({ periodFrom: from.toISOString(), periodTo: to.toISOString() })
      .expect(201);

    // Resolver un break
    const breaksRes = await http().get('/reconciliation/breaks').set(auth(adminToken)).expect(200);
    if (breaksRes.body.data.length > 0) {
      await http()
        .patch(`/reconciliation/items/${breaksRes.body.data[0].id}/resolve`)
        .set(auth(adminToken))
        .send({ action: 'ACCEPT_LEDGER', note: 'Verificado' })
        .expect(200);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HU 6.1 — reporte de reconciliación', () => {
    it('genera un reporte con métricas correctas', async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 31 * 86400_000);
      const to = new Date(now.getTime() + 86400_000);

      const res = await http()
        .get(`/reconciliation/report?periodFrom=${from.toISOString()}&periodTo=${to.toISOString()}`)
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.runs.total).toBeGreaterThanOrEqual(1);
      expect(res.body.runs.completed).toBeGreaterThanOrEqual(1);
      expect(res.body.items.total).toBeGreaterThan(0);
      expect(res.body.items.matched).toBeGreaterThan(0);
      expect(res.body.items.breaks).toBeGreaterThan(0);
      expect(res.body.breaksByType).toBeDefined();
      expect(res.body.resolution.resolved).toBeGreaterThanOrEqual(1);
      expect(res.body.resolution.resolutionRate).toMatch(/^\d+\.\d+%$/);
      expect(res.body.lastRunAt).toBeDefined();
    });

    it('un AUDITOR puede ver el reporte', async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 31 * 86400_000);
      const to = new Date(now.getTime() + 86400_000);

      await http()
        .get(`/reconciliation/report?periodFrom=${from.toISOString()}&periodTo=${to.toISOString()}`)
        .set(auth(auditorToken))
        .expect(200);
    });

    it('sin token no hay acceso al reporte', async () => {
      const now = new Date();
      await http()
        .get(`/reconciliation/report?periodFrom=${now.toISOString()}&periodTo=${now.toISOString()}`)
        .expect(401);
    });

    it('reporte vacío para un período sin datos', async () => {
      const old = new Date('2020-01-01');
      const old2 = new Date('2020-01-02');

      const res = await http()
        .get(`/reconciliation/report?periodFrom=${old.toISOString()}&periodTo=${old2.toISOString()}`)
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.runs.total).toBe(0);
      expect(res.body.items.total).toBe(0);
    });
  });
});
