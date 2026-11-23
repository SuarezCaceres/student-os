# Plan Maestro Backend & Despliegue — Arquitectura Multi-Agente (Zero-Conflict)

> **Producto:** StudentOS, público, multiusuario, multi-dispositivo.
> **Stack:** NestJS + Prisma + Supabase (Postgres + Auth) · Frontend React 19 + Vite 8 · Monorepo npm workspaces.
> **Hosting:** Web en Vercel · API en Render free (cold start aceptado) · DB/Auth en Supabase.
> **Login:** solo Google (Supabase Auth). **Calendar:** sync persistente con refresh token cifrado en servidor.
> **Sync:** caché local + servidor manda (última edición gana). La UI nunca espera a la API.
> **Complementa a** [PLAN.md](PLAN.md) (UI/UX, ya completado). Leer también [memories.md](memories.md).

---

## 1. Cómo se ejecuta este plan

Cuando el usuario escribe **`procede`**, el Integrador (la sesión principal de Claude Code) ejecuta las olas **en orden**, y dentro de cada ola lanza **todos sus agentes en paralelo** (cada uno en su propio worktree, en segundo plano). Entre olas no se avanza hasta que el Integrador fusiona, verifica `build` + `lint` + tests y ajusta `App.tsx`.

```
Ola 0  Preparación        (Integrador + usuario)         ── secuencial
Ola 1  Cimientos          INFRA ∥ API-CORE ∥ CONTRACT    ── 3 agentes en paralelo
Ola 2  Motor de sync      SYNC-WEB ∥ SYNC-API            ── 2 agentes en paralelo
Ola 3  Módulos            KANBAN-UNI ∥ GYM ∥ CALENDAR ∥ GOOGLE ∥ PUBLIC  ── 5 agentes en paralelo
Ola 4  Cierre             QA-E2E (+ Integrador)          ── verificación y salida a producción
```

**Por qué esta forma:** una ola solo arranca cuando la anterior dejó listos los *huecos* (stubs) que la siguiente va a rellenar. Así ningún agente de una misma ola edita un archivo compartido.

---

## 2. Puntos calientes y cómo se neutralizan

| Punto de choque | Riesgo | Solución (aplicada antes de que lo toquen varios agentes) |
| :--- | :--- | :--- |
| `src/App.tsx` (2.644 líneas, todo `AppState` en un `useLocalStorage`) | Todos los módulos lo necesitan | **Solo el Integrador lo edita.** El motor de sync envuelve `AppState` por *slices* (diff por `id`), así que los módulos nunca tocan `App.tsx`. El cambio es una línea: `useLocalStorage` → `useSyncedAppState`. |
| Mover el frontend a `apps/web` | Rompe todas las rutas de los demás | Ola 1 con **INFRA** sola moviendo archivos; nadie más toca `apps/web` en esa ola. |
| `apps/api/src/app.module.ts` | Cada módulo quiere registrarse | **API-CORE** crea en Ola 1 un módulo *stub vacío* por cada módulo de Ola 3 y ya los registra. Los agentes de Ola 3 solo rellenan su carpeta. |
| `schema.prisma` | Un solo archivo = conflicto garantizado | Prisma **multi-archivo** (`prismaSchemaFolder`): `apps/api/prisma/schema/{base,profile,kanban,university,gym,calendar,google}.prisma`. Cada agente edita solo el suyo. |
| Migraciones Prisma | Orden y colisión de timestamps | Los agentes **no generan migraciones**. Prueban con `prisma db push` en un **schema Postgres privado** (`?schema=dev_<agente>`). El Integrador genera **una** migración consolidada al fusionar cada ola. |
| `package.json` / `package-lock.json` | Conflictos al añadir dependencias | Cada agente edita **solo el `package.json` de su workspace**. El lockfile lo regenera el Integrador (`npm install`) tras fusionar; ante conflicto en el lock, se descarta y se regenera. INFRA/API-CORE preinstalan las dependencias previsibles. |
| `packages/shared` (contrato) | Cambios cruzados web ↔ api | **CONTRACT** lo define en Ola 1. Después es *solo aditivo* y cada agente edita únicamente su archivo (`shared/src/<modulo>.ts`). Prohibido renombrar o borrar tipos. |
| `googleCalendar.ts` consumido por muchos | Cambiar firmas rompe a Gym/Calendario | **Patrón fachada:** GOOGLE mantiene las firmas exportadas y cambia solo la implementación (token en navegador → llamadas a la API). Solo puede *agregar* exports. |
| `memories.md` y `.env.example` | Todos quieren apendizar | Cada agente escribe sus notas en `docs/agent-notes/<AGENTE>.md` y lista variables nuevas ahí. El Integrador consolida en `memories.md` y `.env.example`. |

