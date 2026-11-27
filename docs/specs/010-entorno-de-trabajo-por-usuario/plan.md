# Plan · 010 · Entorno de trabajo por usuario

> Estado: **borrador** (a la espera de aprobación del humano)
> Se escribe después de aprobar la spec. Dice **cómo** se implementa. Rama: `feat/010-entorno-de-trabajo-por-usuario` (parte de la 009).

## Enfoque
La base de aislamiento por usuario ya existe (spec 009 y el API), así que esta spec **no toca el protocolo de sync ni el API**. Son cuatro cambios en la web:

1. **Estado de cuenta nueva vacío:** un `emptyAppState` propio (sin tareas, entregas, rutinas ni reflexiones; semana 1, racha 0) sustituye a `initialData` como estado de partida. `initialData` deja de usarse en producción.
2. **Guías en los módulos vacíos:** casi todos ya muestran un texto cuando no hay datos (Kanban, Universidad, Aprendizaje, Resumen). Se unifican con un componente `EmptyHint` y se añade un bloque de «primeros pasos» en el Resumen cuando la cuenta está vacía.
3. **Aviso de límite visible:** el motor ya detiene la sync con 422 (cuota) y rechaza el registro con 413, y guarda el motivo, pero el indicador solo lo enseña en un tooltip y ni siquiera cuenta los rechazados. Se muestra el mensaje en el propio indicador.
4. **Subir antes de cerrar sesión:** una función `flushPending(timeoutMs)` en el store de sync intenta subir lo pendiente con tiempo máximo; `handleLogout` la usa antes de `signOut()` y, si queda algo pendiente (sin red o servidor lento), abre un aviso para cancelar o cerrar igualmente.

**Alternativas descartadas:** conservar `initialData` y solo ocultarlo (deja datos de «Mateo» en el código de producción y en el botón de reiniciar); bloquear el cierre de sesión hasta subir (puede colgarse con la API dormida de Render).

## Cambios por área
| Área     | Archivos / módulos | Qué cambia |
|----------|--------------------|------------|
| Frontend (datos) | `data/emptyState.ts` (nuevo), `App.tsx` (`useSyncedAppState(emptyAppState)`), `utils/newAccountState.ts` | Estado de partida vacío. Valores por defecto: `studentName: 'Estudiante'`, `career: 'Estudiante universitario'`, semana 1, racha 0, tema oscuro. El nombre de Google sigue sustituyendo al de `studentName`. «Borrar mis datos locales» (`AccountPanel`) también vuelve a este estado. |
| Frontend (guías) | `components/common/EmptyHint.tsx` (nuevo), `OverviewBento.tsx`, `KanbanBoard.tsx`, `UniversityView.tsx`, `GymTracker.tsx`, `WeeklyCalendar.tsx`, `LearningView.tsx` | Mismo componente y tono en cada módulo vacío; bloque «Primeros pasos» en el Resumen cuando Kanban, entregas y horario están vacíos. |
| Frontend (límites) | `sync/describeStatus.ts`, `components/sync/SyncStatusBadge.tsx` | El texto del indicador usa `status.error` (cuota 422) y `status.rejected` (413 o contrato). |
| Frontend (cierre de sesión) | `sync/syncStore.ts` (**zona protegida**), `App.tsx` (`handleLogout`), `components/auth/ConfirmLogoutDialog.tsx` (nuevo) | `flushPending`, y el aviso cuando quedan cambios sin subir. |
| Backend  | — | Sin cambios. Los límites (5000 registros, 64 KB) se conservan. |
| Datos    | — | **Sin migración.** |
| Contrato | — | Sin cambios en `packages/shared` ni en los endpoints. |
| Dependencias | — | **Ninguna nueva.** |

### Textos propuestos para las guías (para que los apruebes)
| Módulo | Texto |
|--------|-------|
| Resumen (cuenta vacía) | **Tu espacio está listo.** Empieza por tres cosas: escribe tu primera tarea en Kanban, registra una entrega en Universidad y agenda un bloque en Horario. |
| Kanban (tablero vacío) | Aún no tienes tareas. Escribe la primera arriba y pulsa Enter. |
| Universidad | Aún no tienes entregas esta semana. Agrega la primera con «Nueva entrega». |
| Gym | Aún no tienes rutina. Configura tu gimnasio y agrega tu primer ejercicio. |
| Horario | Tu horario está vacío. Usa «Agendar bloque»; tus eventos de Google aparecerán aquí solos. |
| Aprendizaje | Aún no guardaste fuentes esta semana. Pega un enlace de YouTube o TikTok. |
| Aviso de límite | Llegaste al límite de tu cuenta (5000 registros). Libera espacio para seguir sincronizando; lo que ya guardaste está a salvo. |
| Registro demasiado grande | Un elemento es demasiado grande para sincronizarse (máximo 64 KB). Redúcelo para que se guarde. |

