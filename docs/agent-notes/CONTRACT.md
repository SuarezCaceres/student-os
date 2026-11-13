# Notas del agente CONTRACT (Ola 1) — `@student-os/shared`

Rama: `feat/be-contract`. Alcance: `packages/shared/**` y este archivo.

> **Regla de oro (Ola 2+):** este paquete es **solo aditivo**. Cada agente edita únicamente su archivo
> `packages/shared/src/<modulo>.ts`. Prohibido renombrar o borrar tipos/esquemas ya publicados.
> `index.ts` solo reexporta (un módulo nuevo = una línea, la añade el Integrador).

## 1. Paquete y build

- Nombre `@student-os/shared`, `"type": "module"`, compilado con **tsup** a ESM (`dist/index.js`),
  CJS (`dist/index.cjs`) y tipos (`dist/index.d.ts` / `dist/index.d.cts`). `exports` con condiciones
  `import` y `require`, cada una con su `types`. Web (Vite, ESM) y Nest (CJS) consumen el mismo paquete.
- `zod` ^4.6.7 es dependencia **runtime** (externa, no empaquetada). Web y API deben usar zod 4 para
  evitar dos copias incompatibles (INFRA/API-CORE: declarar `zod` ^4 en sus workspaces).
- devDependencies: `tsup`, `typescript`, `vitest`. **TypeScript del paquete = ^6.0.3, no 7.** Motivo:
  `tsup@9` genera `.d.ts` con `rollup-plugin-dts`, que necesita la API de compilador de TS; TS 7.0.2
  (el del frontend) no la trae, y el fallback `@typescript/typescript6` tampoco funcionó con tsup 9
  (`parseJsonConfigFileContent is not a function`). Solo afecta a la compilación de este paquete; los `.d.ts`
  generados se consumen sin problema (verificado con `tsc` en `module: nodenext` para `.mts` y `.cts`).
  Si el Integrador unifica en TS 7 en el root, `build` de shared debe seguir usando un TS 6 local (o migrar de tsup).
- Scripts: `build`, `test`, `typecheck`, `lint` (= `tsc --noEmit`, que también tipa los tests).
- No se versionan `node_modules`, `dist` ni `package-lock.json` (`.gitignore` local). El lockfile lo regenera el Integrador.

## 2. Estructura

| Archivo | Contenido |
| :-- | :-- |
| `common.ts` | `DayOfWeek`, `Category` (compartidos por kanban, gym y calendar) |
| `kanban.ts` | `KanbanItem` y auxiliares |
| `university.ts` | `UniversityAssignment`, `RubricCriterion` |
| `learning.ts` | `WeeklyReflection`, `LearningResource`, `WeeklyReflectionsMapSchema` |
| `gym.ts` | rutinas, ejercicios, `UserGymProfile`, `WeightHistoryEntry`, `GymAttendanceLog`, alertas descartadas |
| `calendar.ts` | `CalendarBlock` + union de registros de la colección `calendar` |
| `workShift.ts` / `habits.ts` | `WorkShiftConfig` / `DailyHabits` (singletons dentro de `calendar`) |
| `profile.ts` | `Profile` (`studentName`, `career`, `currentAcademicWeek`, `streak`, `theme`) |
| `appState.ts` | `AppStateSchema` / `AppState` (composición) y `APP_STATE_FIELDS` |
| `sync.ts` | protocolo de sync, `COLLECTIONS`, `APP_STATE_TO_COLLECTION`, `COLLECTION_DATA_SCHEMA` |

Todo módulo exporta `XxxSchema` (zod) y el tipo `Xxx = z.infer<...>`.

## 3. Colecciones y mapeo (para SYNC-WEB y SYNC-API)

`COLLECTIONS = ['profile','kanban','university','learning','gym','calendar']`.

