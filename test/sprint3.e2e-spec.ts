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

describe('Sprint 3 — fuente externa simulada + API (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const createTenant = (slug: string, adminEmail = 'admin@empresa.com') =>
    http().post('/tenants').set(PLATFORM).send({ slug, name: `Empresa ${slug}`, adminEmail, adminPassword: PASSWORD });

  const login = (tenant: string, email: string, password = PASSWORD) =>
    http().post('/auth/login').send({ tenant, email, password });

  const tokenFor = async (tenant: string, email: string) => (await login(tenant, email)).body.accessToken as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let tenantAToken: string;
  let tenantBToken: string;
  let auditorToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    await createTenant('simco-a').expect(201);
    await createTenant('simco-b').expect(201);
    tenantAToken = await tokenFor('simco-a', 'admin@empresa.com');
    tenantBToken = await tokenFor('simco-b', 'admin@empresa.com');

    // Crear un auditor para tenant A
    await http().post('/users').set(auth(tenantAToken)).send({ email: 'aud@a.com', password: PASSWORD, role: 'AUDITOR' }).expect(201);
    auditorToken = await tokenFor('simco-a', 'aud@a.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HU 3.1 — determinismo del simulador', () => {
    it('misma semilla produce el mismo escenario', async () => {
      const body = { seed: 42, count: 5, discrepancies: {} };

      const res1 = await http().post('/simulator/scenarios').set(auth(tenantAToken)).send(body).expect(201);

      // Otro tenant con la misma semilla: debe producir la misma cantidad y estructura
      const res2 = await http().post('/simulator/scenarios').set(auth(tenantBToken)).send(body).expect(201);

      expect(res1.body.totalGenerated).toBe(5);
      expect(res2.body.totalGenerated).toBe(5);
      expect(res1.body.healthy).toBe(5);
      expect(res2.body.healthy).toBe(5);
    });

    it('saldos del ledger cuadran tras la simulación (suma por asset = 0)', async () => {
      const accounts = await http().get('/ledger/accounts').set(auth(tenantAToken)).expect(200);

      // Sumar todos los saldos por asset: debe ser 0 (partida doble)
      const totals: Record<string, bigint> = {};
      for (const acct of accounts.body) {
        for (const [asset, val] of Object.entries(acct.balances)) {
          totals[asset] = (totals[asset] ?? 0n) + BigInt(val as string);
        }
      }
      for (const total of Object.values(totals)) {
        expect(total).toBe(0n);
      }
    });
  });

  describe('HU 3.2 — escenarios con discrepancias intencionales', () => {
    let scenarioResult: any;

    it('inyecta exactamente la cantidad pedida de cada tipo', async () => {
      const res = await http()
        .post('/simulator/scenarios')
        .set(auth(tenantAToken))
        .send({
          seed: 100,
          count: 20,
          discrepancies: {
            AMOUNT_MISMATCH: 2,
            MISSING_IN_EXTERNAL: 2,
            MISSING_IN_LEDGER: 2,
            DUPLICATE_EXTERNAL: 1,
            DUPLICATE_LEDGER: 1,
            ASSET_MISMATCH: 1,
            TIMING_OFFSET: 1,
            UNCONFIRMED: 1,
          },
        })
        .expect(201);

      scenarioResult = res.body;
      expect(scenarioResult.totalGenerated).toBe(20);
      expect(scenarioResult.healthy).toBe(9); // 20 - 11
      expect(scenarioResult.injected).toHaveLength(11);

      // Verificar que cada tipo aparece la cantidad correcta
      const byCounts: Record<string, number> = {};
      for (const inj of scenarioResult.injected) {
        byCounts[inj.type] = (byCounts[inj.type] ?? 0) + 1;
      }
      expect(byCounts.AMOUNT_MISMATCH).toBe(2);
      expect(byCounts.MISSING_IN_EXTERNAL).toBe(2);
      expect(byCounts.MISSING_IN_LEDGER).toBe(2);
      expect(byCounts.DUPLICATE_EXTERNAL).toBe(1);
      expect(byCounts.DUPLICATE_LEDGER).toBe(1);
      expect(byCounts.ASSET_MISMATCH).toBe(1);
      expect(byCounts.TIMING_OFFSET).toBe(1);
      expect(byCounts.UNCONFIRMED).toBe(1);
    });

    it('rechaza discrepancias que superan count', async () => {
      await http()
        .post('/simulator/scenarios')
        .set(auth(tenantAToken))
        .send({ seed: 1, count: 5, discrepancies: { AMOUNT_MISMATCH: 6 } })
        .expect(400);
    });

    it('rechaza count fuera de rango', async () => {
      await http()
        .post('/simulator/scenarios')
        .set(auth(tenantAToken))
        .send({ seed: 1, count: 0, discrepancies: {} })
        .expect(400);
      await http()
        .post('/simulator/scenarios')
        .set(auth(tenantAToken))
        .send({ seed: 1, count: 10001, discrepancies: {} })
        .expect(400);
    });

    it('un AUDITOR no puede crear escenarios', async () => {
      await http()
        .post('/simulator/scenarios')
        .set(auth(auditorToken))
        .send({ seed: 1, count: 5, discrepancies: {} })
        .expect(403);
    });
  });

  describe('aislamiento de datos entre tenants', () => {
    it('un tenant NO ve transacciones externas de otro', async () => {
      const resA = await http().get('/external/transactions').set(auth(tenantAToken)).expect(200);
      const resB = await http().get('/external/transactions').set(auth(tenantBToken)).expect(200);

      expect(resA.body.data.length).toBeGreaterThan(0);

      // Todas las tx externas de B solo pertenecen a su escenario (seed 42, count 5)
      // No deben contener las de A
      const aScenarioIds = new Set(resA.body.data.map((t: any) => t.scenarioId));
      const bScenarioIds = new Set(resB.body.data.map((t: any) => t.scenarioId));

      // Los conjuntos de escenarios son disjuntos
      for (const sid of aScenarioIds) {
        expect(bScenarioIds.has(sid)).toBe(false);
      }
    });
  });

  describe('HU 6.1 — API de consulta', () => {
    it('GET /external/transactions soporta paginación', async () => {
      const page1 = await http()
        .get('/external/transactions?limit=3&offset=0')
        .set(auth(tenantAToken))
        .expect(200);

      expect(page1.body.page.limit).toBe(3);
      expect(page1.body.page.offset).toBe(0);
      expect(page1.body.data.length).toBeLessThanOrEqual(3);
      expect(page1.body.page.total).toBeGreaterThan(3);

      const page2 = await http()
        .get('/external/transactions?limit=3&offset=3')
        .set(auth(tenantAToken))
        .expect(200);

      expect(page2.body.page.offset).toBe(3);
      // Los datos no se repiten
      const ids1 = page1.body.data.map((t: any) => t.id);
      const ids2 = page2.body.data.map((t: any) => t.id);
      for (const id of ids2) {
        expect(ids1).not.toContain(id);
      }
    });

    it('GET /external/transactions filtra por asset', async () => {
      const res = await http()
        .get('/external/transactions?asset=USD/2')
        .set(auth(tenantAToken))
        .expect(200);

      for (const tx of res.body.data) {
        expect(tx.asset).toBe('USD/2');
      }
    });

    it('GET /external/transactions filtra por status', async () => {
      const res = await http()
        .get('/external/transactions?status=PENDING')
        .set(auth(tenantAToken))
        .expect(200);

      for (const tx of res.body.data) {
        expect(tx.status).toBe('PENDING');
      }
    });

    it('GET /ledger/transactions soporta paginación', async () => {
      const res = await http()
        .get('/ledger/transactions?limit=3&offset=0')
        .set(auth(tenantAToken))
        .expect(200);

      expect(res.body.page.limit).toBe(3);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body.page.total).toBeGreaterThan(0);
    });

    it('GET /ledger/accounts lista cuentas con saldos', async () => {
      const res = await http().get('/ledger/accounts').set(auth(tenantAToken)).expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      const world = res.body.find((a: any) => a.address === 'world');
      expect(world).toBeDefined();
      expect(world.balances).toBeDefined();
    });

    it('sin token no hay acceso a la fuente externa', async () => {
      await http().get('/external/transactions').expect(401);
    });
  });
});
