# Sprint 3 — Fuente externa simulada + API base

**Estado:** en progreso

## Objetivo

Tener una segunda fuente de verdad (blockchain simulada) contra la cual comparar, con escenarios de discrepancias intencionales, y una API de consulta con paginación.

## Plan

### HU 3.1 — Simulación de blockchain ficticia
- **Entidad `ExternalTransaction`** en BD con `tenantId` indexado, campos: id, tenantId, chain, txHash (único por tenant+chain+txHash), fromAddress, toAddress, asset, amount (texto/numeric → bigint), observedAt, confirmations, status (PENDING|CONFIRMED|FAILED), scenarioId (nullable), raw (json).
- **`BlockchainSimulatorService`**: genera transacciones deterministas con PRNG con semilla. Cada tx "sana" crea ambas caras: un movimiento en el ledger (cuentas `blockchain:<chain>:treasury ↔ users:<nombre>`) con `metadata.externalRef = txHash`, y su `ExternalTransaction` correspondiente.
- Correspondencia: `txHash ↔ metadata.externalRef` (documentado en ADR-002).

### HU 3.2 — Escenarios con discrepancias intencionales
- `POST /simulator/scenarios` (ADMIN, OPERATOR)
- Body: `seed`, `count`, `discrepancies` (cantidad por tipo), `reference` opcional
- Tipos: AMOUNT_MISMATCH, MISSING_IN_EXTERNAL, MISSING_IN_LEDGER, DUPLICATE_EXTERNAL, DUPLICATE_LEDGER, ASSET_MISMATCH, TIMING_OFFSET, UNCONFIRMED
- Validar: count máx 10.000, suma discrepancias ≤ count
- Devuelve resumen de lo inyectado (verdad esperada)

### HU 6.1 — API base de consulta
- `GET /external/transactions` y `GET /ledger/transactions` con paginación (offset), filtros, orden estable
- `PaginationDto` reutilizable, formato `{ data, page: { limit, offset, total } }`
- `GET /ledger/accounts` con saldos (nueva operación `listAccounts` en `LedgerPort`)
- OpenAPI con `@nestjs/swagger` en `/docs` (solo fuera de producción)

## Entidades nuevas

- `ExternalTransaction` (`src/external/external-transaction.entity.ts`)

## Módulos nuevos

- `BlockchainSimModule` (`src/blockchain-sim/`)
- `ExternalModule` (`src/external/`)

## Decisiones

- PRNG: implementación de Mulberry32 (simple, determinista, rápida) — no se necesita calidad criptográfica, solo reproducibilidad.
- La paginación usa offset+limit por simplicidad; cursor sería mejor para datasets gigantes pero offset es suficiente para el alcance académico.
- `listAccounts` en `LedgerPort`: devuelve todas las cuentas con saldos; en `InMemoryLedger` se extrae del mapa de balances.

---

## Resultado (se completa al cerrar el sprint)

_Pendiente_
