# Plan · 009 · Login solo con Google para todos y Calendar vinculado automáticamente

> Estado: **borrador** (a la espera de tu aprobación)
> Se escribe después de aprobar la spec. Dice **cómo** se implementa.

## Enfoque
Hoy el login (Supabase) y la vinculación de Calendar (flujo propio del API) son dos pasos. El plan los junta en uno: el login de Google se hace con los permisos de Calendar y, al volver, la app entrega **una sola vez** el refresh token al servidor, que lo cifra con el mecanismo que ya existe. La conexión queda hecha sin botón. Después se **retira** todo lo que sobra: modo GIS (token de 1 hora), cuenta local, demo, modo local sin cuenta, importador y botón «Conectar».

Se reutiliza casi todo el API de Google (cifrado AES-256-GCM, `google_connections`, proxy a Calendar, borrado de cuenta). El cambio grande está en el frontend, que pierde un modo entero de funcionamiento.

## Decisión técnica D1 (necesita tu aprobación)
**Cómo llega el refresh token al servidor.** Supabase **no guarda** los tokens del proveedor de forma deliberada y su documentación recomienda enviarlos a un servidor propio si se usan fuera del navegador. Hay tres caminos:

| | Opción | Un solo consentimiento (C4) | El navegador ve el token (C10) | Migración | Código |
|---|---|---|---|---|---|
| **B** | **Supabase pide los permisos de Calendar y la web entrega `provider_refresh_token` al API una vez** (recomendada) | Sí | **Brevemente**, en memoria y en la sesión de supabase-js, hasta que se envía y se limpia | **Ninguna** | Poco |
| A | El API hace todo el OAuth y la web crea la sesión con `signInWithIdToken` | Sí | No (solo el ID token, que es identidad) | **Sí** (estado de login sin usuario aún y tabla de tokens pendientes) | Mucho; más superficie de errores en el login |
| C | Login por Supabase y, justo después, redirección automática al flujo de Calendar que ya existe | **No** (dos pantallas de Google) | No | Ninguna | Poco |

**Recomendación: B.** Es la vía que documenta Supabase, no necesita migración ni dependencia nueva y reutiliza el código del API. Su coste es **relajar el criterio C10** de «nunca» a «nunca de forma persistente: solo en memoria durante el enlace y se elimina de la sesión local en cuanto se envía». Si el paso 1 (prueba de viabilidad) muestra que supabase-js deja ese token en `localStorage` y no se puede limpiar, se vuelve a decidir entre A y C.

> **Necesito que apruebes B y el cambio de redacción de C10**, porque los criterios no se reescriben sin tu permiso.

## Cambios por área
| Área | Archivos / módulos | Qué cambia |
|---|---|---|
| **Backend** | `apps/api/src/google/` (controlador, servicio, esquemas, pruebas) | Nuevo `POST /google/link-login` (protegido con JWT y limitado por usuario): recibe el refresh token, lo valida contra Google, comprueba que concede `calendar.readonly` y `calendar.events` y que el correo coincide con el del JWT, lo cifra y lo guarda en `google_connections`. Si faltan permisos responde 409 `missing_scopes` y **no guarda nada**. Sin cambios de cifrado. |
| **Frontend: login** | `apps/web/src/services/supabase.ts`, `components/auth/useAuthState.ts` | `signInWithGoogle` pide los 4 permisos con `access_type=offline` y `prompt=consent`. Al recibir la sesión con `provider_refresh_token`, la envía a `/google/link-login`, la elimina de la sesión local y, si faltan permisos, cierra sesión y muestra el mensaje de C9. |
| **Frontend: pantallas** | `components/auth/AuthModal.tsx`, `components/landing/*`, `App.tsx` | Un solo botón «Continuar con Google». Se eliminan el formulario de correo, «Crear cuenta», «Explorar demo en vivo» y `provider: 'local' / 'demo'`. Sin sesión solo se ve la landing y no se monta `AppState` ni se leen datos. |
| **Frontend: Calendar** | `components/calendar/GoogleCalendarSyncModal.tsx`, `services/googleCalendar.ts`, `services/googleCloud.ts` | Se quitan «Conectar» y «Desvincular»; queda un indicador de estado. Se retira el transporte GIS (`signInWithGoogleAccount`, `trySilentGoogleReconnect`, token de 1 hora y claves `student_os_gcal_*`). Se conserva la lógica de eventos, gym y turno de trabajo. **Las firmas exportadas están congeladas por una prueba**: solo se pueden añadir exports, así que hay que actualizar esa prueba con tu aprobación para quitar los de GIS. |
| **Frontend: datos locales** | `hooks/useLocalStorage.ts`, `hooks/useSyncedAppState.ts`, `components/auth/SyncGate.tsx`, `components/sync/SyncProvider.tsx`, `sync/importMarker.ts`, `sync/backup.ts` | Se retira el importador y el modo local. Al iniciar sesión se **eliminan** los datos locales del prototipo (`student_os_state_v1`, `student_os_user_session`, claves `student_os_gcal_*`) sin subirlos (C14). **Zona protegida: aprobada en la spec.** |
| **Datos** | — | **Sin migración** con la opción B. |
| **Contrato** | `packages/shared` | Sin cambios de esquema. |
| **E2E y harness** | `apps/api/test/e2e-harness/` (`fake-supabase`, `fake-google`), `apps/web/e2e/` | El Supabase falso debe devolver `provider_refresh_token`; el Google falso debe simular que se desmarca Calendar. `01-nocloud` y `03-importer` se eliminan o se reescriben. |
| **Documentación** | `PROJECT.md`, `AGENTS.md`, `ARCHITECTURE.md`, `features.json`, ADR 0007 | Ver pasos. |