---

## 3. Reglas Zero-Conflict (obligatorias para todo agente)

1. **Trabaja solo en tu worktree y tu rama**, y modifica solo los archivos de tu *Alcance exclusivo*. Cualquier archivo fuera de él es de solo lectura.
2. **Prohibido para todos los agentes de Ola 2 y 3:** `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/index.html`, `package.json` de la raíz, `package-lock.json`, `.github/**`, `memories.md`, `.env.example`, `apps/api/src/app.module.ts`, `apps/web/src/sync/adapters/index.ts` (registro, ya pre-poblado con stubs).
3. **Contrato primero:** si tu módulo necesita un tipo nuevo, agrégalo en tu archivo de `packages/shared/src/<modulo>.ts`. Nunca cambies tipos existentes de otro módulo.
4. **Sin secretos en el repo.** Nunca commitear `.env*`, claves de Supabase `service_role`, `GOOGLE_CLIENT_SECRET`, ni la clave de cifrado. Solo variables de entorno y `.env.example` (lo actualiza el Integrador).
5. **El frontend jamás recibe la `service_role`** ni el refresh token de Google. Solo `SUPABASE_URL` y la clave pública (*publishable/anon*).
6. **Pruebas dentro de tu alcance:** API con Jest/Supertest; web con Vitest o Playwright con mocks (como el patrón `verify_*.mjs` de `memories.md`). Sin pruebas, sin entrega.
7. **Verificación obligatoria antes del commit:**
   ```powershell
   npm run build --workspaces --if-present
   npm run lint  --workspaces --if-present
   npm test      --workspaces --if-present
   ```
8. **Commits** con el estándar `github-workflow-standards` (`feat(scope): ...`) y la atribución indicada por el harness. **No hacer `git push` ni abrir PR:** eso lo decide el Integrador con el usuario.
9. **Idioma y UI:** español, textos y diseño según `design-taste-frontend` (ver `PLAN.md` §Reglas): sin violeta, sin adornos "AI-slop", objetivos táctiles ≥ 44 px, texto ≥ 13 px.
10. **Informe final obligatorio** de cada agente: archivos tocados, decisiones, pruebas ejecutadas con su resultado, variables de entorno nuevas, deuda pendiente. Si algo falló, decirlo tal cual.

---

## 4. Olas y agentes

### Ola 0 — Preparación (Integrador + usuario, sin código de funcionalidad)

| Paso | Qué | Quién |
| :--- | :--- | :--- |
| 0.1 | Fusionar `feat/overview-summary` en `main` (PR) para que producción parta del estado actual | Integrador **con aprobación del usuario** |
| 0.2 | **Despliegue Fase 0:** proyecto Vercel conectado a `SuarezCaceres/student-os`, build `npm run build`, salida `dist`, variable `VITE_GOOGLE_CLIENT_ID` | Integrador (conector Vercel) |
| 0.3 | Agregar la URL de Vercel a *Orígenes autorizados de JavaScript* del OAuth Client; usuario de prueba en la pantalla de consentimiento | **Usuario** (consola de Google) |
| 0.4 | Crear 2 proyectos Supabase: `student-os-dev` y `student-os-prod` (el plan gratis permite 2 activos) | Integrador (conector Supabase) **con confirmación** |
| 0.5 | Rama de integración `integration/backend` desde `main` | Integrador |

*Listo cuando:* el login con Google funciona en la URL pública sin tocar ningún `.env`.

---

### Ola 1 — Cimientos (3 agentes en paralelo)

Base: `integration/backend`. Orden de fusión: **INFRA → API-CORE → CONTRACT**.

