# Notas del agente KANBAN-UNI (Ola 3) — adaptadores de sync: kanban, universidad, aprendizaje

Rama: `feat/be-kanban-uni`. Alcance real tocado: `apps/web/src/sync/adapters/{kanban,university,learning}.ts`,
`apps/web/src/sync/adapters/__tests__/**` y este archivo. **No se tocó** `packages/shared`, `apps/api`, componentes,
`App.tsx`, `sync/engine.ts` ni ningún `package.json`.

## 1. Por qué no hay cambios en la API

El servidor ya guarda cualquier colección en `sync_records` y valida `data` con `@student-os/shared`
(`KanbanItemSchema`, `UniversityAssignmentSchema`, `WeeklyReflectionSchema`). No se crearon tablas, CRUD ni migraciones:
`apps/api/src/{kanban,university}` y los `.prisma` de esos módulos siguen vacíos. Todo el trabajo está en el cliente.

## 2. Ids

| Colección | Entidad | id del registro |
| :-- | :-- | :-- |
| `kanban` | `KanbanItem` | `item.id` (`k1`, `k-1731500000000`) |
| `university` | `UniversityAssignment` | `assignment.id` (`uni-1`, `uni-1731500000000`) |
| `learning` | `WeeklyReflection` | la semana en texto, `weeklyReflectionRecordId(week)` (`"5"`) |

- Learning: la clave del mapa `weeklyReflections` y `reflection.week` son lo mismo en la app. Si discrepan, **manda la clave**
  (`select` normaliza `data.week = Number(clave)`). Claves no numéricas se ignoran. En `apply` solo se aceptan ids canónicos
  (`"5"`, no `"05"`) y `data.week` debe coincidir con el id; si no, el registro se descarta.
- `select` omite entidades sin `id` string/vacío y deduplica ids repetidos (se queda con la primera).

## 3. Qué viaja y qué no

`select` envía solo las claves definidas en el esquema de `shared` (así un campo solo-local futuro no genera pushes inútiles).
`apply` **conserva** en la entidad local las claves que el esquema no conoce (campos locales que no viajan) y reemplaza el resto por
lo remoto (si el servidor ya no trae un opcional, p. ej. `dueDate`, desaparece también en local: última edición gana sobre la entidad completa).
Hoy no existe ningún campo solo-local en estas tres entidades (los tipos de `types/index.ts` coinciden con `shared`).

## 4. Orden (decisión clave)

Los registros no traen posición y la UI usa el orden del array (la UI antepone las altas: `[nuevo, ...lista]`). Sin tocar
`App.tsx` ni añadir campos, se eligió un **comparador total y determinista** que se aplica a la lista tras un `apply` que cambió algo:

| Lista | Orden | Motivo |
| :-- | :-- | :-- |
| `kanbanItems` | `createdAt` desc, luego id "natural" desc | "lo más nuevo primero" = comportamiento del prepend actual |
| `universityAssignments` | `week` asc, luego id natural desc | la vista agrupa por semana; dentro de la semana, lo más nuevo primero |
| `weeklyReflections` | claves enteras (JS las recorre ascendente) | es un objeto: no hay lista que ordenar |

- "id natural" = trozos numéricos comparados como números (`k-10` > `k-3`; `k-1731500000001` > `k-1731500000000`), sin `localeCompare`
  (independiente de idioma/ICU). Los ids con timestamp (`k-<Date.now()>`) quedan por encima de los heredados (`k1`).
- El resultado depende **solo del conjunto** de entidades, no del orden de llegada ni del dispositivo; hay una prueba con todas las permutaciones.
- Si `apply` no cambia nada devuelve **la misma referencia** de estado (no se reordena ni se dispara render).
- No se añadió campo `order` a `shared`: un índice por posición habría reescrito todos los registros en cada alta (el prepend desplaza todo).

