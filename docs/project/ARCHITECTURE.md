# Arquitectura

> Fase 3 (2026-11-23): despliegue (Vercel + Render + Supabase), mapa de pruebas y pre-commit **confirmados por el humano**; el resto se dedujo del código.

## Vista general
```
                       ┌─ caché local (localStorage) + cola de sync (IndexedDB)
[Navegador] apps/web ──┤
 (React, Vite)         └─ con sesión ─▶ cola de sync ─(HTTP/JSON + JWT)─▶ apps/api (NestJS) ─▶ [Postgres/Supabase]
        │                                                                      │
        └── Supabase Auth (login con Google, PKCE) ─ emite el JWT              └─▶ Google Calendar v3 (refresh token cifrado)
                              ▲
              packages/shared (esquemas zod + tipos): contrato único de web y api
```
Despliegue: web en **Vercel** (Root Directory `apps/web`), API en **Render** (`render.yaml`, free, cold start aceptado), datos y auth en **Supabase**.

## Piezas
| Pieza       | Ubicación          | Responsabilidad |
|-------------|--------------------|-----------------|
| Frontend    | `apps/web/`        | UI de los módulos (Resumen, Kanban, Universidad, Gym, Calendario, Aprendizaje, hábitos), login con Google, motor de sync y fachada de Google Calendar |
| Backend/API | `apps/api/`        | Verifica el JWT de Supabase, almacena y sirve registros de sync, guarda el refresh token de Google, exporta/borra cuenta, throttling y cabeceras de seguridad |
| Compartido  | `packages/shared/` | Esquemas zod y tipos: `AppState`, colecciones de sync, Kanban, Universidad, Gym, Calendario, hábitos, perfil, turnos |
| Pruebas     | `apps/api/test/`, `apps/web/e2e/` | Integración del API (Postgres embebido) y E2E (Supabase y Google simulados en `apps/api/test/e2e-harness/`) |

## Sesión y datos
- **Sin sesión solo se ve la landing**; la única entrada es «Continuar con Google» (ADR 0007). No hay modo local, demo ni cuenta local.
- **Con sesión:** `useSyncedAppState` guarda el `AppState` en `localStorage` (caché de la cuenta), lo envuelve por *slices*, calcula diferencias por `id`, las encola en IndexedDB y las envía en segundo plano; al abrir o recuperar el foco hace *pull*.
- **Primer acceso en un navegador:** si ese navegador no tiene a la cuenta ya arrancada, el estado local se descarta (nunca se sube) y se parte de la nube o, si está vacía, del estado de una cuenta nueva (`utils/newAccountState.ts`). Al abrir la app se borran las claves del prototipo (`clearLegacyLocalData`).

## Contrato y sync
- **Contrato:** `packages/shared` define los esquemas zod. `COLLECTIONS = profile, kanban, university, learning, gym, calendar`; cada registro de sync se valida contra el esquema de su colección.
- **Endpoints de sync:** `GET /sync/pull?since=<cursor>` y `POST /sync/push`. El `userId` sale **siempre** del JWT, nunca del cuerpo.
- **Cursor:** contador `seq` por usuario asignado por el servidor (no `now()` ni `SEQUENCE`), para no saltarse escrituras concurrentes.
- **Conflictos:** última edición gana (`apps/api/src/sync/sync-logic.ts`, lógica pura); los borrados son *tombstones*.
- **Adaptadores web:** `apps/web/src/sync/adapters/{kanban,university,learning,gym,calendar,profile}.ts` traducen cada slice de `AppState` a registros.
- **Nota:** los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son hoy controladores vacíos (6 líneas); todo el dato de dominio viaja por el `/sync` genérico. Ver «Deuda» en `docs/TASKS.md`.

## Google Calendar
Calendar se vincula en el login: Supabase entrega el `provider_refresh_token` a la web, que lo envía una sola vez a `POST /google/link-login` y no lo persiste (un adaptador de almacenamiento lo elimina). El servidor guarda el *refresh token* cifrado (AES-256-GCM, clave `GOOGLE_TOKEN_ENC_KEY`) y hace de proxy hacia Calendar v3 (`/google/*`: link-login, status, operaciones de eventos y revocación al borrar la cuenta). La web ya no usa Google Identity Services ni tiene botones de conectar o desvincular. Detalle en ADR 0005 y 0007 y en `docs/references/frontend/supabase-provider-tokens.md`.

## Datos
- **BD:** PostgreSQL (Supabase). Esquema Prisma dividido en `apps/api/prisma/schema/*.prisma`; modelos actuales: `Profile`, `SyncItem`, `UserSyncState`, `GoogleConnection`, `GoogleOAuthState`.
- **Migraciones:** `apps/api/prisma/migrations/` (SQL versionado) + `rls-baseline.sql`. Se aplican **a mano** contra Supabase; `render.yaml` no las ejecuta.
- **Seguridad de datos:** RLS en Supabase para los secretos, logs con redacción de PII, borrado de cuenta que elimina sync, estado, perfil y el token de Google.

## Entornos y variables
- **Web (`.env.example` raíz):** `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_GOOGLE_CLIENT_ID` ya no se usa en la web (sigue listada en `.env.example` hasta poder editarlo; ver `docs/TASKS.md` M4).
- **API (`apps/api/.env.example`):** `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE`, `WEB_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`.
- Producción (`student-os-prod`) pendiente; ver `docs/TASKS.md`.

## Decisiones relevantes
- `docs/decisions/0001-agents-md-como-indice-unico.md`: `AGENTS.md` como índice único.
- `docs/decisions/0003-sync-con-cursor-por-seq-y-ultima-edicion-gana.md`: protocolo de sync.
- `docs/decisions/0004-modo-local-sin-cuenta-y-modo-nube.md`: los dos modos y el importador *(reemplazada por la 0007)*.
- `docs/decisions/0007-login-solo-con-google-y-calendar-vinculado-al-entrar.md`: login solo con Google, Calendar vinculado y sin modo local.
- `docs/decisions/0005-refresh-token-de-google-cifrado-en-el-servidor.md`: token de Google en el servidor.
- `docs/decisions/0006-pruebas-e2e-con-supabase-y-google-simulados.md`: estrategia de E2E.
- `docs/decisions/0002-adopcion-del-harness.md`: cómo se adaptó el harness a este proyecto.
- Historial previo en `docs/agent-notes/*.md`, `PLAN_BACKEND.md` y `memories.md`.