#### Agente INFRA — `feat/be-infra`
- **Alcance exclusivo:** `package.json` raíz, `tsconfig.base.json`, `.github/workflows/**`, `vercel.json`, `.gitignore`, y el **movimiento** (`git mv`) de todo el frontend actual a `apps/web/` (`src`, `public`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `scripts`).
- **Entregables:**
  - Workspaces npm: `apps/web`, `apps/api`, `packages/shared`.
  - Scripts raíz: `dev:web`, `dev:api`, `build`, `lint`, `test`.
  - CI con jobs separados para web, api y shared.
  - `vercel.json` con *Root Directory* `apps/web`.
  - Preinstalar dependencias previsibles del web: `@supabase/supabase-js`, `zod`, `idb-keyval` (cola/caché).
- **Criterio de salida:** `npm ci && npm run build` verde desde la raíz; `npm run dev:web` arranca igual que antes (misma UI).
- **Prohibido:** tocar `apps/api/**` y `packages/shared/**`.

#### Agente API-CORE — `feat/be-api-core`
- **Alcance exclusivo:** `apps/api/**` (carpeta nueva; no hay choque con el movimiento de INFRA).
- **Entregables:**
  - Esqueleto NestJS + `ConfigModule` con validación de entorno (zod).
  - **Guard de Supabase JWT** (verificación con JWKS, `jose`), decorador `@CurrentUser()`.
  - Prisma 6.7+ con `prismaSchemaFolder`; `base.prisma` con `datasource` (`DATABASE_URL` pooler + `DIRECT_URL`) y modelo `Profile`.
  - **Stubs registrados** en `app.module.ts`: `SyncModule`, `ProfileModule`, `KanbanModule`, `UniversityModule`, `GymModule`, `CalendarModule`, `GoogleModule`, `PublicModule`, cada uno con su carpeta, controlador vacío y archivo `.prisma` vacío.
  - `GET /health`, CORS por lista blanca (`WEB_ORIGINS`), Helmet, `ThrottlerModule`, filtro global de errores, `pino` para logs.
  - `render.yaml` (build, start, health check) y `README` del api con la guía de `DATABASE_URL`/`DIRECT_URL`.
  - RLS activada por defecto en tablas (defensa en profundidad) y pruebas del guard.
- **Criterio de salida:** `npm run build -w apps/api` verde; `GET /health` responde; una petición con JWT inválido recibe `401`; tests del guard pasan.

#### Agente CONTRACT — `feat/be-contract`
- **Alcance exclusivo:** `packages/shared/**`.
- **Entregables:**
  - Esquemas **zod** + tipos TS para cada entidad de `AppState` (copiados de `apps/web/src/types/index.ts` como referencia de solo lectura): `kanban`, `university`, `learning` (reflexiones), `gym`, `calendar`, `profile`, `habits`, `workShift`.
  - **Envoltorio de sync** común: `SyncRecord { id: uuid, collection, data, updatedAt, deletedAt|null, rev }`, `SyncPullResponse { records, cursor }`, `SyncPushRequest { changes }`, `SyncPushResponse { applied, conflicts }`.
  - Mapa `AppState → colecciones` (`kanbanItems→kanban`, `universityAssignments→university`, `weeklyReflections→learning`, `gymRoutines/gymProfile/weightHistory/gymAttendanceLogs/dismissedGymScheduleAlerts→gym`, `calendarBlocks/workShift/dailyHabits→calendar`, `studentName/career/currentAcademicWeek/streak/theme→profile`).
  - Un archivo por módulo (`shared/src/<modulo>.ts`) + `index.ts` que reexporta todo.
- **Criterio de salida:** `build` verde; los tipos reproducen `AppState` sin pérdida (test que valida el estado inicial de `initialData.ts` contra los esquemas).

**Integración de Ola 1 (Integrador):** fusionar en el orden indicado, `npm install`, `build`+`lint`+`test`, actualizar Vercel (*Root Directory* `apps/web`) y verificar que el despliegue no se rompió. Crear los stubs web `apps/web/src/sync/adapters/{kanban,university,learning,gym,calendar,profile}.ts` y su `index.ts` (registro) **antes** de lanzar la Ola 2.

---

### Ola 2 — Motor de sync (2 agentes en paralelo)

