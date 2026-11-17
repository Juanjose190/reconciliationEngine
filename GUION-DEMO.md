# Guion de Presentación — Reconciliation Engine

## Antes de empezar (preparación)

Tener dos terminales listas:

```bash
# Terminal 1: Backend
DB_TYPE=sqljs JWT_SECRET=test-secret-for-dev PORT=3002 PLATFORM_ADMIN_KEY=test-platform-key LEDGER_DRIVER=memory npx ts-node src/main.ts
```

```bash
# Terminal 2: Frontend
cd frontend && npm run dev
```

Crear el tenant de prueba (una sola vez):

```bash
curl -X POST http://localhost:3002/tenants \
  -H "Content-Type: application/json" \
  -H "x-platform-key: test-platform-key" \
  -d '{"slug":"demo","name":"Demo Company","adminEmail":"admin@demo.com","adminPassword":"Admin123!"}'
```

Credenciales: tenant `demo`, email `admin@demo.com`, password `Admin123!`

---

## 1. Introducción (2 min)

> "Este proyecto es un **motor de reconciliación financiera multi-tenant** para empresas fintech. ¿Qué problema resuelve? Cuando una fintech maneja dinero, tiene al menos dos fuentes de verdad: su **ledger interno** (donde registra las transacciones contables) y las **fuentes externas** (blockchain, bancos, pasarelas de pago). El problema es que estas fuentes pueden no coincidir: se pierde una transacción, los montos no cuadran, hay duplicados. La reconciliación es el proceso de comparar ambas fuentes y detectar las diferencias."

> "En el mundo real, esto lo hacen manualmente en Excel. Nuestro motor lo automatiza."

### Qué decir sobre la arquitectura:

> "El backend está construido con **NestJS** (framework de Node.js basado en TypeScript) con **TypeORM** como ORM y **PostgreSQL** como base de datos. El frontend es **Next.js 14** con **Tailwind CSS**. Para la demo uso SQLite en memoria para no depender de PostgreSQL."

---

## 2. Multi-tenancy y seguridad (1 min)

> "El sistema es **multi-tenant**: múltiples empresas pueden usar la misma instancia, cada una aislada. Cuando un usuario se autentica, recibe un **JWT** (JSON Web Token) que contiene su `tenantId`. Todas las consultas a la base de datos filtran por ese tenant automáticamente."

**Si preguntan por seguridad, decir:**

> "Hay tres niveles de protección:
> 1. **JwtAuthGuard** — verifica que el token sea válido
> 2. **RolesGuard** — verifica que el usuario tenga el rol necesario (ADMIN, OPERATOR, VIEWER)
> 3. **Filtrado por tenant** — el `tenantId` NUNCA viene del cliente, siempre se extrae del JWT firmado. Si intentas acceder a un recurso de otro tenant, recibes un 404, no un 403, para no revelar que el recurso existe."

---

## 3. Demo — Login (mostrar pantalla)

> "Aquí vemos el login. El diseño usa una paleta de colores 'botánica': fondo crema, tipografía EB Garamond para los títulos y Be Vietnam Pro para el cuerpo. Los inputs no tienen bordes redondeados — es una decisión de diseño intencional."

**Ingresar las credenciales y hacer login.**

---

## 4. Demo — Ejecuciones vacías (mostrar la tabla)

> "Después del login vemos la vista de **Ejecuciones** (reconciliation runs). Ahora está vacía porque no hay transacciones. Vamos a generar datos."

---

## 5. Demo — Simulador de blockchain (en la terminal)

> "El proyecto incluye un **simulador de blockchain** que genera transacciones de prueba con discrepancias controladas. Esto nos permite testear todos los escenarios sin depender de una blockchain real."

