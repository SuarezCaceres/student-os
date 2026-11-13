# Notas del agente API-CORE (Ola 1)

Rama: `feat/be-api-core` (partio de `integration/backend`). Alcance: `apps/api/**` + este archivo.
Guia de uso: [`apps/api/README.md`](../../apps/api/README.md).

## Que se entrego

Esqueleto NestJS en `apps/api` (`@student-os/api`): config con zod, guard global de Supabase JWT (JWKS), Prisma multi-archivo, 8 modulos stub registrados, `/health`, CORS por lista blanca, helmet, throttling, filtro global de errores, logs pino, `render.yaml`, RLS baseline y tests.

## Decisiones

| Tema | Decision y motivo |
| :--- | :--- |
| Versiones | NestJS 11, TypeScript 5.9, Prisma 6.19 (>= 6.7: `prismaSchemaFolder` es GA, sin `previewFeatures`), Jest 29 + ts-jest, zod 4. En el registro ya hay Nest 12 / TS 7 / Prisma 8 rc / Jest 30; se evito a proposito saltar de major sin necesidad. |
| `jose` 5 (no 6) | jose 6 es ESM-only; el API compila a CommonJS y Jest corre CJS. jose 5.10 trae CJS+ESM. Migrar cuando el API pase a ESM. |
| Algoritmos JWT | Solo ES256/RS256/EdDSA (asimetricos). Se rechazan HS* para evitar confusion de algoritmo. Requiere que el proyecto Supabase use *JWT Signing Keys* (JWKS no vacio). |
| `iss` | `${SUPABASE_URL}/auth/v1` (sin barra final; se normaliza). `aud` = `SUPABASE_JWT_AUDIENCE`. `clockTolerance` 5 s. `sub` y `exp` obligatorios. |
| Orden de guards | `ThrottlerGuard` primero, luego `SupabaseJwtGuard` (ambos `APP_GUARD` en `AppModule`): se limita la fuerza bruta sobre tokens invalidos. |
| Errores | `AllExceptionsFilter` (APP_FILTER): 5xx -> mensaje generico + `requestId`; el detalle va solo al log. Las 4xx devuelven el mensaje de `HttpException`. Formato: `{ statusCode, error, message, requestId }`. |
| Logs | `nestjs-pino`; `authorization`/`cookie`/`set-cookie` redactados; `/health` no se loguea; nivel `silent` en `test`. |
| Prisma | Conexion perezosa (no `$connect()` en el arranque): la API arranca y responde `/health` aunque la BD este caida/dormida. `datasourceUrl` viene de `ConfigService`. |
| Sin relaciones a `Profile` | Una `@relation` obliga a anadir el campo inverso en `Profile` (editar `base.prisma`). Convencion: `userId String @db.Uuid` plano + `@@index`. |
| `/auth/me` | Ruta protegida real y minima (devuelve `{id,email}`) para verificar el token de extremo a extremo y usarla como smoke test del despliegue. No estaba pedida; es inocua. Es el unico controlador de `auth/`. |
| Body | JSON limitado a 1 MB (`app.setup.ts`). SYNC-API debe avisar si necesita mas. |
| `trust proxy` = 1 | Detras del proxy de Render, para que el rate limit use la IP real. |
| Build | `incremental` desactivado en tsconfig: con `deleteOutDir` de Nest dejaba `dist/` incompleto por un `.tsbuildinfo` obsoleto. |
| Jest | `testRegex` en lugar de `testMatch`: los globs de micromatch ignoran rutas con carpetas ocultas (`.claude/worktrees/...`) y no encontraba tests dentro del worktree. |
| Lint | oxlint (config en `.oxlintrc.json`); rapido y sin dependencias de plugins. |

## Variables de entorno

Todas en `apps/api/.env.example`. Obligatorias: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`. Con defecto: `NODE_ENV` (`development`), `PORT` (3000), `SUPABASE_JWT_AUDIENCE` (`authenticated`). `WEB_ORIGINS` obligatoria solo en produccion (defecto dev: `http://localhost:5173`). Opcionales: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` (>= 32 caracteres si se define). No se anadio ninguna variable fuera de la lista pedida.

El Integrador debe consolidar estas variables en el `.env.example` de la raiz si lo decide (el de `apps/api` es la fuente).

## Que stub corresponde a quien

| Carpeta (`apps/api/src/`) | Archivo Prisma (`prisma/schema/`) | Agente | Ola |
| :--- | :--- | :--- | :--- |
| `sync/` | `sync.prisma` | SYNC-API | 2 |
| `profile/` | `profile.prisma` | SYNC-API | 2 |
| `kanban/`, `university/` | `kanban.prisma`, `university.prisma` | KANBAN-UNI | 3 |
| `gym/` | `gym.prisma` | GYM | 3 |
| `calendar/` | `calendar.prisma` | CALENDAR | 3 |
| `google/` | `google.prisma` | GOOGLE | 3 |
| `public/` (+ `common/security/` nuevo) | (sin archivo propio; usa los demas) | PUBLIC | 3 |

Los controladores de los stubs estan vacios con prefijo `/<modulo>` (`public/` usa `/public`; PUBLIC puede cambiar el prefijo en su propio controlador). `PUBLIC` no tiene `.prisma` propio en el plan; si necesita una tabla (p. ej. cuotas), debe pedirla al Integrador.

## Riesgos y deuda

1. **`package.json#prisma` esta deprecado** (se elimina en Prisma 7). Se uso porque `prisma.config.ts` desactiva la carga automatica de `.env`. Migrar al subir a Prisma 7.
2. **Render y el monorepo:** `render.yaml` esta en `apps/api/`; Render lo lee solo desde la raiz del repo (mover/copiar). El `buildCommand` actual es para `apps/api` aislado; cuando existan los workspaces y `@student-os/shared`, usar el comando alternativo comentado en el YAML (build de shared antes).
3. **`package-lock.json` no se commitea** (regla de la ola). `apps/api/.gitignore` lo ignora; el Integrador regenera el lock raiz. `@student-os/shared` NO esta declarado como dependencia (aun no se importa); el primer agente que lo importe lo anade a `apps/api/package.json`.
4. **`@types/express` 5 y `zod` 4:** si CONTRACT eligio `zod` 3 en `packages/shared`, `npm` instalara dos majors (funciona, pero conviene unificar). Alinear al integrar.
5. **Sin migraciones ni `prisma/migrations`** (por regla). `rls-baseline.sql` debe ejecutarse tras cada migracion (Integrador); RLS no esta "activa" hasta entonces porque aun no hay tablas aparte de `profiles`.
6. **Rate limit en memoria** (por instancia). Suficiente con una sola instancia de Render free; PUBLIC puede cambiar el *storage*/tracker por usuario.
7. **Cold start de Render:** el primer request puede tardar 30-60 s; no es un fallo.
8. **Cache de JWKS:** en el primer request tras el arranque se descarga el JWKS (latencia unica). Una rotacion de claves se absorbe sola (cooldown 30 s).
9. `PrismaService` no se conecta al arrancar, por lo que `/health` no valida la BD. Si se quiere un `/health/ready` con `SELECT 1`, anadirlo en una fase posterior.
10. No se probo nada contra Supabase real ni Render (no hay credenciales ni BD en este worktree): la verificacion usa un JWKS local y Prisma mockeado.