## Pruebas
| Criterio | Tipo de prueba | Dónde |
|----------|----------------|-------|
| C1 | **Manual** en producción con dos cuentas reales (necesita 007 y 008) | Lista de verificación en la spec 007; no se marca `pasa` hasta hacerla |
| C2 | E2E (editar y cerrar sesión enseguida, volver a entrar y ver la edición, también en un segundo dispositivo) + unitaria de `flushPending` | `e2e/06-cerrar-sesion.spec.ts`, `sync/__tests__/flushPending.test.ts` |
| C3 | Ya cubierto por la 009 | `e2e/03-primer-acceso.spec.ts` (3b) y pruebas del motor |
| C4 | Ya cubierto por la 009 | `useSyncedAppState.*.test.tsx`, `BackupModal`/`DailyHabitsCard`/`GymTracker` sin `localStorage` |
| C5 | Unitaria del estado vacío, prueba del hook con cuenta nueva y E2E del primer acceso ampliada (módulos vacíos con su guía y ningún texto de «Mateo») | `data/emptyState.test.ts`, `hooks/useSyncedAppState.enabled.test.tsx`, `e2e/03-primer-acceso.spec.ts`, `EmptyHint.test.tsx` |
| C6 | E2E con la misma cuenta nueva abierta en dos contextos a la vez; se comprueba que el servidor tiene un solo perfil y ningún registro duplicado | `e2e/06-cerrar-sesion.spec.ts` (caso de dos dispositivos) o `04-two-devices` |
| C7 | Unitaria (sube y cierra; el tiempo máximo corta la espera) + E2E | `flushPending.test.ts`, `06-cerrar-sesion.spec.ts` |
| C8 | Prueba de componente del aviso + E2E con `context.setOffline(true)` (aviso, «Cancelar» mantiene la sesión, «Cerrar igualmente» sale) | `ConfirmLogoutDialog.test.tsx`, `06-cerrar-sesion.spec.ts` |
| C9 | Unitarias de `describeSyncStatus` y del indicador con 422 y 413, más la prueba del motor que ya existe (422 no se reintenta) y las de integración del API que ya cubren cuota y tamaño | `sync/__tests__/describeStatus.test.ts`, `engine.test.ts`, `apps/api/test/sync*.e2e-spec.ts` |
| C10 | Ya existe en las pruebas de integración del API | `apps/api/test/*.e2e-spec.ts` |

## Pasos
Cada paso deja el proyecto en verde (`./scripts/check.sh --rapido`; el E2E completo al final) y acaba en un commit.
1. **Estado vacío de cuenta nueva:** `emptyAppState`, `App.tsx`, reinicio de datos locales y ajuste de las pruebas que dependían de los datos de ejemplo (E2E `04-two-devices` crea gym y entregas: se adaptan a partir de un estado vacío). Prueba del hook y E2E 3a (C5, parte de C6).
2. **Guías:** `EmptyHint`, textos de arriba, «Primeros pasos» en el Resumen. Pruebas de componente y E2E 3a ampliada (C5).
3. **Límites visibles:** `describeSyncStatus` y el indicador, con pruebas (C9).
4. **`flushPending` en el store de sync** (zona protegida, requiere tu permiso) con sus pruebas unitarias (C7).
5. **Cierre de sesión:** `handleLogout` sube antes de salir, `ConfirmLogoutDialog` para el caso sin red o con tiempo agotado, y la E2E `06-cerrar-sesion` (C2, C7, C8).
6. **Dos dispositivos con cuenta nueva** (C6).
7. **Cierre:** `check.sh` completo, skill `revisor`, `features.json` (C2 y C5 a C9 en `true`; C1 sigue manual), `TASKS.md`, `PROGRESS.md` y PR en borrador.

## Aprobaciones que necesita el plan
- **Zona protegida:** el paso 4 añade una función a `apps/web/src/sync/syncStore.ts`. No cambia el protocolo, el motor ni la regla de descarte; solo expone «subir ahora con tiempo máximo».
- **Dependencias nuevas:** ninguna. **Migraciones:** ninguna. **`docs/rules/`:** no se modifica.
- **Textos de las guías** (tabla de arriba) y el valor por defecto de `career` («Estudiante universitario»), que antes era la carrera de Mateo.

## Riesgos
- **Spec 011 (gym opcional) en paralelo:** otra sesión trabaja en `student-os-011` y toca `GymTracker` y el primer acceso. Ambas parten de la 009: habrá conflictos en `GymTracker.tsx` y, si 011 cambia el estado de partida, también en `data/`. Se resuelven al fusionar; conviene fusionar primero la que termine antes.
- **Pruebas E2E que dependían de datos de ejemplo** (`04-two-devices` y otras): hay que revisarlas con cuidado para no debilitarlas; si una necesita datos, los crea ella misma.
- **API dormida (Render gratuito):** subir antes de cerrar puede tardar más de 5 s; por eso, si el tiempo se agota con pendientes, se trata como «sin conexión» y se pregunta (no se descarta nada en silencio).
- **Pestañas seguidoras:** solo la pestaña líder sincroniza; si se cierra sesión desde otra pestaña, `flushPending` no puede subir. Se trata como pendientes sin subir y se avisa.
- **Cuentas que ya recibieron los datos de ejemplo** (de pruebas) los conservan: no hay migración ni borrado automático (decisión de la spec).
- **C1 no se puede cerrar sin producción** (007) ni la verificación de Google (008).