Orden de fusión: **SYNC-API → SYNC-WEB**.

#### Agente SYNC-API — `feat/be-sync-api`
- **Alcance exclusivo:** `apps/api/src/sync/**`, `apps/api/src/profile/**`, `apps/api/prisma/schema/profile.prisma`, `apps/api/prisma/schema/sync.prisma`.
- **Entregables:**
  - `GET /sync/pull?since=<cursor>` y `POST /sync/push` genéricos por colección: **última edición gana** por `updatedAt`, borrado lógico (`deletedAt`), idempotencia por `id` del cliente, validación con los esquemas de `shared`.
  - Tabla genérica de registros por usuario (`userId`, `collection`, `id`, `data jsonb`, `updatedAt`, `deletedAt`, `rev`) con índices `(userId, collection, updatedAt)`.
  - Perfil/preferencias (`GET/PATCH /profile`), y límite de tamaño por petición y por usuario.
  - Pruebas: dos clientes simulados, conflicto, reintento duplicado, aislamiento entre usuarios (un usuario nunca lee datos de otro).
- **Criterio de salida:** tests de aislamiento y conflicto verdes.
- **Nota de diseño:** los módulos de Ola 3 pueden añadir tablas relacionales propias, pero el contrato de sync no cambia.

#### Agente SYNC-WEB — `feat/be-sync-web`
- **Alcance exclusivo:** `apps/web/src/sync/**` (excepto `adapters/*.ts`, que son de Ola 3), `apps/web/src/hooks/useSyncedAppState.ts`, `apps/web/src/services/api.ts`, `apps/web/src/services/supabase.ts`, `apps/web/src/components/auth/**`, `apps/web/src/utils/accountDataCleanup.ts`, `apps/web/src/components/sync/**` (indicador de estado).
- **Entregables:**
  - Cliente API con reintentos y *backoff* tolerante al **cold start** (hasta ~60 s) y mensaje honesto de "sincronizando".
  - Login con **Supabase Auth (Google)**; reemplaza al `AuthModal` actual manteniendo su aspecto.
  - **Motor de sync:** diff por `id` de cada slice de `AppState`, cola persistente de cambios pendientes (IndexedDB), push en segundo plano, pull al abrir/recuperar foco, indicador "Sincronizado / Pendiente / Sin conexión".
  - **Importador de `localStorage`** en el primer login (una sola vez, con confirmación y respaldo previo).
  - `useSyncedAppState(initial)` con la **misma firma** que `useLocalStorage` para que el Integrador solo cambie una línea.
  - Contrato de adaptador por módulo: `SyncAdapter { collection, select(state), apply(state, records) }`, para que Ola 3 solo rellene su archivo.
  - Pruebas con API simulada: offline→online, dos pestañas, conflicto, cold start.
- **Criterio de salida:** con la API simulada, editar offline y reconectar converge sin pérdida; cero cambios en `App.tsx` desde este agente.

**Integración de Ola 2 (Integrador):** fusionar, **editar `App.tsx` (una línea + login/estado de sync)**, generar la migración Prisma consolidada contra `student-os-dev`, desplegar la API en Render (acción del usuario, ver §7) y probar el flujo real de login + sync de **perfil** entre dos navegadores.

---

### Ola 3 — Módulos (5 agentes en paralelo)

Todos parten de la misma base fusionada de Ola 2, y cada uno rellena **sus** stubs (API + adaptador web). Orden de fusión: cualquiera (no comparten archivos); el Integrador regenera el lockfile y la migración al final.

