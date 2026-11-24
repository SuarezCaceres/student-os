# ADR 0003 · Sync con cursor por `seq` y «última edición gana»

- **Fecha:** 2026-11-23 (decisión tomada en la Ola 2 del backend; registrada al adoptar el harness)
- **Estado:** aceptada

## Contexto
La app necesita sincronizar el `AppState` entre dispositivos (PC y móvil) con un backend, tolerando clientes sin conexión y relojes desajustados. Fuente: `docs/agent-notes/SYNC-API.md`.

## Decisión
- Cada registro se identifica por `(userId, collection, id)`. El cliente envía cambios (`POST /sync/push`) y los recoge con un cursor (`GET /sync/pull?since=`).
- El cursor es un contador `seq` **por usuario**, asignado por el servidor en cada escritura (`user_sync_state.seqCounter`). Es opaco para el cliente.
- Los conflictos se resuelven con **última edición gana** por `updatedAt`, en `apps/api/src/sync/sync-logic.ts` (lógica pura). Un cambio con el mismo contenido es idempotente. Las fechas más de 5 minutos en el futuro se recortan.
- Los borrados son *tombstones* (`data = NULL`); una edición posterior puede revivir el registro.
- El push entero es una transacción. Límites: 64 KB por registro, 500 cambios por push, 5000 registros por usuario.

## Alternativas consideradas
- **`SEQUENCE` de Postgres o `now()` como cursor:** se asignan antes del commit y no se revierten, así que un lector podría ver el 10 confirmado mientras el 9 aún no, y el cursor se saltaría el 9.
- **Fusión campo a campo (CRDT):** no se consideró necesaria para un estado de un solo usuario en pocos dispositivos *(deducido; confirmar)*.

## Consecuencias
- Reescribir un registro le da un `seq` nuevo y reaparece una vez en el pull incremental.
- Si dos dispositivos editan a la vez el mismo registro, gana la edición con `updatedAt` más reciente y la otra se devuelve como `conflicts`.
- Todo dato nuevo debe encajar en una de las colecciones de `packages/shared` o ampliarla.
