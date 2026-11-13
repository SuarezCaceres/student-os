# Notas del agente GYM (Ola 3) — adaptador de sync de la coleccion `gym`

Rama: `feat/be-gym`. Alcance tocado: `apps/web/src/sync/adapters/gym.ts`, `apps/web/src/sync/adapters/__tests__/gym.test.ts` y este archivo.
**No se toco**: `packages/shared` (no hizo falta ningun cambio aditivo), `apps/api/**` (el servidor ya guarda y valida `gym` de forma generica),
`components/gym/**`, `utils/*`, `googleCalendar.ts`, ni nada de `sync/**` fuera del adaptador.

## 1. Que sincroniza

Todo en la coleccion `gym`, registros `{ kind, value }` segun el contrato (`packages/shared/src/gym.ts`):

| Campo de `AppState` | kind | id del registro |
| :-- | :-- | :-- |
| `gymRoutines` | `routine` | `routine.id` (**un registro por rutina**) |
| `gymProfile` | `profile` | `GYM_PROFILE_RECORD_ID` (`gym-profile`) |
| `weightHistory` | `weightEntry` | `weightEntryRecordId(date)` (1 por fecha) |
| `gymAttendanceLogs` | `attendanceLog` | `log.id` (`att-<fecha>-<routineId>`) |
| `dismissedGymScheduleAlerts` | `dismissedAlert` | `dismissedAlertRecordId(date)`, `value` = fecha |

No se sincronizan bloques de calendario (son de CALENDAR). Invariante de `memories.md`: el adaptador nunca toca `calendarBlocks`,
asi que con Google conectado no aparece ningun bloque `category === 'gym'` local por culpa de la sync.

## 2. Decisiones de `select` / `apply`

- `select` es puro y defensivo: tolera listas corruptas (null, strings, tipos erroneos) sin lanzar (si lanzara, el motor dejaria de leer el estado
  de TODAS las colecciones). Colapsa duplicados (1 peso por fecha, ultimo gana, como hace la app; 1 alerta por fecha).
- **Ids reservados**: una rutina o log cuyo id sea `gym-profile` o empiece por `weight-` / `dismissed-` no se sincroniza (se avisa con `console.warn`).
  Es necesario porque un tombstone no lleva `data` y el tipo de entidad se deduce del id. Las apps reales usan `gym-<dia>`, `gym-gen-<dia>`, `att-...`, asi que no se da en la practica.
- `apply` es inmutable e idempotente: si ningun registro cambia nada devuelve **la misma referencia** de estado (no hay re-render ni re-subida). Probado.
- Tombstone: elimina la entidad (`gym-profile` quita la clave `gymProfile`). Tombstone de algo inexistente = no-op. En un mismo lote, de cada id gana la version con mayor `updatedAt`.
- **Registros remotos invalidos** (forma, kind desconocido, id incoherente con su valor, id reservado) se ignoran con un `console.warn` agregado; el resto del lote se aplica y el estado nunca se rompe.
- **Orden determinista**: una lista solo se reordena cuando un registro la cambia de verdad. Rutinas por dia de la semana (Lunes..Domingo) y luego id; pesos por fecha ascendente (como hoy, la app anade al final);
  asistencia por fecha y id; alertas por fecha. Comparacion de cadenas con `<` (no `localeCompare`) para que sea identica en todos los dispositivos. El orden de llegada de los registros no altera el resultado (probado con permutaciones).
- **Un log de asistencia por fecha** (invariante de la app: todo hace `filter(l => l.date !== fecha)`). Si dos dispositivos crearon logs con ids distintos para el mismo dia, `apply` deja uno, de forma determinista:
  mayor estado (`completed > in_progress > rescheduled > missed > idle`), luego mas reciente (`finishedAt ?? startedAt`), luego id. El perdedor no se tombstonea en el servidor (el motor reconstruye su snapshot tras aplicar), pero cada dispositivo lo descarta igual.

## 3. Riesgo "ultima edicion gana" sobre la rutina completa

El contrato fija **un registro por rutina** con todos los ejercicios dentro, asi que dos dispositivos que editan la misma rutina entre dos syncs se pisan: gana la edicion con `updatedAt` mayor (resuelto por el motor).
Campos de alta frecuencia afectados: `completedSets`, `weightKg`, `notes`, estructura de ejercicios. No se invento granularidad nueva (no se anadieron `kind` a shared): en una app de un solo usuario la edicion concurrente de la misma rutina es poco probable y un `kind` por ejercicio multiplicaria los registros frente a la cuota (5000 por usuario).

Mitigaciones implementadas (en `apply`, cuando llega una version remota de una rutina que ya existe localmente — `mergeRoutine`):

