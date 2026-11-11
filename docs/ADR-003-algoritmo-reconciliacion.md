# ADR-003 — Algoritmo de reconciliación

**Estado:** aceptado  
**Fecha:** 2026-11-10

## Contexto

Se necesita comparar las transacciones del ledger interno con las de la fuente externa (blockchain simulada) para detectar discrepancias ("breaks"), clasificarlas y generar causas probables en español.

## Decisión

### Dos pasadas

1. **Pasada 1 — correspondencia exacta**: se indexan las transacciones externas por `txHash` y las del ledger por `metadata.externalRef` en `Map<string, T[]>`. La correspondencia es O(n) gracias a los hash maps.

2. **Pasada 2 — correspondencia difusa**: para transacciones del ledger sin `externalRef`, se busca por `asset + monto` dentro de una ventana temporal configurable (por defecto 24h).

### Detección de duplicados

Antes de la correspondencia 1:1, se detectan entradas con el mismo `txHash`/`externalRef` que aparecen más de una vez en la misma fuente → `DUPLICATE_EXTERNAL` o `DUPLICATE_LEDGER`.

### Clasificación de cada par

En orden de prioridad:
1. **PENDING**: la transacción externa tiene `status=PENDING` y pocas confirmaciones (por defecto < 3)
2. **ASSET_MISMATCH**: los assets no coinciden
3. **AMOUNT_MISMATCH**: los montos difieren (comparación bigint exacta)
4. **TIMING_OFFSET**: los tiempos difieren más allá de la ventana de tolerancia
5. **MATCHED**: todo coincide

### Huérfanos

- Transacción en el ledger sin contraparte → `MISSING_IN_EXTERNAL`
- Transacción externa sin contraparte → `MISSING_IN_LEDGER`

### Candado anti-concurrencia

Antes de iniciar una corrida, se verifica que no exista otra con `status=RUNNING` para el mismo `tenantId`. Si existe, se responde 409. En PostgreSQL se reforzaría con advisory lock; en SQLite la serialización es implícita.

## Complejidad

- Temporal: O(n + m) donde n = transacciones del ledger, m = transacciones externas
- Espacial: O(n + m) por los hash maps

## Consecuencias

- Soporta al menos 100,000 transacciones por fuente sin bucles anidados
- La ventana de tolerancia y las confirmaciones mínimas son configurables por corrida
- Las causas probables se generan en español, directamente legibles por el usuario final
- La resolución de breaks (Sprint 5) opera sobre los items ya clasificados
