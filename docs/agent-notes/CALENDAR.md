# Notas del agente CALENDAR (Ola 3) — adaptadores `calendar` y `profile`

Rama: `feat/be-calendar`. Alcance tocado: `apps/web/src/sync/adapters/{calendar,profile}.ts`, sus pruebas en
`apps/web/src/sync/adapters/__tests__/`, `components/dashboard/DailyHabitsCard.tsx` (un ajuste, ver 5) y este archivo.
Sin cambios en `packages/shared`, `apps/api`, `App.tsx`, `package.json` ni lockfile. **No hizo falta API nueva**: el servidor ya guarda
`calendar` y `profile` de forma generica (`sync_records`).

## 1. Adaptador `calendar`

Registros `{ kind, value }` (contrato de `shared/calendar.ts`):

| Estado | kind | id |
| --- | --- | --- |
| `calendarBlocks[]` | `block` | `block.id` |
| `workShift` | `workShift` | `WORK_SHIFT_RECORD_ID` |
| `dailyHabits` | `dailyHabits` | `DAILY_HABITS_RECORD_ID` |

### Criterio de propiedad: que se sube y que no
- **Eventos de Google**: no viven en `AppState` (se leen en vivo de Google y se pintan aparte), asi que no hay nada que filtrar. Los
  bloques "espejo" virtuales (`gcal-*`, `gcal-gym-*`) se excluyen igualmente por defensa.
- **`googleEventId` NO es marca de origen**. En esta app lo estampa la propia app al publicar en Google un bloque local (o la serie del
  turno laboral, donde los 6 bloques `work-shift-<dia>` comparten el mismo `googleEventId`). Por eso esos bloques SI viajan: el otro
  dispositivo necesita el `googleEventId` para deduplicar el evento de Google contra el bloque (invariante de `memories.md`).
- **Bloques de gym** (`category === 'gym'`, id `cal-gym-*` o titulo `Gym:*`) **no viajan nunca por `calendar`**, tengan o no `googleEventId`.
  Motivo: invariante "0 bloques gym locales con Google conectado". Si un dispositivo sin Google los subiese, otro con Google los
  descargaria y se romperia. El horario de gym es del modulo gym (`gymProfile`) y de Google Calendar. En `apply` tambien se rechazan
  y un tombstone no borra un bloque gym local.
- Ids reservados (`work-shift`, `daily-habits`) y ids duplicados en el estado no generan registros de bloque.

### `apply`
Puro, inmutable, idempotente; devuelve la **misma referencia** si no cambia nada (el motor evita `setState` inutil).
- Orden determinista: los registros se procesan ordenados por `id` (no por orden de llegada). Los bloques existentes se actualizan en su sitio y los nuevos se anaden al final.
- Cada registro se **revalida** con `CalendarRecordDataSchema`; los invalidos se descartan sin romper el lote. Se exige coherencia `id de registro == id del bloque` y singleton solo con su id reservado.
- **Sin duplicados de Google**: un bloque entrante se descarta si ya existe otro con distinto `id` y el mismo `googleEventId` + `day` + `startTime` + `endTime` (la serie del turno laboral comparte `googleEventId` pero difiere en `day`, asi que no se pierde ninguno).
- Tombstones: el tipo se deduce del id (el `data` es `null`).
- El turno nocturno cross-midnight (`22:00 -> 06:00`) viaja tal cual (no se normaliza ni se parte): cubierto por test.

### Hábitos diarios: regla de reinicio diario
`lastUpdatedDate` (YYYY-MM-DD local) es el dia al que pertenecen `waterMl`/`pomodorosDone`.
- Un registro remoto de un dia **estrictamente anterior** al local se **ignora** (no resucita ayer encima de hoy).
- Mismo dia o posterior, o local inexistente/sin fecha: gana el remoto (el servidor ya resolvio por `updatedAt`).
- Remoto sin fecha (legacy) no pisa un local con fecha.
- El adaptador no usa reloj; solo compara las dos fechas (orden lexicografico ISO).
- **Ajuste de UI asociado** (`DailyHabitsCard.tsx`): con estado controlado (App, `onHabitsChange`), el reinicio diario ya no se persiste al montar; es solo visual y se persiste en la primera edicion real (que sella `lastUpdatedDate`). Antes, un dispositivo con datos de ayer escribia "hoy a cero" al abrirse y, por ultima-edicion-gana, pisaba los habitos de hoy de otro dispositivo. El modo sin `onHabitsChange` (localStorage directo) no cambia.

