# Notas del agente SYNC-API (Ola 2)

Rama: `feat/be-sync-api` (parte de `integration/backend`). Alcance: `apps/api/src/{sync,profile}/**`, `prisma/schema/{sync,profile}.prisma`, tests propios, `apps/api/package.json` (solo `embedded-postgres` como devDependency) y este archivo.

## Endpoints

| Ruta | Descripcion |
| :-- | :-- |
| `GET /sync/pull?since=<cursor>&collection=&limit=` | `SyncPullResponse { records, cursor, hasMore }`. `limit` por defecto 500, maximo `MAX_PULL_LIMIT` (1000). Incluye tombstones. |
| `POST /sync/push` | Body `SyncPushRequest`. Responde **200** `{ applied, conflicts }`. |
| `GET /profile` | `{ id, email, createdAt, lastSyncAt }`. Crea el `Profile` si no existe. |

Todas protegidas por el guard global. `userId` sale SIEMPRE de `@CurrentUser()` (JWT); body/query nunca lo deciden (hay tests).
Respuestas de sync con `Cache-Control: no-store`. `PATCH /profile` NO se implemento: las preferencias (nombre, carrera, tema...) viajan por la coleccion de sync `profile` (singleton).

## Diseno del cursor (la decision importante)

- `seq` (BigInt) es un **contador por usuario** (`user_sync_state.seqCounter`) asignado por el SERVIDOR en cada escritura. Cursor = ultimo `seq` entregado, en decimal (opaco para el cliente; `0` = desde el principio). Nunca se usa el reloj del cliente ni timestamps.
- **Por que no una `SEQUENCE` de Postgres ni `now()`:** las sequences se asignan antes del commit y no se revierten, asi que un lector puede ver el `seq` 10 confirmado mientras el 9 aun no (y el cursor saltaria el 9 para siempre). Aqui cada push empieza con `INSERT ... ON CONFLICT DO UPDATE` sobre la fila del usuario: el bloqueo de fila serializa los pushes del mismo usuario hasta el commit, los `seq` se reparten desde el contador de esa fila y el contador se actualiza en la misma transaccion. Resultado: dentro de un usuario los `seq` se confirman en orden, sin huecos (un rollback revierte tambien el contador) y un lector (READ COMMITTED) nunca se salta un registro confirmado. Verificado con escritores y lector concurrentes sobre Postgres real.
- Reescribir un registro le da un `seq` nuevo: reaparece en el pull incremental una vez (la version nueva). Un reenvio idempotente NO escribe nada ni avanza el cursor.
- Pull con `collection=`: el cursor sigue siendo global del usuario.
- `unique (userId, seq)` ademas de PK `(userId, collection, id)` e indice `(userId, collection)`.

## Ultima edicion gana (`sync-logic.ts`, pura)

Por cada cambio frente a la version del servidor: sin version -> inserta (`rev` 1); **mismo contenido -> idempotente** (cuenta como `applied`, no escribe, `rev` intacto; se compara `data` con claves ordenadas; dos tombstones son iguales); `updatedAt` entrante **<=** el del servidor -> `conflicts` con la version del servidor (el empate favorece al servidor); si no, se aplica (`rev`+1). `rev` y `seq` los decide el servidor; el `rev` del cliente se ignora.

- Reloj adelantado: `updatedAt`/`deletedAt` > `ahora + 5 min` se recortan a `ahora`. El chequeo de contenido igual va ANTES del de fechas para que reintentar un cambio con fecha futura (otro "ahora") siga siendo idempotente.
- Tombstone: se guarda `data = NULL` aunque el cliente la mande. Una edicion mas nueva puede "revivir" un registro borrado.
- `data` se guarda tal como la devuelve el esquema de su coleccion (se descartan claves desconocidas, como avisa CONTRACT §5.7).
- Dos cambios con la misma clave en un push se evaluan en orden; se escribe el estado final una sola vez.
- Todo el push es UNA transaccion (bloqueo -> lectura -> decision -> cuota -> escritura en lote con un unico `INSERT ... unnest ... ON CONFLICT`).

## Limites (constantes en `src/sync/sync.constants.ts`)

| Constante | Valor | Efecto |
| :-- | :-- | :-- |
| `MAX_RECORD_DATA_BYTES` | 64 KB (JSON UTF-8 de `data`) | **413** nombrando el registro |
| `MAX_PUSH_CHANGES` (shared) | 500 | **413** |
| `MAX_RECORDS_PER_USER` | 5000 filas (tombstones incluidos) | **422**, el push entero se revierte. Editar/borrar lo existente nunca se rechaza por cuota. |
| `MAX_CLIENT_CLOCK_SKEW_MS` | 5 min | recorte a `ahora` |
| `DEFAULT_PULL_LIMIT` | 500 | `limit` por defecto |

