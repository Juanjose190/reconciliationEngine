# ADR-001 — Estrategia de aislamiento multi-tenant (HU 1.2)

**Estado:** aceptada · **Sprint:** 1

## Contexto

El motor atiende a varias organizaciones (tenants) desde una sola instalación. Los datos de una nunca deben ser visibles ni modificables por otra. Hay dos tipos de datos:

1. **Datos de aplicación** (tenants, usuarios): viven en PostgreSQL vía TypeORM.
2. **Datos contables** (cuentas, transacciones): viven en el ledger.

## Opciones consideradas para los datos de aplicación

| Opción | Ventajas | Desventajas |
|---|---|---|
| Base de datos por tenant | Aislamiento máximo | Costo operativo alto; migraciones × N |
| Schema por tenant | Buen aislamiento, backups por tenant | Migraciones × N; TypeORM complica el cambio de schema por petición |
| **Columna discriminadora (`tenantId`)** | Una sola migración; simple; escala a muchos tenants pequeños | Un olvido de `WHERE tenantId` es una fuga de datos |

## Decisión

- **Datos de aplicación:** columna discriminadora `tenantId`, con índice y unicidad compuesta `(tenantId, email)`.
- **Datos contables:** **un ledger por tenant** (`tenant-<slug>`), no cuentas con prefijo de tenant dentro de un ledger compartido.

## Cómo se mitiga el riesgo de la columna discriminadora

1. **El tenant sale del JWT firmado**, nunca del cuerpo, la URL ni un header que controle el cliente.
2. Todos los métodos de `UsersService` **exigen `tenantId` como primer parámetro** y lo incluyen en el `WHERE`. No existe un método que consulte usuarios sin tenant.
3. Acceder a un recurso de otro tenant devuelve **404, no 403**: no se confirma que exista.
4. El login responde igual si falla el tenant, el correo o la contraseña, y compara contra un hash de relleno para igualar tiempos.
5. Pruebas e2e que lo comprueban: listados separados, PATCH cruzado → 404, login cruzado → 401, mismo correo admitido en dos tenants, misma `reference` contable en dos tenants.

## Consecuencias

- **Positivas:** una sola migración y un solo pool de conexiones; el aislamiento contable es total porque el ledger es físicamente separado.
- **Negativas:** la disciplina del `WHERE tenantId` depende del código. Cualquier servicio futuro que lea tablas con `tenantId` debe seguir la misma regla; conviene revisarlo en cada code review.
- **Evolución posible:** si un cliente exige aislamiento físico, PostgreSQL permite añadir *row-level security* sobre `tenantId` sin cambiar la API.
