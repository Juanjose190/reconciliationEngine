# Sprint 4 — Núcleo del motor de reconciliación

**Estado:** en progreso

## Objetivo

Comparar transacciones del ledger interno con la fuente externa, clasificar diferencias y explicar causas probables.

## Plan

### Modelo
- `ReconciliationRun`: corrida con estado, período, contadores, candado por tenant
- `ReconciliationItem`: resultado por par/huérfano, con estado, breakType, montos, causa probable

### Algoritmo (HU 4.1)
1. Carga paginada de transacciones del período
2. Pasada 1: correspondencia exacta por txHash ↔ metadata.externalRef (Map hash)
3. Pasada 2: correspondencia difusa para sin referencia
4. Comparación de montos, assets, tiempos; generación de breaks
5. Detección de duplicados
6. Complejidad O(n) con hash maps

### Clasificación (HU 4.2)
- MATCHED: coincide en referencia, monto, asset, tiempo
- PENDING: contraparte externa existe pero no alcanza confirmaciones mínimas
- BREAK: diferencias con breakType específico

### Causa probable (HU 4.3)
- Reglas explícitas que generan texto descriptivo en español

### Endpoints
- POST /reconciliation/runs (ADMIN, OPERATOR)
- GET /reconciliation/runs
- GET /reconciliation/runs/:id
- GET /reconciliation/runs/:id/items (paginado, filtrable)
- GET /reconciliation/breaks
- Candado anti-concurrencia: 409 si ya hay una corrida RUNNING para el tenant

## Decisiones
- Candado con columna `status=RUNNING` + check antes de insertar (suficiente con SQLite; en Postgres se reforzaría con advisory lock)
- La ventana de tolerancia temporal por defecto: 24 horas
- Confirmaciones mínimas por defecto: 3

---

## Resultado

**Completado.** 26 unit + 58 e2e (22 nuevas del Sprint 4), todas pasando.

### Lo verificado
- Prueba reina: genera escenario con 8 tipos de discrepancia → reconcilia → detecta exactamente cada tipo
- Correspondencia exacta por txHash ↔ metadata.externalRef
- Detección de duplicados por similitud de datos (Pasada 3)
- Clasificación correcta: MATCHED, PENDING, BREAK con breakType específico
- Causas probables en español
- Candado anti-concurrencia (409)
- Aislamiento multi-tenant (404, no 403)
- Permisos por rol (AUDITOR solo lectura)
- Paginación y filtros

### Limitación conocida
- TIMING_OFFSET no es detectable en modo in-memory porque el ledger siempre usa `Date.now()` como timestamp. En producción con PostgreSQL y timestamps reales, sería detectable. El test documenta esto explícitamente.