Payload invalido -> **400** con lineas `ruta: mensaje` (p. ej. `changes[0].data.status: Invalid option...`), maximo 10, sin eco del valor recibido ni internals. Cursor/`limit`/`collection` invalidos -> 400.

## Capa de datos

`SyncRepository` (interfaz, `sync.types.ts`) con `PrismaSyncRepository` (token `SYNC_REPOSITORY` en `SyncModule`) e `InMemorySyncRepository` (tests; imita bloqueo por usuario y atomicidad). Igual para perfil (`ProfileRepository`). `SyncService` acepta un reloj inyectable (`SYNC_CLOCK`, solo tests).
Exports para otros agentes: `SyncModule` exporta `SyncService` con **`deleteAllForUser(userId): Promise<number>`** (borra registros y estado/cursor del usuario; NO borra `Profile`: lo hace PUBLIC). `ProfileModule` exporta `ProfileService.ensure(userId)`.

Modelos: `SyncItem` (`sync_records`) y `UserSyncState` (`user_sync_state`: `seqCounter`, `lastSyncAt`) en `sync.prisma`. `profile.prisma` queda sin modelos a proposito: `Profile` es de `base.prisma`; el email vive en el JWT; `lastSyncAt` esta en `UserSyncState`. Sin `@relation` a `Profile`.

## Como probar

Desde `apps/api`: `npm test` (unitarios + e2e), `npm run test:e2e`. Los escenarios (`test/helpers/sync-scenarios.ts`) corren contra el repositorio en memoria (`src/sync/sync.service.spec.ts`) y contra Postgres REAL (`test/sync-prisma.e2e-spec.ts`).
La capa Prisma usa `embedded-postgres` (devDependency, version exacta `18.6.0-beta.19`, sin Docker): `test/helpers/sync-pg.ts` lanza `sync-pg-server.mjs` en un proceso hijo (el paquete es ESM-only), puerto **54329**, base temporal, UTF8, y hace `prisma db push` en el schema privado `?schema=dev_sync_api`. Sin credenciales reales ni Supabase; no se crean migraciones. Necesita el puerto 54329 libre y descargar el binario via npm (`@embedded-postgres/<plataforma>`).

## Variables de entorno nuevas

Ninguna.

## Para el Integrador

1. **Migracion**: `sync_records` y `user_sync_state` (las crea `prisma migrate dev` al consolidar la ola). Regenerar el lockfile (`embedded-postgres` es devDependency de `apps/api`; el lock no se commitea desde este worktree).
2. **`rls-baseline.sql`**: ejecutarlo tras la migracion; cubre automaticamente `sync_records` y `user_sync_state` (itera todas las tablas de `public`). Verificar con la consulta de 0 filas del README.
3. Sin FK a `profiles`: si se quiere, anadirla en la migracion con `ON DELETE CASCADE` (`sync_records."userId"` y `user_sync_state."userId"`).
4. Con Supabase/pgbouncer (transaction mode): el repositorio usa transacciones interactivas y `$executeRaw` parametrizado; funcionan con `?pgbouncer=true`. No probado contra Supabase.

## Deuda y avisos al resto de agentes

1. **Cuerpo > 1 MB devuelve 500 en vez de 413** (error de body-parser, no es `HttpException`; `all-exceptions.filter.ts` de API-CORE). Ademas el limite de 1 MB global puede quedarse corto para 500 cambios grandes: el cliente (SYNC-WEB) debe partir los lotes por bytes (~500 KB) ademas de por numero.
2. Semantica de `applied` (contrato): es una lista de ids sin coleccion; si un push lleva el mismo `id` en dos colecciones distintas, el cliente debe cruzar con `conflicts[].collection`.
3. Fecha futura recortada: si el cliente conserva su `updatedAt` local (futuro) tras un `applied`, vera el del servidor (recortado) en el siguiente pull. SYNC-WEB debe adoptar el `updatedAt` del servidor.
4. Los tombstones cuentan en la cuota y no se purgan. Falta un job de purga (p. ej. tombstones > 90 dias, ya replicados a todos los dispositivos).
5. Un cursor mayor que el contador del usuario (p. ej. tras `deleteAllForUser` o resetear la BD) devuelve vacio para siempre; no hay senal de "reinicia desde 0". Posible mejora: 409 con `resetRequired`.
6. `lastSyncAt` se actualiza tambien en cada pull (mejor esfuerzo, sin esperar).
7. Perfil: `ensure` hace un upsert por peticion (sin cache) a proposito: un cache en memoria quedaria obsoleto tras el borrado de cuenta.
8. Singletons (`profile`, `gym-profile`...): LWW sobre el objeto entero (limitacion ya aceptada en CONTRACT).
