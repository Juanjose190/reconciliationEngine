# Motor de reconciliación multi-tenant — Sprints 1 y 2

NestJS 11 · TypeORM 0.3 · PostgreSQL · Formance Ledger (con ledger en memoria para desarrollo y pruebas).

Cubre las historias de usuario de los dos primeros sprints del backlog:

| Sprint | HU | Qué hay |
|---|---|---|
| 1 | 1.1 | `POST /tenants` (clave de plataforma) crea el tenant y su primer ADMIN en una transacción |
| 1 | 1.2 | Aislamiento por **columna discriminadora** `tenantId` + un ledger por tenant (ver `docs/ADR-001-aislamiento-multi-tenant.md`) |
| 1 | 1.3 | Roles `ADMIN` / `OPERATOR` / `AUDITOR` con `RolesGuard`; gestión de usuarios en `/users` |
| 1 | 6.3 | `POST /auth/login` → JWT con `tenantId`, `tenantSlug` y rol; `GET /auth/me` |
| 2 | 2.1 | `POST /ledger/transactions`: postings de partida doble, atómicos, con referencia idempotente |
| 2 | 2.2 | Nomenclatura de cuentas validada (`users:alice`, `banks:bancolombia:main`…) y assets `USD/2`, `COP/2`, `BTC/8` |
| 2 | 2.3 | **World Account** (`world`): `POST /ledger/fund` (world → cuenta), `POST /ledger/withdraw`, `GET /ledger/world` |
| 2 | 2.4 | Historial: `GET /ledger/accounts/:address/transactions` y `GET /ledger/transactions` |

## Arranque rápido

```bash
npm install
cp .env.example .env        # ajusta secretos y datos de PostgreSQL
npm run build && npm start  # o: npm run start:dev
```

Sin PostgreSQL a mano, para probar localmente:

```bash
DB_TYPE=sqljs JWT_SECRET=un-secreto-largo PLATFORM_ADMIN_KEY=clave LEDGER_DRIVER=memory npm run start:dev
```

## Pruebas

```bash
npm test          # 21 pruebas unitarias: partida doble, atomicidad, sobregiros, nomenclatura
npm run test:e2e  # 23 pruebas e2e: tenants, login, aislamiento, RBAC, ledger (SQLite en memoria)
```

## Ejemplo de uso

```bash
# 1. Crear tenant (operador de plataforma)
curl -X POST :3000/tenants -H 'x-platform-key: $PLATFORM_ADMIN_KEY' -H 'content-type: application/json' \
  -d '{"slug":"demo","name":"Demo SA","adminEmail":"admin@demo.com","adminPassword":"password-1234"}'

# 2. Login
curl -X POST :3000/auth/login -H 'content-type: application/json' \
  -d '{"tenant":"demo","email":"admin@demo.com","password":"password-1234"}'

# 3. Ingresar dinero (world → users:alice) y consultar
curl -X POST :3000/ledger/fund -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"account":"users:alice","asset":"COP/2","amount":"500000","reference":"dep-001"}'
curl :3000/ledger/accounts/users:alice/balances -H "authorization: Bearer $TOKEN"
```

Los montos son **enteros en la unidad mínima, enviados como texto** (`"500000"` con `COP/2` = 5.000,00).

## Reglas del ledger

- Cada posting mueve `amount` de `source` a `destination`: la suma de todos los saldos de un asset es siempre 0.
- Una transacción es **atómica**: si un posting falla, no se aplica ninguno.
- `world` puede quedar en negativo (es el dinero que entró desde fuera); ninguna otra cuenta puede sobregirarse (422).
- Repetir una `reference` en el mismo ledger devuelve 409. Distintos tenants son ledgers independientes.

## Pendiente / limitaciones conocidas

- **`FormanceLedger` no está verificado contra un servidor real de Formance.** Está escrito sobre la API v2; antes de usar `LEDGER_DRIVER=formance` hay que correr un smoke test contra tu instancia. Además solo admite montos ≤ 2^53 (límite de `Number` en JSON).
- **PostgreSQL no se probó aquí** (el entorno no tiene servidor). Las pruebas usan SQLite en memoria (`sql.js`); las entidades usan tipos portables, pero hay que validar el arranque con tu Postgres.
- **Sin migraciones:** `DB_SYNC=true` crea las tablas en desarrollo. Para producción falta generar migraciones de TypeORM.
- El ledger en memoria pierde los datos al reiniciar; es solo para desarrollo y pruebas.
- No hay rate limiting en `/auth/login` ni rotación de claves JWT.
- La lista de raíces de cuenta (`banks`, `blockchain`, `users`, `fees`, `suspense`) está fija en `src/ledger/account-path.ts`; no es configurable por tenant.

## Siguiente: Sprint 3

Fuente externa simulada (blockchain ficticia), escenarios con discrepancias intencionales y API base de consulta; sobre eso se construye el motor de reconciliación del Sprint 4.