## 2. Adaptador `profile`
Singleton `PROFILE_RECORD_ID`: `studentName`, `career`, `currentAcademicWeek`, `streak` (+ `theme`).
- **`theme` es una preferencia por dispositivo.** El contrato exige `theme` en el registro, asi que `select` emite siempre la constante `PROFILE_SYNC_THEME = 'dark'` y `apply` ignora el `theme` remoto y conserva el local. Efectos: alternar el tema no cambia el hash -> no hay push, ni eco, ni parpadeo en otros dispositivos, ni se pisa por ultima-edicion-gana una edicion concurrente de nombre/carrera/racha. (Test con el motor real: `pushCount` no cambia al alternar el tema.) Consecuencia: el `theme` guardado en la nube no significa nada; si algun dia se quiere tema global basta con emitir el real y aplicar el remoto.
- `streak`/`currentAcademicWeek`: ultima-edicion-gana sobre el objeto (limitacion del contrato; dos dispositivos que suman a la racha a la vez se quedan con la edicion mas reciente). Se rechazan remotos no enteros o negativos.
- Un tombstone de perfil se ignora (no se vacia el perfil).

## 3. Pruebas (`npm test -w apps/web`: 88 pruebas en total, 31 nuevas)
`calendar.test.ts` / `profile.test.ts`: round-trip contra los esquemas de `shared` (incluido `SyncRecordSchema` y el estado inicial), turno nocturno sin perdida, Google/gym no se suben ni entran, no duplicar `googleEventId`, idempotencia e inmutabilidad (estado congelado), orden de llegada, tombstones, datos remotos invalidos, regla de habitos, y integracion con el motor real + servidor simulado con dos dispositivos (convergencia, sin eco, `theme` sin push).

## 4. Para el Integrador
- Nada que cambiar en `adapters/index.ts` ni `App.tsx` por esta rama. `App.tsx` ya pasa `onHabitsChange`, requisito del ajuste de 5.
- **Riesgo a vigilar en `App.tsx`** (no tocado): `ensureDefaultWorkShiftForRealAccount` siembra un `workShift` por defecto cuando es `undefined` y `WORK_SHIFT_INIT_FLAG_KEY` no esta puesto. Un dispositivo nuevo podria sembrar el turno por defecto y subirlo antes de recibir el de la nube, pisando uno personalizado. Mitigacion sugerida: no sembrar mientras el motor no haya hecho su primer pull (o con la sync activa dejar que mande la nube).
- Los datos de ejemplo `cb-1..cb-14` se sincronizan como cualquier bloque (se limpian por `accountDataCleanup` para cuentas reales).

## 5. Limitaciones / deuda
- Los bloques de gym sin Google no se sincronizan entre dispositivos por `calendar` (decision de invariante). Si se quiere, GYM debe regenerarlos desde `gymProfile`.
- Bloques y turno son registros independientes: editar el turno regenera 6 bloques (6+1 registros). Si en la nube el turno cambia y los bloques llegan en otro orden, la convergencia es eventual por registro.
- Una colision de `googleEventId`+hueco entre un bloque entrante y otro local descarta el entrante (incluso si es una edicion); el local queda como esta hasta su proxima edicion.
- Habitos con relojes desfasados: si un remoto "de ayer" es legitimo y mas nuevo, se ignora hasta la proxima edicion local.
- Todo verificado con jsdom/node y API simulada; no contra el servidor real ni navegadores. La UI de `DailyHabitsCard` no se verifico en navegador (solo build/lint/tipos); los E2E Playwright existentes de reinicio diario no se re-ejecutaron.
