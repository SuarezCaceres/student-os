# Stack del backend

> Fase 3 (2026-11-23): despliegue (Vercel + Render + Supabase), mapa de pruebas y pre-commit **confirmados por el humano**; el resto se dedujo del código.

| Aspecto              | Elección                                                      | Versión   |
|----------------------|---------------------------------------------------------------|-----------|
| Lenguaje             | TypeScript                                                    | ^5.9      |
| Framework            | NestJS (Express)                                              | ^11.1     |
| Base de datos        | PostgreSQL en Supabase (pooler 6543 + conexión directa 5432)   | —         |
| ORM / acceso a datos | Prisma (esquema dividido en `prisma/schema/*.prisma`)          | ^6.19     |
| Validación           | `zod` (esquema de entorno y contrato en `@student-os/shared`)  | ^4.1      |
| Autenticación        | JWT de Supabase verificado con `jose` (`SupabaseJwtGuard` global, decorador `@Public()`) | ^5.10 |
| Seguridad            | `helmet`, `@nestjs/throttler` (throttling por usuario), redacción de logs (`nestjs-pino`) | — |
| Pruebas              | Jest + ts-jest + supertest; integración con `embedded-postgres` | ^29.7   |
| Linter               | oxlint (`apps/api/.oxlintrc.json`)                            | ^1.0      |
| Gestor de paquetes   | npm workspaces                                                | npm 11    |
| Despliegue           | Render (Blueprint `render.yaml`, `autoDeploy: false`, `/health`) | Node 22 |

## Comandos
Se ejecutan desde la raíz del repo.

| Acción                | Comando                                                   |
|-----------------------|-----------------------------------------------------------|
| Desarrollo            | `npm run dev:api` (`nest start --watch`)                  |
| Build                 | `npm run build -w @student-os/api`                        |
| Lint                  | `npm run lint -w @student-os/api`                         |
| Tipos                 | `npm run typecheck -w @student-os/api`                    |
| Pruebas unitarias     | `npm test -w @student-os/api` (Jest)                      |
| Pruebas integración   | `npm run test:e2e -w @student-os/api` (HTTP + Postgres embebido, ~17 s) |
| Generar cliente Prisma| `npm run prisma:generate -w @student-os/api`              |
| Validar esquema       | `npm run prisma:validate -w @student-os/api`              |
| Crear migración       | **Pendiente de definir** (hoy las migraciones SQL están en `prisma/migrations/` y se aplican a mano; requiere aprobación) |
| Aplicar migraciones   | **Manual**, por el humano, contra Supabase                |

### Puertos de las pruebas y `E2E_PORT_OFFSET`
Las pruebas usan puertos fijos (Postgres embebido, Supabase/Google falsos, API y Vite del E2E). Si dos sesiones corren pruebas a la vez en la misma máquina chocan (`P1001: Can't reach database server at 127.0.0.1:54334`). Para evitarlo, **una sola variable de entorno desplaza todos los puertos**:

```bash
E2E_PORT_OFFSET=2000 ./scripts/check.sh --rapido     # también vale para npm run test:e2e -w ... y para git commit (el hook la hereda)
```

- Entero `>= 0`; por defecto `0`, que deja los puertos de siempre. Si no es un entero válido o saca un puerto de rango (> 65535), las pruebas fallan al arrancar.
- Cada sesión debe usar un desplazamiento distinto (p. ej. 0, 100, 200…). Con desplazamientos pequeños los rangos pueden solaparse: separa los valores al menos 20.
- En Windows, algunos rangos están reservados por el sistema y Postgres embebido falla al arrancar (`public-pg-server: undefined`). Comprueba el desplazamiento con `netsh int ipv4 show excludedportrange protocol=tcp` (en una máquina con el rango 55842-56360 reservado, `2000` falló y `500` funcionó).
- Puertos base: integración `54329` (sync), `54334` (google), `54335` (public); E2E `54340` (Postgres), `54341` (Supabase falso), `54342` (Google falso), `54343` (control), `3100` (API), `5293` y `5294` (Vite con y sin nube).
- Fuente única: `apps/api/test/ports.cjs` (la leen los helpers `*-pg.ts`, los `*-pg-server.mjs`, `e2e-harness/config.mjs` y, a través de este, `apps/web/e2e/support/harness.ts`). Para añadir un puerto nuevo, añádelo solo ahí. Prueba: `apps/api/test/ports.e2e-spec.ts`.

## Producción (`student-os-prod`): variables y orden de despliegue
Receta del plan 007 (`docs/specs/007-produccion-student-os-prod/plan.md`). **Aquí solo van los nombres**: los valores viven en los paneles de cada servicio y en el gestor de contraseñas del humano, nunca en el repositorio, en commits, en logs ni en chats.