Ejecutar en terminal:

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenant":"demo","email":"admin@demo.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -X POST http://localhost:3002/simulator/scenarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "seed": 42,
    "count": 50,
    "discrepancies": {
      "AMOUNT_MISMATCH": 3,
      "MISSING_IN_EXTERNAL": 2,
      "MISSING_IN_LEDGER": 2,
      "DUPLICATE_EXTERNAL": 1,
      "ASSET_MISMATCH": 1,
      "TIMING_OFFSET": 2
    }
  }'
```

> "Le dije: genera 50 transacciones, de las cuales 3 van a tener montos diferentes entre el ledger y la fuente externa, 2 van a faltar en la fuente externa, 2 van a faltar en el ledger, y así. Esto simula errores reales que pasan en producción."

---

## 6. Demo — Correr la reconciliación (clic en "Nueva Ejecución")

Volver al browser y hacer clic en **Nueva Ejecución**.

> "Al hacer clic, el motor:
> 1. Toma un **advisory lock** en PostgreSQL para que solo una ejecución ejecute a la vez (evita condiciones de carrera)
> 2. Consulta todas las transacciones del **ledger** en el período
> 3. Consulta todas las transacciones de la **fuente externa**
> 4. Las compara una por una usando el `txHash` como clave de cruce
> 5. Clasifica cada par como **MATCHED** o como un tipo específico de **BREAK**"

**Cuando aparezca la tabla con resultados:**

> "Aquí vemos que de 51 items del ledger, 42 hicieron match y 12 son breaks. La **barra de fase** (la barra verde y roja) muestra visualmente la proporción. La tasa de match es del 82%."

---

## 7. Demo — Tipos de break (ir a la pestaña Breaks)

Hacer clic en **Breaks**.

> "Cada break está **clasificado** con un tipo. Los 8 tipos que maneja el motor son:"

| Tipo | Qué significa | Ejemplo real |
|------|--------------|--------------|
| **AMOUNT_MISMATCH** | La transacción existe en ambos lados pero los montos no coinciden | El ledger dice $500, la blockchain dice $498 |
| **MISSING_IN_EXTERNAL** | Existe en el ledger pero no en la fuente externa | Se registró internamente pero la blockchain no la confirma |
| **MISSING_IN_LEDGER** | Existe en la fuente externa pero no en el ledger | La blockchain tiene una tx que nunca se registró internamente |
| **DUPLICATE_EXTERNAL** | La fuente externa tiene la misma transacción repetida | Doble cobro en la pasarela de pago |
| **DUPLICATE_LEDGER** | El ledger tiene la misma transacción repetida | Error de registro interno |
| **ASSET_MISMATCH** | Los activos/monedas no coinciden | El ledger dice USD, la blockchain dice COP |
| **TIMING_OFFSET** | Las fechas están demasiado lejos entre sí | Se registró con 3 días de diferencia |
| **UNCONFIRMED** | La transacción externa no tiene confirmaciones suficientes | La tx de blockchain tiene 0 confirmaciones |

> "Cada break muestra una **comparación dual**: lado Ledger vs lado Externo, como si fueran dos especímenes botánicos que comparas lado a lado. Esto es lo que un operador financiero necesita para decidir qué hacer."

**Mostrar el panel de resolución (clic en "Resolver" en algún break):**

> "El operador puede resolver cada break eligiendo una acción:
> - **Aceptar Ledger**: el ledger tiene razón, la fuente externa está mal
> - **Aceptar Externa**: la fuente externa tiene razón, hay que corregir el ledger
> - **Ajustar**: se necesita un ajuste manual
> - **Ignorar**: es un falso positivo"

---

## 8. Demo — Reportes (ir a pestaña Reportes)

> "El reporte consolida todo: cuántas ejecuciones, tasa de match global, breaks abiertos, tasa de resolución. Abajo tenemos la **clasificación de breaks** con barras proporcionales — se ve de un vistazo cuál es el tipo de error más frecuente. Y la **distribución de items** muestra qué porcentaje del total son matches, breaks y pendientes."

---

## 9. Demo — Salud del sistema (ir a pestaña Salud)

> "Esta vista llama al endpoint `/health` del backend. Usa **Terminus** de NestJS para verificar que la base de datos esté activa. En producción esto es lo que conectarías a un sistema de monitoreo como Grafana o Datadog."

---

## 10. Aspectos técnicos a resaltar (si preguntan)

### Manejo del dinero
> "Todos los montos se manejan como **enteros en la unidad mínima** (centavos). En el código son `bigint`, en JSON se transmiten como **string** (`"500000"`, no `500000`). Nunca usamos `float` o `number` para dinero porque los números de punto flotante tienen errores de precisión. Por ejemplo, `0.1 + 0.2 !== 0.3` en JavaScript."

### Contabilidad de partida doble
> "El ledger implementa **contabilidad de partida doble**: cada transacción tiene postings que mueven dinero de una cuenta origen a una cuenta destino. La suma de débitos siempre es igual a la suma de créditos. Solo la cuenta `world` puede quedar en negativo (es la fuente de fondos)."

### Patrón LedgerPort (inyección de dependencias)
> "El ledger se conecta a través de una **interfaz** (`LedgerPort`). En pruebas y desarrollo usamos un ledger **en memoria**. En producción se conecta a **Formance Ledger v2** vía HTTP con OAuth2. El código de reconciliación no sabe cuál está usando — eso es inversión de dependencias."

### Advisory locks
> "Para evitar que dos ejecuciones se ejecuten al mismo tiempo, usamos **advisory locks de PostgreSQL** (`pg_try_advisory_lock`). Es un lock a nivel de base de datos que no bloquea tablas, solo impide que otro proceso tome el mismo lock."

### Nice-to-haves implementados
> "Además del core, el proyecto incluye:
> - **Swagger** (documentación automática de la API en `/api`)
> - **Health check** (`/health` con Terminus)
> - **Helmet** (headers de seguridad HTTP)
> - **Pino** (logging estructurado en JSON)
> - **Prometheus metrics** (`/metrics` para monitoreo)
> - **Rate limiting** (protección contra abuso de API)
> - **Seed script** (para poblar datos iniciales)"

---

## 11. Cierre (30 seg)

> "En resumen: este motor automatiza un proceso que en muchas fintechs se hace manual. Detecta 8 tipos de discrepancias, permite resolverlas con trazabilidad, es multi-tenant y está preparado para producción con health checks, métricas y seguridad. El frontend sigue un sistema de diseño coherente pensado para equipos de operaciones financieras que miran esta pantalla todo el día."

---

## Preguntas frecuentes del profesor

**¿Por qué NestJS y no Express puro?**
> "NestJS nos da estructura: módulos, inyección de dependencias, guards, decoradores. Para un proyecto con múltiples dominios (auth, tenants, reconciliation, ledger) esa estructura es necesaria."

**¿Por qué no usaron un ORM más simple?**
> "TypeORM soporta tanto PostgreSQL como SQLite (sqljs), lo que permite correr tests en memoria sin levantar una base de datos real."

**¿Se podría escalar?**
> "Sí. El advisory lock ya previene concurrencia. Para escalar horizontalmente, se podría particionar por tenant (cada tenant su base de datos) o usar una cola de mensajes para las ejecuciones."

**¿Qué es Formance?**
> "Es un ledger open-source que implementa contabilidad de partida doble. Es como tener un libro contable programable. Lo usamos a través de su API HTTP."

**¿Qué es multi-tenant?**
> "Significa que una sola instancia del software sirve a múltiples clientes (tenants) de forma aislada. Es como un edificio de apartamentos: todos comparten la estructura, pero cada uno tiene su espacio privado. Los datos de un tenant nunca se mezclan con los de otro."

**¿Qué framework de frontend usaron?**
> "Next.js 14 con App Router. Es un framework de React que maneja routing, server-side rendering y optimización de fuentes automáticamente. El diseño usa Tailwind CSS para los estilos."