Efectos visibles a tener en cuenta:
1. Con datos heredados del estado inicial, el primer `apply` remoto que modifique la lista reordena kanban/universidad con este criterio
   (p. ej. `k1..k5` pasan a `k3,k2,k5,k4,k1`). Es una vez y consistente en todos los dispositivos.
2. El dispositivo **que origina** una alta conserva su orden local hasta que reciba un `apply` real; como el prepend ya coincide con el
   comparador en el uso normal (misma fecha, id creciente), no se observa diferencia. Solo ediciones manuales del array con otro orden
   (no hay en la UI: no existe reordenación manual) podrían diferir entre origen y destinos hasta el siguiente `apply`.
3. Drag & drop del Kanban solo cambia `status`; no hay reordenación manual que perder.

## 5. `apply`: semántica

- Inmutable (probado con `deepFreeze`) e idempotente.
- Por id, dentro de un lote se usa el registro de `updatedAt` más reciente (empate: el último). Un tombstone más nuevo gana a una edición anterior.
- Tombstone (`deletedAt != null`): elimina; sobre una entidad inexistente es no-op (misma referencia).
- Datos inválidos (esquema, `data: null` en un registro vivo, id de datos distinto al del registro) se **ignoran con `console.warn`** sin tocar el estado
  ni impedir los demás registros del lote. El motor ya descarta lo que no cumple el contrato antes; esto es defensa en profundidad.
- Duplicados locales del mismo id se colapsan al reemplazar.
- Solo cambia su slice: el resto de `AppState` conserva sus referencias.

Los helpers genéricos (`naturalCompare`, `selectEntities`, `applyEntityRecords`, `pickKnown`) viven en `kanban.ts` y los reutilizan university/learning
(no se creó un archivo nuevo para respetar el alcance).

## 6. Sin regresiones

Confeti, semáforo de vencimiento (`getAssignmentUrgency`) y GPA (`calculateOverallGpa`) no se tocaron; hay pruebas de que el round-trip no altera su salida.
`academicStats.ts` y los componentes no necesitaron cambios.

## 7. Pruebas (`apps/web/src/sync/adapters/__tests__/`)

- `kanban.test.ts`, `university.test.ts`, `learning.test.ts`: select sobre `initialData` real validado con `SyncRecordSchema` de shared, round-trip
  select→contrato→apply, alta/edición/borrado, idempotencia, tombstone, entidad inexistente, datos inválidos, campos locales, orden estable.
- `engine.integration.test.ts`: motor REAL + `FakeServer` (helpers de SYNC-WEB, solo lectura) con los tres adaptadores reales: A→B→A, sin eco, orden idéntico,
  conflicto, offline→online, registro inválido del servidor.
- `testUtils.ts`: utilidades de prueba (no es un test).

## 8. Limitaciones / deuda

- Sin reordenación manual ni orden persistente: si en el futuro se añade drag-to-reorder dentro de columna, habrá que añadir un campo opcional
  `order` (fraccional) en `shared/src/kanban.ts` y cambiar el comparador.
- Singleton por entidad: dos dispositivos editando campos distintos de la MISMA tarea/entrega en el mismo instante → gana la última edición completa (límite del contrato LWW).
- `weeklyReflections` completo se reenvía cuando cambia una semana (un registro por semana; incluye todos sus recursos). Máx. 64 KB por registro en el servidor.
- Borrar una entidad y volver a crearla con el mismo id revive el registro (tombstone sobrescrito por una edición más nueva), comportamiento del servidor.
- No verificado contra la API/Supabase reales ni en navegador: solo Vitest con API simulada.

## 9. Para el Integrador

- Nada que cambiar en `App.tsx`, `adapters/index.ts` (ya registra los tres adaptadores) ni en `shared`.
- Sin variables de entorno nuevas, sin dependencias nuevas, sin migraciones.
- Los tests importan `fake-indexeddb` (ya es devDependency de `apps/web`).