### Variables por servicio
| Servicio | Variable | Qué es |
|----------|----------|--------|
| Render (API) | `NODE_ENV` | `production` (fijada en `render.yaml`) |
| Render (API) | `NODE_VERSION` | `22` (fijada en `render.yaml`) |
| Render (API) | `PORT` | La inyecta Render; no se declara |
| Render (API) | `SUPABASE_JWT_AUDIENCE` | `authenticated` (fijada en `render.yaml`) |
| Render (API) | `DATABASE_URL` | Pooler de Supabase, puerto 6543, con `?pgbouncer=true` · **secreto** |
| Render (API) | `DIRECT_URL` | Conexión directa de Supabase, puerto 5432 · **secreto** |
| Render (API) | `SUPABASE_URL` | `https://<ref>.supabase.co`, sin barra final |
| Render (API) | `WEB_ORIGINS` | Orígenes de la web separados por comas (dominio y `www`), sin barra final ni ruta. Obligatoria con `NODE_ENV=production` |
| Render (API) | `GOOGLE_CLIENT_ID` | Cliente OAuth **de producción** (el mismo que el proveedor Google de Supabase Auth) |
| Render (API) | `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente · **secreto** |
| Render (API) | `GOOGLE_TOKEN_ENC_KEY` | Clave AES-256-GCM de los refresh tokens (`openssl rand -base64 32`, ≥ 32 caracteres) · **secreto**. Respáldala **antes de la primera vinculación**: rotarla deja ilegibles los tokens guardados y requiere aprobación del humano |
| Vercel (web) | `VITE_SUPABASE_URL` | La misma URL de Supabase |
| Vercel (web) | `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave **pública** (publishable) de Supabase; nunca la `service_role` |
| Vercel (web) | `VITE_API_URL` | `https://api.<dominio>` |
| Vercel (web) | ~~`VITE_GOOGLE_CLIENT_ID`~~ | La web ya no la usa desde la 009: quítala si existe |
| GitHub (repo) | `PROD_API_URL` | **Variable** de repositorio (no secreto): `https://api.<dominio>`. Activa el ping de `.github/workflows/ping-supabase.yml` |

Las variables de producción de Vercel no deben aplicarse a las previsualizaciones de ramas.

### Orden de despliegue
De la base de datos hacia fuera; cada capa se comprueba antes de pasar a la siguiente. Los pasos 1 a 7 los hace el humano con sus credenciales.

1. **Decisiones previas:** dominio y quién gestiona su DNS; región (recomendada: Supabase `us-east-1` y Render Virginia, la misma zona). La región no se cambia después.
2. **Supabase:** crear `student-os-prod`; anotar `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL` y la clave pública; aplicar **una sola vez y en este orden** `20261113000000_wave2_sync`, `20261113010000_wave3_google` y después `prisma/rls-baseline.sql`. Comprobar que todas las tablas tienen RLS activa.
3. **Google Cloud:** cliente OAuth de producción con la redirección `https://<ref>.supabase.co/auth/v1/callback` y el dominio como origen.
4. **Supabase Auth:** proveedor Google con el mismo client id y secret; `Site URL` = dominio; redirecciones permitidas: dominio y `www`.
5. **Render (API):** servicio desde `render.yaml` (`autoDeploy: false`), variables de la tabla, despliegue manual, comprobar `GET /health` y `GET /health/ready`; dominio `api.<dominio>`.
6. **Vercel (web):** `Root Directory = apps/web`, variables de la tabla, dominio y registros DNS.
7. **Ping:** crear `PROD_API_URL` en GitHub y lanzar a mano el workflow «Ping Supabase (producción)»; debe terminar en verde.
8. **Verificación:** `node scripts/verificar-produccion.mjs --api https://api.<dominio> --web https://<dominio>` (o con `API_URL` y `WEB_URL`). Es de solo lectura y no necesita credenciales: comprueba `/health` y `/health/ready` (200), `/profile` sin token (401), que CORS no autoriza un origen ajeno y que la web responde 200; sale con un código distinto de 0 si algo falla. Después, la prueba manual con las cuentas reales.

### Salud
- `GET /health`: proceso vivo (tiempo activo y versión). No toca la base; lo usa el health check de Render.
- `GET /health/ready`: además ejecuta `SELECT 1` por Prisma (máx. 5 s). 200 `{ status: 'ok', db: 'ok' }` o 503 `{ status: 'error', db: 'error' }`, sin detalles del error. Lo llama el ping cada 3 días para que Supabase (plan gratuito) no pause el proyecto tras 7 días sin actividad.

## Estructura de carpetas en `apps/api/`
```
src/
  main.ts, app.module.ts
  auth/       guard JWT de Supabase, @CurrentUser, @Public
  sync/       endpoints /sync/pull y /sync/push, lógica LWW pura (sync-logic.ts), repositorios
  profile/  kanban/  university/  gym/  calendar/   módulos por dominio
  google/     OAuth PKCE, refresh token cifrado AES-256-GCM, proxy a Calendar v3
  public/     exportar/borrar cuenta, páginas legales
  common/     filtro de excepciones, serializadores de log, security/ (headers, throttler, PII)
  config/     env.schema.ts (zod)
  health/  prisma/
prisma/
  schema/     base, sync, profile, google, kanban, university, gym, calendar (.prisma)
  migrations/ SQL versionado  ·  rls-baseline.sql
test/         *.e2e-spec.ts, helpers/, e2e-harness/ (Supabase y Google simulados)
```

## Skills de terceros instaladas
| Skill | Para qué | Fuente |
|-------|----------|--------|
| *(ninguna)* | Decisión del humano (2026-11-23): se pospone NestJS, Supabase/Postgres y Prisma. Se aplican `docs/rules/backend.md` y `security.md` | — |
