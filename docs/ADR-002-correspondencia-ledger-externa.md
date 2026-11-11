# ADR-002 — Correspondencia entre el ledger interno y la fuente externa

**Estado:** aceptada · **Sprint:** 3

## Contexto

El motor de reconciliación necesita emparejar transacciones del ledger interno con transacciones de la fuente externa (blockchain simulada). Necesitamos una clave de correspondencia confiable y un mecanismo de respaldo para transacciones sin referencia.

## Decisión

### Correspondencia exacta (Pasada 1)

La clave primaria de correspondencia es:

- **Ledger:** campo `metadata.externalRef` de cada transacción.
- **Externa:** campo `txHash` de `ExternalTransaction`.

Cuando el simulador genera una transacción "sana", escribe el mismo identificador en ambos lados: el `txHash` de la transacción externa y `metadata.externalRef` del asiento contable.

### Correspondencia difusa (Pasada 2, Sprint 4)

Para transacciones del ledger sin `externalRef` (p. ej., registradas manualmente), el motor de reconciliación intentará emparejar por:

1. Mismas cuentas involucradas (mapeadas a dirección externa).
2. Mismo asset.
3. Mismo monto.
4. Diferencia temporal dentro de la ventana de tolerancia configurable.

Esto es un "mejor esfuerzo": si no hay coincidencia, la transacción queda como `MISSING_IN_EXTERNAL` o `MISSING_IN_LEDGER`.

### Transacciones sin `externalRef`

- Si una transacción del ledger no tiene `metadata.externalRef`, no se empareja en la Pasada 1, pero sí se intenta en la Pasada 2 (difusa).
- Si no se encuentra par en ninguna pasada, se clasifica como break `MISSING_IN_EXTERNAL`.
- Esto es deliberado: el motor no inventa correspondencias que no existen.

## Consecuencias

- **Positivas:** la correspondencia exacta por `txHash` es O(1) con mapas hash; la difusa es más costosa pero acotada por la ventana temporal.
- **Negativas:** la correspondencia difusa puede producir falsos positivos si dos transacciones tienen el mismo monto/asset/cuentas en la misma ventana. Por eso se aplica solo como respaldo.
- **Para producción:** se podría refinar la correspondencia difusa con scoring (distancia temporal ponderada, coincidencia parcial de cuentas).