| Agente | Rama | Alcance exclusivo (API) | Alcance exclusivo (Web) |
| :--- | :--- | :--- | :--- |
| **KANBAN-UNI** | `feat/be-kanban-uni` | `apps/api/src/{kanban,university}/**`, `prisma/schema/{kanban,university}.prisma` | `sync/adapters/{kanban,university,learning}.ts`, `components/{kanban,university,learning}/**`, `utils/academicStats.ts` |
| **GYM** | `feat/be-gym` | `apps/api/src/gym/**`, `prisma/schema/gym.prisma` | `sync/adapters/gym.ts`, `components/gym/**`, `utils/{gymAttendance,gymScheduleFilter,gymSchedulePlanner,gymScheduleSync,routineGenerator}.ts`, `data/exerciseMediaCatalog.ts` |
| **CALENDAR** | `feat/be-calendar` | `apps/api/src/calendar/**`, `prisma/schema/calendar.prisma` | `sync/adapters/{calendar,profile}.ts`, `components/calendar/{WeeklyCalendar,CalendarTimelineGrid,WorkShiftModal,ReminderPresetPicker}.tsx`, `components/dashboard/**`, `utils/{workSchedule,calendarSlotFinder,icsExport,reminderPresets}.ts` |
| **GOOGLE** | `feat/be-google-persistent` | `apps/api/src/google/**`, `prisma/schema/google.prisma` | `services/googleCalendar.ts`, `utils/googleCalendarDiff.ts`, `components/calendar/{GoogleCalendarSyncModal,GoogleChangeBanner,GoogleImpactModal}.tsx` |
| **PUBLIC** | `feat/be-public-ready` | `apps/api/src/public/**`, `apps/api/src/common/security/**` | `apps/web/public/legal/**`, `components/legal/**` (política de privacidad, términos, borrado de cuenta) |

Entregables y criterios por agente:

- **KANBAN-UNI:** CRUD vía sync de proyectos, entregas, calificaciones y reflexiones semanales; el adaptador reproduce exactamente el comportamiento de hoy (confeti, semáforo de vencimiento). *Salida:* editar una entrega en el celular aparece en el PC; tests de aislamiento por usuario.
- **GYM:** rutinas, series, pesos, PRs, racha, asistencia y alertas descartadas (`dismissedGymScheduleAlerts`). Sin tocar `googleCalendar.ts`. *Salida:* completar series offline y sincronizar sin duplicar ni perder 1RM.
- **CALENDAR:** bloques locales, turno laboral y hábitos diarios. Los eventos que vienen de Google **no se duplican** en la base (se siguen leyendo de Google). *Salida:* `0` bloques `category === 'gym'` locales cuando Google está conectado (invariante actual de `memories.md`).
- **GOOGLE:** flujo de **código de autorización con PKCE**; Nest intercambia el código y guarda el **refresh token cifrado (AES-256-GCM)** con clave en variable de entorno; renovación automática del access token; endpoints proxy a Calendar API v3 (`list/create/patch/delete`, series `RRULE`/`UNTIL`); desconexión con **revocación** del token y borrado del secreto. Mantiene **todas las firmas exportadas** de `googleCalendar.ts` (patrón fachada), así Gym y Calendario no cambian. *Salida:* conectar una vez y seguir sincronizando al día siguiente sin reconectar; el navegador nunca ve el refresh token.
- **PUBLIC:** *rate limiting* por usuario/IP, límites de cuota por cuenta, endpoint de **exportar y borrar cuenta** (GDPR-style), páginas de privacidad/términos (requisito de verificación de Google), cabeceras de seguridad, y checklist de verificación de la app en Google (scopes mínimos). *Salida:* borrar cuenta elimina todos los datos y revoca el token de Google.

**Integración de Ola 3 (Integrador):** fusionar los 5, regenerar lockfile, generar migración consolidada, `build`+`lint`+`test` globales, conectar en `App.tsx` lo que quede (callbacks opcionales), desplegar preview en Vercel + API en Render.

---

### Ola 4 — Cierre y salida a producción

| Agente | Rama | Alcance | Entregable |
| :--- | :--- | :--- | :--- |
| **QA-E2E** | `feat/be-qa-e2e` | `apps/web/e2e/**`, `apps/api/test/e2e/**`, `docs/qa/**` | Playwright contra preview real: login, migración de `localStorage`, edición en 2 contextos (PC `1440x960` + móvil `390x844`), offline→online, cold start, conectar Google Calendar y persistencia al día siguiente (con mocks de Google), borrado de cuenta. Informe con evidencias. |

Después, el Integrador: migración a `student-os-prod`, variables de producción en Vercel y Render, PR final `integration/backend → main`, ping programado para evitar la **pausa de Supabase a los 7 días** y actualización de `memories.md` y `README.md`.

---

## 5. Cableado de `App.tsx` (solo el Integrador)