1. **`history` (levantamientos) nunca se pierde**: las entradas del historial de un ejercicio que solo existen localmente se unen a las remotas (clave `fecha|kg|reps`, sin duplicados, orden estable por fecha).
2. **El PR no se pierde**: si el dispositivo local aporto entradas de historial nuevas, `personalRecordKg = max(PR remoto, PR local, pesos de esas entradas)`. Si no aporto nada nuevo, el PR remoto manda tal cual (asi un PR corregido a la baja a proposito se respeta).
3. **Lo demas NO se fusiona a proposito**: `completedSets` se resuelve por ultima edicion; una fusion tipo OR resucitaria series marcadas despues del reinicio semanal de series. Un ejercicio borrado en el otro dispositivo desaparece (la estructura manda el servidor).
4. **Limite de 64 KB por registro** (`MAX_RECORD_DATA_BYTES` del servidor): si una rutina serializada supera ~60 KB, `select` recorta las entradas de historial **mas antiguas** del/los ejercicios con mas historial hasta que quepa. El PR es un campo aparte y no se toca; localmente no se pierde nada y `apply` vuelve a unir el historial. Las rutinas reales pesan ~1-3 KB (probado: < 16 KB incluso con rutinas generadas de 6 dias); esto es solo una red de seguridad contra el 413.

### Limitacion conocida (necesita al motor, que no es mio)
Lo que `apply` fusiona (p. ej. A tiene un PR nuevo que B no vio) queda en el dispositivo A pero **no se re-sube solo**: el motor reconstruye su snapshot desde el estado resultante tras aplicar (anti-eco), asi que no ve diferencia contra el servidor. El servidor y B conservan la version de B hasta que A vuelva a editar esa rutina; entonces la union llega a todos. Esta probado en `gym.test.ts` ("PR registrado offline mientras otro dispositivo edita la misma rutina").
**Sugerencia para SYNC-WEB/Integrador**: tras `adapter.apply`, comparar `project(next)` con los registros recibidos y encolar (con `updatedAt` nuevo) los que difieran del `data` remoto.

## 4. Pruebas (`npm test -w apps/web`: 37 pruebas nuevas, 94 en total en web)

`apps/web/src/sync/adapters/__tests__/gym.test.ts`, con un estado de gym completo construido a mano (perfil, 3 rutinas con tecnica/historial/PR, 2 pesos, 3 logs en distintos estados, 2 alertas):
- `select`: ids/kinds, un registro por rutina (tocar una serie solo cambia ese registro), duplicados, datos corruptos, ids reservados.
- Round-trip con el contrato: `select` -> `SyncRecordSchema` (valida) -> `apply` en un dispositivo vacio reproduce el estado; permutaciones de orden de llegada.
- `apply`: inmutabilidad (estado congelado), idempotencia (misma referencia), altas/ediciones/borrados de cada kind, tombstones, alertas como conjunto, dedupe de logs por fecha.
- Datos remotos invalidos y estado local corrupto: no lanzan y no tocan el estado.
- PRs/historial: no se pierden, PR remoto mas alto se respeta, series no resucitan, recorte de 64 KB, tamano real de rutinas.
- Motor completo con `FakeServer` (que valida cada push con `SyncRecordSchema`): estado completo A -> B, completar series offline -> online sin duplicar ni perder PR/historial, alertas descartadas/re-activadas/limpiadas, borrados sin resurreccion por eco, conflicto sobre la misma rutina, registros invalidos en el servidor.

## 5. Para el Integrador / otros agentes

- **Registro**: `sync/adapters/index.ts` ya importa `gymAdapter` (mismo nombre de export). Sin cambios.
- **API / Prisma**: nada. `apps/api/src/gym/**` y `schema/gym.prisma` quedan sin cambios (no habia necesidad real).
- **`streak` (racha)** vive en la coleccion `profile` (adapter de CALENDAR), no en `gym`. `handleFinishWorkout` hace `streak + 1` solo si el log del dia no estaba `completed`; con dos dispositivos que completan el mismo dia sin verse, el contador (ultima edicion gana) puede quedar desfasado respecto a los logs de `gym`. Recomendacion: derivar la racha de `gymAttendanceLogs` (hay logica de racha en `utils/gymAttendance.ts`) en vez de guardarla.
- **Cuota por usuario (5000 filas, tombstones incluidos)**: cada dia de gym anade ~1 log + hasta 1 peso (~700 filas/ano solo de gym). Con kanban/universidad se llegaria al limite en unos pocos anos. Falta purga de tombstones y/o archivado de logs antiguos (API-CORE/SYNC-API).
- **Exportacion/borrado de cuenta (PUBLIC)**: no requiere hooks propios de gym; todo esta en `sync_records`.
- Observado (fuera de mi alcance, no cambiado): `WeightCheckInModal` muestra "Historial reciente" con `weightHistory.slice(0, 5)`, que son los 5 MAS ANTIGUOS porque la app anade al final.

## 6. Variables de entorno nuevas

Ninguna.

## 7. Sin verificar

Solo se verifico con el `FakeServer` del motor (jsdom/node, sin red real): no contra la API NestJS real ni Supabase, ni con dos navegadores reales. No se hizo prueba visual (no se toco UI).