| Campo de `AppState` | Colección | Registro de sync |
| :-- | :-- | :-- |
| `studentName`, `career`, `currentAcademicWeek`, `streak`, `theme` | `profile` | 1 singleton, id `PROFILE_RECORD_ID` (`'profile'`); `data` = `Profile` |
| `kanbanItems` | `kanban` | 1 por item, id = `item.id`; `data` = `KanbanItem` |
| `universityAssignments` | `university` | 1 por entrega, id = `assignment.id`; `data` = `UniversityAssignment` |
| `weeklyReflections` | `learning` | 1 por semana, id = `weeklyReflectionRecordId(week)` (`'5'`); `data` = `WeeklyReflection` |
| `gymRoutines` | `gym` | `data = { kind: 'routine', value: GymRoutine }`, id = `routine.id` |
| `gymProfile` | `gym` | `{ kind: 'profile', value: UserGymProfile }`, id `GYM_PROFILE_RECORD_ID` (`'gym-profile'`) |
| `weightHistory` | `gym` | `{ kind: 'weightEntry', value: WeightHistoryEntry }`, id `weightEntryRecordId(date)` (`weight-2026-11-13`; la app guarda 1 por fecha) |
| `gymAttendanceLogs` | `gym` | `{ kind: 'attendanceLog', value: GymAttendanceLog }`, id = `log.id` |
| `dismissedGymScheduleAlerts` | `gym` | `{ kind: 'dismissedAlert', value: '<YYYY-MM-DD>' }`, id `dismissedAlertRecordId(date)` (semántica de conjunto) |
| `calendarBlocks` | `calendar` | `{ kind: 'block', value: CalendarBlock }`, id = `block.id` |
| `workShift` | `calendar` | `{ kind: 'workShift', value: WorkShiftConfig }`, id `WORK_SHIFT_RECORD_ID` (`'work-shift'`) |
| `dailyHabits` | `calendar` | `{ kind: 'dailyHabits', value: DailyHabits }`, id `DAILY_HABITS_RECORD_ID` (`'daily-habits'`) |

- `APP_STATE_TO_COLLECTION` está tipado como `Record<keyof AppState, Collection>`: si se añade un campo a
  `AppStateSchema` sin mapearlo, **no compila** (y además hay un test exhaustivo).
- `COLLECTION_DATA_SCHEMA[collection]` valida `SyncRecord.data`. `SyncRecordSchema` ya lo aplica con `superRefine`
  (los errores salen con ruta `['data', ...]`). `SyncRecordEnvelopeSchema` valida solo el envoltorio.
- **Por qué `kind`/`value` en `gym` y `calendar`:** ambas colecciones mezclan entidades distintas con ids que podrían chocar
  y singletons; un discriminador explícito evita adivinar el tipo por forma. `kanban`, `university`, `learning` y `profile`
  son homogéneas, así que `data` es la entidad directa (sin envoltorio).
- Los singletons (`profile`, `gym-profile`, `work-shift`, `daily-habits`) hacen última-edición-gana sobre todo el objeto;
  editar el nombre en un dispositivo y el tema en otro dentro del mismo `updatedAt` perdería uno. Es aceptado en Ola 1.
- Un campo opcional ausente (p. ej. `workShift` indefinido) = no existe registro (o existe tombstone). Borrar = registro con
  `deletedAt` (su `data` puede ser `null` y no se valida).

## 4. Protocolo (`sync.ts`)

- `SyncRecord { id, collection, data, updatedAt, deletedAt, rev }`. `id`: string 1..200, **no se impone uuid**. `updatedAt`/`deletedAt`:
  ISO 8601 datetime estricto (`z.iso.datetime({ offset: true })`, admite `Z` y `+hh:mm`), `deletedAt` nullable. `rev`: entero >= 0.
  Unicidad esperada en servidor: `(userId, collection, id)`.
- `SyncPullQuery { since?, collection?, limit? }` (`since` = cursor opaco; `limit` coaccionado desde query string, 1..`MAX_PULL_LIMIT`=1000).
- `SyncPullResponse { records, cursor, hasMore }`.
- `SyncPushRequest { changes }` con máx. `MAX_PUSH_CHANGES` = 500.
- `SyncPushResponse { applied: id[], conflicts: SyncRecord[] }`. Semántica propuesta (la implementa SYNC-API): última edición gana por `updatedAt`
  (empate: mayor `rev`/servidor), `applied` incluye reenvíos idempotentes, `conflicts` devuelve la versión vigente del servidor.