| Momento | Cambio |
| :--- | :--- |
| Fin Ola 2 | `useLocalStorage` → `useSyncedAppState`; montar login (`SyncProvider`) e indicador de estado de sync. |
| Fin Ola 3 | Pasar callbacks opcionales que los agentes hayan declarado con `?`; reemplazar el uso del token en navegador por la fachada de Google. |
| Fin Ola 4 | Ajustes de QA. |

---

## 6. Protocolo de integración por ola

```powershell
# Desde el worktree del Integrador, en integration/backend
git merge --no-ff <rama-agente-1> -m "merge(<agente>): <resumen>"
git merge --no-ff <rama-agente-2> -m "merge(<agente>): <resumen>"
# ...en el orden definido para la ola

# Si hay conflicto en package-lock.json: descartar y regenerar
Remove-Item package-lock.json; npm install

npm run build --workspaces --if-present
npm run lint  --workspaces --if-present
npm test      --workspaces --if-present

# Migración consolidada (una por ola), contra student-os-dev
npx prisma migrate dev --name wave-<n> --schema apps/api/prisma/schema
```

- Si el `build` falla tras fusionar, se **corrige antes de lanzar la ola siguiente**.
- Antes de fusionar, el Integrador lee cada informe final y revisa el diff de cada agente (con `/code-review`).
- Worktrees en Windows: desvincular el *junction* de `node_modules` antes de `git worktree remove` (ver `PLAN.md` §Secuencia de Integración).

---

## 7. Compuertas humanas (el Integrador se detiene y pide acción/confirmación)

| Cuándo | Acción | Responsable |
| :--- | :--- | :--- |
| Ola 0 | Fusionar `feat/overview-summary` en `main` | Usuario aprueba |
| Ola 0 | Orígenes autorizados + usuario de prueba en Google Cloud | Usuario |
| Ola 0 | Crear proyectos Supabase (dev/prod) | Usuario confirma |
| Fin Ola 1 | Crear servicio en **Render** conectado al repo (no hay conector), pegar variables de entorno | Usuario (guía paso a paso del Integrador) |
| Ola 3 | Credenciales OAuth para el flujo de código (Client Secret) y clave de cifrado `GOOGLE_TOKEN_ENC_KEY` en Render | Usuario (nunca en el repo) |
| Antes de público | Publicar pantalla de consentimiento en *In production* (los refresh tokens en *Testing* expiran a los 7 días) y enviar a **verificación de Google** (política de privacidad, dominio, video de demostración) | Usuario |
| Siempre | `git push`, abrir/fusionar PR a `main`, desplegar a producción | Usuario aprueba |

---

## 8. Riesgos conocidos

1. **Refresh token en modo *Testing*:** caduca en 7 días → hay que pasar a *In production* (sin verificar: máx. 100 usuarios y aviso de "app no verificada").
2. **Supabase gratis** pausa proyectos inactivos 7 días → ping programado.
3. **Prisma + pooler:** `DATABASE_URL` (pooler, `pgbouncer=true`) para la app y `DIRECT_URL` para migraciones.
4. **Cold start de Render** (~30–60 s) → amortiguado por caché local y cola de sync.
5. **Ola 3 con 5 agentes** exige que los stubs de Ola 1–2 estén completos; si un agente necesita un archivo compartido, **no lo edita**: lo reporta y el Integrador lo resuelve.
6. **Verificación de Google** puede tardar semanas; el producto funciona para ≤ 100 usuarios mientras tanto.

---

## 9. Estado

| Ola | Estado |
| :--- | :--- |
| Ola 0 — Preparación y despliegue | Hecha |
| Ola 1 — INFRA ∥ API-CORE ∥ CONTRACT | Hecha (fusionada) |
| Ola 2 — SYNC-API ∥ SYNC-WEB | Hecha (fusionada) |
| Ola 3 — KANBAN-UNI ∥ GYM ∥ CALENDAR ∥ GOOGLE ∥ PUBLIC | Hecha (fusionada) |
| Ola 4 — QA-E2E | Hecha (fusionada en `integration/backend`) |
| Ola 4 — Producción (`student-os-prod`, variables en Vercel/Render, PR final a `main`, ping anti-pausa de Supabase) | Pendiente |