## Pruebas
| Criterio | Tipo | Dónde |
|---|---|---|
| C1 | E2E | `apps/web/e2e/` (nuevo `01-landing-solo-google`): la landing solo muestra «Continuar con Google» |
| C2 | E2E | mismo archivo: sin sesión no se ve la app ni datos |
| C3 | Integración + E2E | `apps/api/test/` (perfil creado en el servidor) y `02-login` |
| C4 | Unitaria | `services/supabase.test` (la petición lleva los 4 permisos, `offline` y `consent`) |
| C5 | Integración + E2E | `apps/api/test/google.e2e-spec.ts` (`link-login` guarda cifrado y `/google/status` da conectado) y `02-login` |
| C6 | Unitaria + E2E | `GoogleCalendarSyncModal.test.tsx` y `02-login`: no existen los botones |
| C7 | E2E | `04-two-devices` o nuevo: los eventos del Google falso aparecen sin acción manual |
| C8 | Unitarias existentes | `googleCalendar.*.test.ts` y `GoogleCalendarSyncModal.test.tsx` (se mantienen verdes) |
| C9 | Integración + E2E | `link-login` responde 409 sin guardar nada; `02-login` muestra el mensaje y el reintento |
| C10 | Unitaria + E2E | tras el enlace no queda el token en `localStorage` ni `sessionStorage` (según D1) |
| C11 | E2E | `02-login` caso 2c (hoy `test.fail`, BUG-01): cerrar sesión vuelve a la landing y no se heredan datos entre dos usuarios del mismo navegador |
| C12 | **Manual en producción** | Con una cuenta ajena a la lista de prueba, tras 007 y 008. No se puede automatizar |
| C13 | Integración existente | `apps/api/test/public.e2e-spec.ts` (se mantiene) |
| C14 | Unitaria + E2E | tras el login no quedan claves locales del prototipo y nada se sube |

## Pasos
Cada paso deja el proyecto en verde (`./scripts/check.sh` pasa) y acaba en un commit. Rama: `feat/009-login-google-calendar-automatico`.
1. **Prueba de viabilidad (sin tocar producción):** con el harness, comprobar qué entrega `signInWithOAuth` con `scopes`, `access_type=offline` y `prompt=consent`, y si `provider_refresh_token` queda en el almacenamiento. Resultado a `docs/references/`. Si falla, se vuelve a decidir D1.
2. **API:** `POST /google/link-login` con validación de permisos y correo, limitador por usuario y pruebas (C5, C9).
3. **Harness:** el Supabase falso devuelve `provider_refresh_token` y el Google falso simula permisos desmarcados.
4. **Web, login:** `signInWithGoogle` con los 4 permisos; enlace automático tras la sesión; limpieza del token; mensaje y reintento si faltan permisos (C4, C5, C9, C10).
5. **Web, quitar lo que sobra, en commits separados:** (a) cuenta local, demo y registro; (b) botón Conectar y Desvincular; (c) importador; (d) transporte GIS y la prueba que congela las firmas; (e) modo local y limpieza de datos locales (C14). Tras cada uno, `check.sh --rapido`.
6. **Web, `App.tsx`:** sin sesión solo landing, y corregir el BUG-01 para C11.
7. **E2E:** reescribir `01` y `02`, eliminar `03`, adaptar `04`.
8. **Documentación:** ADR 0007 (que reemplaza al 0004), actualizar `PROJECT.md`, `AGENTS.md` y `ARCHITECTURE.md`, marcar las funcionalidades 001 y 003 como obsoletas y poner la 009 en `revision`.
9. **Revisión:** `./scripts/check.sh` completo, skill `revisor` y PR.

## Aprobaciones que necesita el plan
- **Dependencias nuevas:** ninguna.
- **Migraciones:** ninguna (con la opción B).
- **Zonas protegidas:** el importador se retira (aprobado en la spec); el cifrado del token y el borrado de cuenta no se modifican.
- **Se pide permiso para:** (1) la decisión D1 y la nueva redacción de C10; (2) actualizar la prueba que congela las firmas de `googleCalendar.ts`; (3) añadir el estado `obsoleta` en `docs/features.json` para marcar 001 y 003, porque hoy el esquema solo admite `pendiente | spec | plan | en_curso | revision | hecho`.

## Riesgos
- **Lo que no se puede probar sin producción:** el comportamiento real de Supabase y de Google (consentimiento, entrega del refresh token, cuentas Workspace). Se valida con 007 y 008 y por eso C12 es manual.
- **Verificación de Google:** los permisos de Calendar son sensibles; mientras 008 no se apruebe, solo entran los 100 usuarios de prueba y se ve la advertencia de «app no verificada».
- **El cambio quita un modo de funcionamiento entero** de `App.tsx` (más de 2400 líneas) y toca 4 componentes que usan `localStorage` directo (`AuthModal`, `BackupModal`, `DailyHabitsCard`, `GymTracker`): se decide su destino en el paso 5.
- **Datos del prototipo:** quien tenga datos locales los pierde al entrar (C14). Hay que avisarlo en la pantalla antes del primer login.
- **BUG-01** debe quedar corregido para que C11 sea cierto, y puede ser más complejo de lo que parece (`App.tsx`, efecto ~línea 202).
