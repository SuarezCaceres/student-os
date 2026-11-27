# Plan · 011 · Gimnasio opcional («no voy al gimnasio»)

> Estado: **borrador** (espera la aprobación del humano)
> Se escribe después de aprobar la spec. Dice **cómo** se implementa.
> Los números de línea salen de la base `1d477f1` (rama 009) y pueden moverse mientras la 009 siga avanzando: antes de cada paso se vuelven a localizar con `grep`.

## Enfoque
Un único interruptor, `gymDisabled`, en el estado de la app. **Ausente = gym activo** (así los datos antiguos no cambian, C10). Todo el gating sale de una sola derivación en `App.tsx` (`isGymEnabled = !state.gymDisabled`) que se pasa como prop a los componentes que hoy muestran gym. **Ocultar no borra nada**: perfil, rutinas y asistencia se conservan (C7), y los bloques de gym se filtran al mostrarse, no se eliminan.

El interruptor viaja por el sync **dentro de la colección `gym`**, como un registro nuevo de tipo `preference` (singleton `gym-preference`), igual que ya se hace con `profile`. Así **no hace falta migración de base de datos**: `data` es JSON y la colección ya existe.

Alternativas descartadas:
- *Reutilizar `gymProfile` con un campo `disabled`*: obligaría a un perfil falso con campos obligatorios (días, altura…) para quien nunca rellenó nada.
- *Guardarlo en `profile` (nombre, tema…)*: mezcla preferencias de módulo con datos de cuenta; la colección `gym` es su sitio natural y se borra/exporta con el resto del gym.
- *`localStorage`*: no seguiría al usuario (C8) y agravaría M2.

## Cambios por área
| Área | Archivos / módulos | Qué cambia |
|------|--------------------|------------|
| Contrato (shared) | `packages/shared/src/gym.ts`, `appState.ts`, `sync.ts` | Esquema `GymPreferenceSchema = { disabled: boolean }`; `GYM_PREFERENCE_RECORD_ID = 'gym-preference'`; nueva variante `kind: 'preference'` en `GymRecordDataSchema`; campo opcional `gymDisabled` en `AppStateSchema` y entrada `gymDisabled: 'gym'` en `APP_STATE_TO_COLLECTION` (la prueba de cobertura del mapeo lo exige). Solo aditivo. |
| Frontend · sync | `apps/web/src/sync/adapters/gym.ts` (+ `types` de `AppState` en `apps/web/src/types`) | Proyectar `gymDisabled` ⇄ registro `preference` (`put` si es `true`; tombstone si vuelve a activo); `apply` idempotente y tolerante: registro con id o valor inválido se ignora; sin registro el estado no cambia (C10). |
| Frontend · estado | `apps/web/src/App.tsx` | `isGymEnabled`; handlers `handleDisableGym` / `handleEnableGym`; si `activeTab === 'gym'` y está desactivado, volver a `overview`; cerrar `isFirstGymOnboardingOpen`; no abrir el asistente de primera vez; saltar los efectos de publicación y detección de gym en Google (`missingScheduledGymDays`, `handleSaveGymPlan`, sincronización de bloques de gym); filtrar `category === 'gym'` de los bloques que se pasan al calendario. |
| Frontend · navegación | `components/layout/Navbar.tsx` | Prop `gymEnabled`: quitar «Gym» de `tabs` y de `mobileTabs`; sin punto de alerta de gym. |
| Frontend · resumen | `components/dashboard/OverviewBento.tsx`, `layout/StatsHero.tsx` | Con gym desactivado: sin tarjeta de gym, sin acceso rápido «añadir gym», sin enlace a la pestaña ni aviso de horario pendiente; en su lugar la línea «Gym desactivado · Reactivar». |
| Frontend · gym | `components/gym/GymOnboardingModal.tsx`, `GymTracker.tsx` | Botón «No voy al gimnasio» (secundario, sin validar campos) en el asistente y en el estado vacío del gym (sin perfil). |
| Frontend · calendario y hábitos | `components/calendar/*`, `DailyHabitsCard.tsx` | Recibir los bloques ya filtrados; comprobar que no queden contadores de gym en hábitos (si no los hay, el criterio ya se cumple y se cubre con una prueba). |
| Backend | — | Sin cambios de código: valida con el esquema compartido. Hay que **desplegar el API con el `shared` nuevo** antes que la web, o el servidor rechazará el registro `preference` (ver Riesgos). |
| Datos | — | **Sin migración.** Sin dependencias nuevas. |

