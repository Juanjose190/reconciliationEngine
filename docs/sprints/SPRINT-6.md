# Sprint 6 — Reportes, hardening y despliegue

**Estado:** completado

## Objetivo

Reportes de métricas, contenerización, CI, y documentación final.

## Implementación

### Reportes (HU 6.1)
- `GET /reconciliation/report?periodFrom=...&periodTo=...` — resumen ejecutivo del período
  - Contadores de corridas (total, completadas, fallidas)
  - Contadores de items (total, matched, breaks, pending)
  - Breaks desglosados por tipo
  - Tasa de resolución (porcentaje resuelto vs total breaks)
  - Fecha de última corrida
- Accesible por ADMIN, OPERATOR y AUDITOR

### Docker
- `Dockerfile` multi-stage (builder + runtime alpine)
- `docker-compose.yml` con PostgreSQL 16 + healthcheck
- Variables de entorno documentadas en `.env.example`

### CI
- GitHub Actions: `npm ci → unit tests → e2e tests` en Node 22

## Lo verificado
- Reporte genera métricas correctas tras escenario + reconciliación + resolución parcial
- Docker build pasa (verificado por CI)
- Todos los tests anteriores siguen pasando

## Limitaciones conocidas y honestas
- **TIMING_OFFSET**: no detectable en modo in-memory ledger (timestamp siempre es `Date.now()`). Documentado en test y ADR-003.
- **Formance adapter**: implementado pero NO verificado contra un Formance real. Solo el in-memory ledger está probado.
- **Frontend**: no incluido. La API está lista para consumirse desde cualquier frontend.
- **Advisory locks**: el candado anti-concurrencia usa `status=RUNNING` check. En PostgreSQL con alta carga, se reforzaría con advisory lock.