- Extras sobre el plan (aditivos, opcionales o con default): `hasMore`, `collection`, `limit`, constantes `MAX_*`, `validateRecordData`,
  `SyncRecordEnvelopeSchema`, ids de singletons y helpers de id.

## 5. Divergencias entre `types/index.ts` y la realidad de `initialData`

1. **`weeklyReflections: { [week: number]: ... }`** — en JSON las claves siempre son strings. El esquema es
   `z.record(z.string().regex(/^\d+$/), WeeklyReflection)`; el tipo inferido es `Record<string, WeeklyReflection>`: asignable al tipo legacy,
   pero el inverso (legacy -> inferido) no lo es por la firma de índice. El test de compatibilidad lo cubre con `Omit` para ese campo.
   La clave y `reflection.week` están duplicadas (el estado inicial las mantiene iguales; el contrato no lo fuerza).
2. **IDs no-UUID en todo el estado**: `k1`, `gym-mon`, `ex-1`, `cb-1`, `uni-1`, `res-1`. Por eso `SyncRecord.id` es string no vacío.
   `weightHistory` y `dismissedGymScheduleAlerts` **no tienen id**; se derivan (`weight-<date>`, `dismissed-<date>`).
3. **Fechas heterogéneas**: `createdAt`, `dueDate`, `WeeklyReflection.updatedAt` son `YYYY-MM-DD` (sin hora) en `initialData`, mientras
   `UserGymProfile.configuredAt` y los `startedAt/finishedAt` son ISO datetime. Solo `SyncRecord.updatedAt/deletedAt` son ISO estrictos;
   los campos de las entidades son `string` libre para no rechazar datos reales de usuarios (`localStorage` legacy).
4. **Restricciones solo en comentarios** del tipo original, no impuestas: `startTime/endTime` `HH:mm`, `date` `YYYY-MM-DD`,
   `trainingDaysCount` 2..6. Se mantienen como `string`/`number` (mismos tipos). Se pueden endurecer después, pero con migración de datos.
5. **`initialData` no ejercita todos los campos opcionales**: no trae `dailyHabits`, `workShift`, `gymProfile`, `weightHistory`,
   `gymAttendanceLogs`, `dismissedGymScheduleAlerts`, `checklist`, `tags`, `rubricCriteria`, etc. Los tests añaden un estado "completo" propio para cubrirlos.
6. **Uniones literales**: se reprodujeron todas (`DayOfWeek` con tildes, `Category`, `GymSessionDurationMinutes` 60|90|120, etc.).
   `restDay` es `DayOfWeek | null` (nullable, no opcional).
7. **Claves desconocidas**: los esquemas usan el modo por defecto de zod (descartan claves desconocidas). Si el web agrega campos nuevos
   al estado, deben añadirse al esquema (aditivo) o se perderán al pasar por la API.
8. Invariante de `memories.md` a vigilar en CALENDAR: con Google conectado no deben existir `calendarBlocks` con `category === 'gym'` locales.
   El contrato permite la categoría; la regla es de negocio, no de forma.

## 6. Pruebas

`packages/shared/test/`: (a) `initialData` real (fixture transcrito literalmente desde `src/data/initialData.ts` con solo el import cambiado) valida contra
`AppStateSchema` y es idéntico tras el parse; (b) mapeo exhaustivo `APP_STATE_TO_COLLECTION` (sin faltantes ni sobrantes); (c) round-trip de `SyncRecord` en las
6 colecciones; (d) rechazo de datos inválidos (enum, id vacío, ISO, `rev`, `kind`, colección ajena, límites). Los fixtures son copias de referencia: no editarlos.
Si el estado inicial del frontend cambia, hay que regenerar el fixture (`sed "s#from '../types'#from './legacyTypes.fixture'#"`).

## 7. Variables de entorno nuevas

Ninguna.