## Pruebas
| Criterio | Tipo | Dónde |
|----------|------|-------|
| C1 | unit (componente) | `components/gym/GymOnboardingModal.test.tsx` (nuevo): el botón existe, no exige campos y llama a `onDisableGym` |
| C2 | unit (componente) | `GymTracker.test.tsx` y `OverviewBento.test.tsx`: sin perfil se ofrece la opción |
| C3 | unit (componente) | `Navbar.test.tsx`: con `gymEnabled=false` no hay «Gym» en escritorio ni en móvil; `App`: redirige a `overview` |
| C4 | unit (componente) | `OverviewBento.test.tsx`, `StatsHero.test.tsx`: sin tarjeta, acceso rápido ni alerta; aparece la línea «Reactivar» |
| C5 | unit + e2e | prueba del filtrado de bloques y del efecto de publicación (no llama a `googleCalendar` de gym); E2E con Google simulado: ningún `POST` de evento de gym |
| C6 | unit + e2e | `OverviewBento.test.tsx`: «Reactivar» devuelve pestaña, tarjeta y bloques |
| C7 | unit | `App`/adaptador: desactivar y reactivar deja `gymProfile`, `gymRoutines` y `gymAttendanceLogs` idénticos |
| C8 | integración | `sync/adapters/__tests__/gym.test.ts` (proyección ⇄ `apply`, idempotencia, tombstone) + E2E: desactivar, recargar y cerrar/abrir sesión mantiene el estado |
| C9 | integración (API) | `apps/api/test/*.e2e-spec.ts`: el registro `gym-preference` de un usuario no lo ve el otro |
| C10 | unit | adaptador: estado y registros sin `preference` dejan `gymDisabled` ausente y el gym activo |

## Pasos
Cada paso deja el proyecto en verde (`./scripts/check.sh --rapido` pasa) y acaba en un commit.
1. **Contrato:** `GymPreferenceSchema`, id, variante `preference`, `gymDisabled` en `AppState` y el mapeo de sync, con la prueba de cobertura del mapeo.
2. **Adaptador de sync:** proyección y `apply` de `preference` con sus pruebas (C8, C10).
3. **Prueba de aislamiento en el API:** C9 en `apps/api/test`.
4. **Estado en `App.tsx`:** `isGymEnabled`, handlers, redirección, silenciar efectos y filtrar bloques de gym (C3, C5, C7).
5. **Navegación y resumen:** `Navbar`, `OverviewBento`, `StatsHero`, línea «Reactivar» (C3, C4, C6).
6. **Botón «No voy al gimnasio»** en el asistente y en el estado vacío del gym (C1, C2).
7. **E2E** nuevo `apps/web/e2e/05-gym-opcional.spec.ts`: flujo completo con Supabase y Google simulados (C5, C6, C8).
8. **Cierre:** `./scripts/check.sh` completo, skill `revisor`, `features.json` (`pasa: true` solo donde la prueba pase), `TASKS.md`, `PROGRESS.md` y PR.

## Riesgos
- **Conflictos con la 009:** ambas editan `App.tsx`, `OverviewBento.tsx` y `DailyHabitsCard.tsx`. La 011 no debe fusionarse antes que la 009 y habrá que rebasarla (los números de línea de este plan son orientativos).
- **Orden de despliegue:** si la web nueva sube el registro `preference` y el API aún tiene el `shared` viejo, el servidor lo rechazará. Desplegar el API primero. Mientras tanto la elección se mantiene en la sesión y se reintenta (caso límite de la spec).
- **Clientes antiguos abiertos en otro dispositivo:** ignorarán el registro `preference` (no lo conocen) y seguirán mostrando el gym hasta actualizarse. Aceptable en un prototipo; el adaptador debe ignorar tipos desconocidos sin romperse (prueba incluida en el paso 2).
- **Efectos de Google en `App.tsx`:** hay varios que tocan bloques de gym (~líneas 877–1300). Hay que guardarlos todos con `isGymEnabled`; una prueba de «ningún evento de gym publicado» (C5) es la red de seguridad.
- **Zona protegida:** nada de esto toca el borrado/exportación de cuenta ni el importador. Pero la exportación incluirá el nuevo registro por estar en la colección `gym`: comprobar que no la rompe.
