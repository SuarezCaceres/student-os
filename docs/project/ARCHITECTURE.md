# Arquitectura

> Fase 3 (2026-11-23): despliegue (Vercel + Render + Supabase), mapa de pruebas y pre-commit **confirmados por el humano**; el resto se dedujo del código.

## Vista general
```
                       ┌─────────────── localStorage + IndexedDB (modo local, sin cuenta)
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
| Frontend    | `apps/web/`        | UI de los módulos (Resumen, Kanban, Universidad, Gym, Calendario, Aprendizaje, hábitos), modo local, login, motor de sync y fachada de Google Calendar |
| Backend/API | `apps/api/`        | Verifica el JWT de Supabase, almacena y sirve registros de sync, guarda el refresh token de Google, exporta/borra cuenta, throttling y cabeceras de seguridad |
| Compartido  | `packages/shared/` | Esquemas zod y tipos: `AppState`, colecciones de sync, Kanban, Universidad, Gym, Calendario, hábitos, perfil, turnos |
| Pruebas     | `apps/api/test/`, `apps/web/e2e/` | Integración del API (Postgres embebido) y E2E (Supabase y Google simulados en `apps/api/test/e2e-harness/`) |

## Modos de funcionamiento
- **Local (sin cuenta):** `useLocalStorage` guarda todo el `AppState` en el navegador. Es el comportamiento original y hoy funciona sin red ni backend.
- **Nube (con sesión):** `useSyncedAppState` envuelve el `AppState` por *slices*, calcula diferencias por `id`, las encola en IndexedDB y las envía en segundo plano; al abrir o recuperar el foco hace *pull*. Un importador decide qué hacer con los datos locales en el primer inicio de sesión.

## Contrato y sync
- **Contrato:** `packages/shared` define los esquemas zod. `COLLECTIONS = profile, kanban, university, learning, gym, calendar`; cada registro de sync se valida contra el esquema de su colección.
- **Endpoints de sync:** `GET /sync/pull?since=<cursor>` y `POST /sync/push`. El `userId` sale **siempre** del JWT, nunca del cuerpo.
- **Cursor:** contador `seq` por usuario asignado por el servidor (no `now()` ni `SEQUENCE`), para no saltarse escrituras concurrentes.
- **Conflictos:** última edición gana (`apps/api/src/sync/sync-logic.ts`, lógica pura); los borrados son *tombstones*.
- **Adaptadores web:** `apps/web/src/sync/adapters/{kanban,university,learning,gym,calendar,profile}.ts` traducen cada slice de `AppState` a registros.
- **Nota:** los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son hoy controladores vacíos (6 líneas); todo el dato de dominio viaja por el `/sync` genérico. Ver «Deuda» en `docs/TASKS.md`.

## Google Calendar
Con la nube activa, el servidor guarda el *refresh token* cifrado (AES-256-GCM, clave `GOOGLE_TOKEN_ENC_KEY`) y hace de proxy hacia Calendar v3 (`/google/*`: connect con PKCE, callback, status, disconnect y operaciones de eventos). Sin nube, la web usa GIS en el navegador (token de 1 hora). Detalle en `docs/agent-notes/GOOGLE.md`.

## Datos
- **BD:** PostgreSQL (Supabase). Esquema Prisma dividido en `apps/api/prisma/schema/*.prisma`; modelos actuales: `Profile`, `SyncItem`, `UserSyncState`, `GoogleConnection`, `GoogleOAuthState`.
- **Migraciones:** `apps/api/prisma/migrations/` (SQL versionado) + `rls-baseline.sql`. Se aplican **a mano** contra Supabase; `render.yaml` no las ejecuta.
- **Seguridad de datos:** RLS en Supabase para los secretos, logs con redacción de PII, borrado de cuenta que elimina sync, estado, perfil y el token de Google.

## Entornos y variables
- **Web (`.env.example` raíz):** `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **API (`apps/api/.env.example`):** `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_JWT_AUDIENCE`, `WEB_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`.
- Producción (`student-os-prod`) pendiente; ver `docs/TASKS.md`.

## Decisiones relevantes
- `docs/decisions/0001-agents-md-como-indice-unico.md`: `AGENTS.md` como índice único.
- `docs/decisions/0003-sync-con-cursor-por-seq-y-ultima-edicion-gana.md`: protocolo de sync.
- `docs/decisions/0004-modo-local-sin-cuenta-y-modo-nube.md`: los dos modos y el importador.
- `docs/decisions/0005-refresh-token-de-google-cifrado-en-el-servidor.md`: token de Google en el servidor.
- `docs/decisions/0006-pruebas-e2e-con-supabase-y-google-simulados.md`: estrategia de E2E.
- Reservado: `0002` para la adopción del harness (Fase 7).
- Historial previo en `docs/agent-notes/*.md`, `PLAN_BACKEND.md` y `memories.md`.
