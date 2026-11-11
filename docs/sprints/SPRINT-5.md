# Sprint 5 — Resolución y programación

**Estado:** completado

## Objetivo

Permitir resolver breaks con auditoría (quién, cuándo, qué acción, nota) y programar corridas automáticas.

## Implementación

### Resolución de breaks (HU 5.1)
- `PATCH /reconciliation/items/:id/resolve` — requiere `action` (ACCEPT_LEDGER, ACCEPT_EXTERNAL, ADJUST, IGNORE) y `note`
- `PATCH /reconciliation/items/:id/reopen` — vuelve a OPEN
- Solo ADMIN y OPERATOR pueden resolver/reabrir; AUDITOR solo lectura
- Break resuelto no aparece en `GET /reconciliation/breaks` (filtra por `resolutionStatus=OPEN`)
- Registro de auditoría: `resolvedBy` (userId), `resolvedAt`, `resolutionAction`, `resolutionNote`

### Scheduler (HU 5.2)
- `ReconciliationSchedulerService` con lifecycle hooks (OnModuleInit/OnModuleDestroy)
- Configurable vía env: `RECON_CRON_ENABLED`, `RECON_CRON_INTERVAL_MS`, `RECON_CRON_WINDOW_HOURS`
- Deshabilitado por defecto; ejecuta reconciliación para todos los tenants activos
- Tolerante a fallos: un tenant fallido no bloquea los demás

## Decisiones
- No se usó `@nestjs/schedule` (es ESM-only, el proyecto es CommonJS). Se implementó con `setInterval` y lifecycle hooks.
- El scheduler está deshabilitado por defecto para no interferir con tests.

## Resultado

10 e2e tests: resolver, reabrir, permisos, validación de DTOs. Todas pasando.
