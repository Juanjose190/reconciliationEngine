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

describe('Sprints 1 y 2 — multi-tenant + ledger (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const createTenant = (slug: string, adminEmail = 'admin@empresa.com') =>
    http().post('/tenants').set(PLATFORM).send({ slug, name: `Empresa ${slug}`, adminEmail, adminPassword: PASSWORD });

  const login = (tenant: string, email: string, password = PASSWORD) =>
    http().post('/auth/login').send({ tenant, email, password });

  const tokenFor = async (tenant: string, email: string) => (await login(tenant, email)).body.accessToken as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------- Sprint 1 ----------------

  describe('HU 1.1 — tenants', () => {
    it('rechaza crear tenants sin la clave de plataforma', async () => {
      await http().post('/tenants').send({ slug: 'x1', name: 'X', adminEmail: 'a@x.com', adminPassword: PASSWORD }).expect(401);
      await http()
        .post('/tenants')
        .set('x-platform-key', 'incorrecta')
        .send({ slug: 'x1', name: 'X', adminEmail: 'a@x.com', adminPassword: PASSWORD })
        .expect(401);
    });

    it('crea un tenant con su primer ADMIN y no expone el hash', async () => {
      const res = await createTenant('acme').expect(201);
      expect(res.body.tenant.slug).toBe('acme');
      expect(res.body.admin.role).toBe('ADMIN');
      expect(res.body.admin.passwordHash).toBeUndefined();
    });

    it('rechaza slugs duplicados e inválidos', async () => {
      await createTenant('acme').expect(409);
      await createTenant('Slug Inválido!').expect(400);
    });
  });

  describe('autenticación por tenant (HU 6.3)', () => {
    it('login correcto devuelve un token con el tenant', async () => {
      const res = await login('acme', 'admin@empresa.com').expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      const me = await http().get('/auth/me').set(auth(res.body.accessToken)).expect(200);
      expect(me.body).toMatchObject({ tenant: 'acme', role: 'ADMIN' });
    });

    it('credenciales erróneas, tenant inexistente o sin token → 401 con el mismo mensaje', async () => {
      const wrongPass = await login('acme', 'admin@empresa.com', 'otra-contraseña').expect(401);
      const wrongTenant = await login('no-existe', 'admin@empresa.com').expect(401);
      const wrongUser = await login('acme', 'nadie@empresa.com').expect(401);
      expect(wrongTenant.body.message).toBe(wrongPass.body.message);
      expect(wrongUser.body.message).toBe(wrongPass.body.message);

      await http().get('/auth/me').expect(401);
      await http().get('/auth/me').set('Authorization', 'Bearer basura').expect(401);
    });
  });

  describe('HU 1.2 — aislamiento de datos entre tenants', () => {
    let acmeAdmin: string;
    let globexAdmin: string;
    let acmeUserId: string;

    beforeAll(async () => {
      // Mismo correo de admin en ambos tenants: debe ser válido porque la unicidad es (tenant, email).
      await createTenant('globex').expect(201);
      acmeAdmin = await tokenFor('acme', 'admin@empresa.com');
      globexAdmin = await tokenFor('globex', 'admin@empresa.com');
    });

    it('cada tenant solo ve sus propios usuarios', async () => {
      const created = await http()
        .post('/users')
        .set(auth(acmeAdmin))
        .send({ email: 'ana@acme.com', password: PASSWORD, role: 'OPERATOR' })
        .expect(201);
      acmeUserId = created.body.id;

      const acmeList = await http().get('/users').set(auth(acmeAdmin)).expect(200);
      const globexList = await http().get('/users').set(auth(globexAdmin)).expect(200);
      expect(acmeList.body.map((u: any) => u.email).sort()).toEqual(['admin@empresa.com', 'ana@acme.com']);
      expect(globexList.body.map((u: any) => u.email)).toEqual(['admin@empresa.com']);
    });

    it('un admin de otro tenant NO puede leer ni modificar usuarios ajenos (404, no 403)', async () => {
      await http().patch(`/users/${acmeUserId}/role`).set(auth(globexAdmin)).send({ role: 'ADMIN' }).expect(404);
      await http().patch(`/users/${acmeUserId}/active`).set(auth(globexAdmin)).send({ active: false }).expect(404);

      // El usuario de acme sigue intacto.
      const acmeList = await http().get('/users').set(auth(acmeAdmin)).expect(200);
      expect(acmeList.body.find((u: any) => u.id === acmeUserId)).toMatchObject({ role: 'OPERATOR', active: true });
    });

    it('un usuario de acme no puede iniciar sesión en globex', async () => {
      await login('globex', 'ana@acme.com').expect(401);
    });

    it('rechaza correos duplicados dentro del mismo tenant', async () => {
      await http()
        .post('/users')
        .set(auth(acmeAdmin))
        .send({ email: 'ANA@acme.com', password: PASSWORD, role: 'AUDITOR' })
        .expect(409);
    });
  });

  describe('HU 1.3 — roles (RBAC)', () => {
    let admin: string;
    let operator: string;
    let auditor: string;

    beforeAll(async () => {
      admin = await tokenFor('acme', 'admin@empresa.com');
      await http().post('/users').set(auth(admin)).send({ email: 'aud@acme.com', password: PASSWORD, role: 'AUDITOR' }).expect(201);
      operator = await tokenFor('acme', 'ana@acme.com');
      auditor = await tokenFor('acme', 'aud@acme.com');
    });

    it('solo ADMIN gestiona usuarios', async () => {
      await http().get('/users').set(auth(operator)).expect(403);
      await http().post('/users').set(auth(auditor)).send({ email: 'x@acme.com', password: PASSWORD, role: 'ADMIN' }).expect(403);
    });

    it('un admin no puede cambiarse el rol ni desactivarse a sí mismo', async () => {
      const me = await http().get('/auth/me').set(auth(admin)).expect(200);
      await http().patch(`/users/${me.body.userId}/role`).set(auth(admin)).send({ role: 'AUDITOR' }).expect(400);
      await http().patch(`/users/${me.body.userId}/active`).set(auth(admin)).send({ active: false }).expect(400);
    });

    it('un usuario desactivado ya no puede iniciar sesión', async () => {
      const users = await http().get('/users').set(auth(admin)).expect(200);
      const aud = users.body.find((u: any) => u.email === 'aud@acme.com');
      await http().patch(`/users/${aud.id}/active`).set(auth(admin)).send({ active: false }).expect(200);
      await login('acme', 'aud@acme.com').expect(401);
      await http().patch(`/users/${aud.id}/active`).set(auth(admin)).send({ active: true }).expect(200);
      await login('acme', 'aud@acme.com').expect(200);
    });

    it('valida el cuerpo: rol inválido y contraseña corta', async () => {
      await http().post('/users').set(auth(admin)).send({ email: 'y@acme.com', password: PASSWORD, role: 'ROOT' }).expect(400);
      await http().post('/users').set(auth(admin)).send({ email: 'y@acme.com', password: 'corta', role: 'AUDITOR' }).expect(400);
    });
  });

  // ---------------- Sprint 2 ----------------

  describe('ledger de partida doble (HU 2.1 – 2.4)', () => {
    let acmeOperator: string;
    let acmeAuditor: string;
    let globexAdmin: string;

    beforeAll(async () => {
      acmeOperator = await tokenFor('acme', 'ana@acme.com');
      acmeAuditor = await tokenFor('acme', 'aud@acme.com');
      globexAdmin = await tokenFor('globex', 'admin@empresa.com');
    });

    it('HU 2.3: fund registra world → cuenta y world queda en negativo', async () => {
      const res = await http()
        .post('/ledger/fund')
        .set(auth(acmeOperator))
        .send({ account: 'users:alice', asset: 'USD/2', amount: '10000', reference: 'dep-001' })
        .expect(201);
      expect(res.body.postings[0]).toMatchObject({ source: 'world', destination: 'users:alice', amount: '10000' });

      const world = await http().get('/ledger/world').set(auth(acmeOperator)).expect(200);
      expect(world.body.balances).toEqual({ 'USD/2': '-10000' });
    });

    it('HU 2.1: transferencia entre cuentas con saldos correctos', async () => {
      await http()
        .post('/ledger/transactions')
        .set(auth(acmeOperator))
        .send({
          reference: 'tr-001',
          postings: [{ source: 'users:alice', destination: 'users:bob', asset: 'USD/2', amount: '2500' }],
          metadata: { motivo: 'pago' },
        })
        .expect(201);

      const alice = await http().get('/ledger/accounts/users:alice/balances').set(auth(acmeAuditor)).expect(200);
      const bob = await http().get('/ledger/accounts/users:bob/balances').set(auth(acmeAuditor)).expect(200);
      expect(alice.body.balances).toEqual({ 'USD/2': '7500' });
      expect(bob.body.balances).toEqual({ 'USD/2': '2500' });
    });

    it('rechaza sobregiros (422) y no modifica saldos', async () => {
      await http()
        .post('/ledger/transactions')
        .set(auth(acmeOperator))
        .send({ postings: [{ source: 'users:bob', destination: 'users:alice', asset: 'USD/2', amount: '999999' }] })
        .expect(422);
      const bob = await http().get('/ledger/accounts/users:bob/balances').set(auth(acmeAuditor)).expect(200);
      expect(bob.body.balances).toEqual({ 'USD/2': '2500' });
    });

    it('rechaza referencias repetidas (409, idempotencia)', async () => {
      await http()
        .post('/ledger/fund')
        .set(auth(acmeOperator))
        .send({ account: 'users:alice', asset: 'USD/2', amount: '10000', reference: 'dep-001' })
        .expect(409);
      const alice = await http().get('/ledger/accounts/users:alice/balances').set(auth(acmeAuditor)).expect(200);
      expect(alice.body.balances).toEqual({ 'USD/2': '7500' });
    });

    it('HU 2.2: valida nomenclatura de cuentas y formato de assets y montos', async () => {
      const bad = (body: object) => http().post('/ledger/transactions').set(auth(acmeOperator)).send(body);
      const p = { source: 'world', destination: 'users:alice', asset: 'USD/2', amount: '100' };

      await bad({ postings: [{ ...p, destination: 'alice' }] }).expect(400);
      await bad({ postings: [{ ...p, destination: 'clientes:alice' }] }).expect(400);
      await bad({ postings: [{ ...p, asset: 'dolares' }] }).expect(400);
      await bad({ postings: [{ ...p, amount: '-5' }] }).expect(400);
      await bad({ postings: [{ ...p, amount: '10.5' }] }).expect(400);
      await bad({ postings: [{ ...p, destination: 'world' }] }).expect(400);
      await bad({ postings: [] }).expect(400);
    });

    it('HU 2.4: historial por cuenta, en orden, con quién registró cada movimiento', async () => {
      const res = await http().get('/ledger/accounts/users:alice/transactions').set(auth(acmeAuditor)).expect(200);
      expect(res.body.map((t: any) => t.reference)).toEqual(['dep-001', 'tr-001']);
      expect(res.body[0].metadata.postedBy).toEqual(expect.any(String));
      expect(res.body[1].metadata.motivo).toBe('pago');
    });

    it('AUDITOR puede consultar pero no registrar movimientos', async () => {
      await http()
        .post('/ledger/fund')
        .set(auth(acmeAuditor))
        .send({ account: 'users:alice', asset: 'USD/2', amount: '1' })
        .expect(403);
      const txsRes = await http().get('/ledger/transactions').set(auth(acmeAuditor)).expect(200);
      expect(txsRes.body.data).toEqual(expect.any(Array));
    });

    it('retiro devuelve dinero a world', async () => {
      await http()
        .post('/ledger/withdraw')
        .set(auth(acmeOperator))
        .send({ account: 'users:bob', asset: 'USD/2', amount: '500' })
        .expect(201);
      const world = await http().get('/ledger/world').set(auth(acmeOperator)).expect(200);
      expect(world.body.balances).toEqual({ 'USD/2': '-9500' });
    });

    it('aislamiento contable: globex no ve ni afecta el ledger de acme', async () => {
      const alice = await http().get('/ledger/accounts/users:alice/balances').set(auth(globexAdmin)).expect(200);
      expect(alice.body.balances).toEqual({});
      const world = await http().get('/ledger/world').set(auth(globexAdmin)).expect(200);
      expect(world.body.balances).toEqual({});
      const txs = await http().get('/ledger/transactions').set(auth(globexAdmin)).expect(200);
      expect(txs.body.data).toEqual([]);

      // La misma referencia se puede usar en otro tenant: los ledgers son independientes.
      await http()
        .post('/ledger/fund')
        .set(auth(globexAdmin))
        .send({ account: 'users:alice', asset: 'USD/2', amount: '1', reference: 'dep-001' })
        .expect(201);
    });

    it('sin token no hay acceso al ledger', async () => {
      await http().get('/ledger/world').expect(401);
      await http().post('/ledger/fund').send({}).expect(401);
    });
  });
});
