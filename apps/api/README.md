# @student-os/api

API NestJS de StudentOS. Autentica con **Supabase Auth** (JWT verificado por JWKS), persiste con **Prisma + Postgres (Supabase)** y se despliega en **Render** (plan free).

- Sin prefijo `/api`: las rutas son `/health`, `/auth/me`, `/sync/...`, etc.
- Toda ruta es **protegida por defecto** (guard global). Usa `@Public()` para excluir una.
- Plan maestro: [`PLAN_BACKEND.md`](../../PLAN_BACKEND.md). Notas de diseno: [`docs/agent-notes/API-CORE.md`](../../docs/agent-notes/API-CORE.md).

## Estructura

```
apps/api
├─ prisma/
│  ├─ schema/            # Prisma multi-archivo (prismaSchemaFolder, GA desde 6.7)
│  │  ├─ base.prisma     # generator + datasource + modelo Profile (solo API-CORE)
│  │  └─ {sync,profile,kanban,university,gym,calendar,google}.prisma   # uno por agente
│  └─ rls-baseline.sql   # RLS por defecto (ver seccion RLS)
├─ src/
│  ├─ app.module.ts      # FINAL: ya registra todos los modulos. No editar.
│  ├─ app.setup.ts       # helmet, CORS, trust proxy, shutdown hooks (compartido con los e2e)
│  ├─ main.ts
│  ├─ auth/              # guard Supabase JWT, @Public(), @CurrentUser(), GET /auth/me
│  ├─ config/            # validacion de entorno con zod
│  ├─ common/            # filtro global de errores
│  ├─ prisma/            # PrismaService + PrismaModule (global)
│  ├─ health/            # GET /health
│  └─ {sync,profile,kanban,university,gym,calendar,google,public}/   # stubs a rellenar
├─ test/                 # e2e (supertest) y helpers (servidor JWKS local)
└─ render.yaml
```

## Variables de entorno

Copia `.env.example` a `.env` (no se versiona). El arranque falla con un mensaje claro (sin imprimir valores) si algo es invalido.

| Variable | Obligatoria | Descripcion |
| :--- | :--- | :--- |
| `NODE_ENV` | no (`development`) | `development` \| `test` \| `production` |
| `PORT` | no (`3000`) | Render la inyecta sola |
| `DATABASE_URL` | si | Pooler de Supabase (puerto 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | si | Conexion directa (puerto 5432), para migraciones y `db push` |
| `SUPABASE_URL` | si | `https://<ref>.supabase.co` (el emisor esperado es `<SUPABASE_URL>/auth/v1`) |
| `SUPABASE_JWT_AUDIENCE` | no (`authenticated`) | `aud` esperado |
| `WEB_ORIGINS` | en produccion | Origenes CORS separados por comas, sin ruta ni `/` final |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_TOKEN_ENC_KEY` | no (Ola 3) | Agente GOOGLE. La clave de cifrado: `openssl rand -base64 32` |

### `DATABASE_URL` vs `DIRECT_URL`

Supabase ofrece dos formas de conectar (panel del proyecto > **Connect**):

| | Variable | Puerto | Uso |
| :--- | :--- | :--- | :--- |
| Pooler (Supavisor, transaction mode) | `DATABASE_URL` | **6543** | La app en ejecucion. Debe terminar en `?pgbouncer=true` (desactiva prepared statements, que el pooler no soporta). |
| Conexion directa (o pooler session mode) | `DIRECT_URL` | **5432** | Migraciones, `prisma db push`, `prisma studio`. Prisma la usa como `directUrl`. |

```
DATABASE_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Si la contrasena tiene caracteres especiales, codificala en URL (`@` -> `%40`, etc.). El host directo `db.<ref>.supabase.co` es solo IPv6 en el plan gratis de Supabase y puede no ser alcanzable desde Render o desde tu red: prefiere los hosts del pooler (`*.pooler.supabase.com`, compatibles con IPv4) tambien para `DIRECT_URL` (puerto 5432, session mode).

### Requisito en Supabase: claves de firma asimetricas

El guard verifica los tokens con el JWKS publico (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) y **solo acepta ES256/RS256/EdDSA**. Los proyectos nuevos de Supabase ya firman con clave asimetrica. Si un proyecto antiguo sigue con el "legacy JWT secret" (HS256), el JWKS vendra vacio y todos los tokens daran 401: migra a *JWT Signing Keys* en el panel (Authentication > JWT Signing Keys).

## Correr en local

```powershell
cd apps/api
npm install --workspaces=false     # hasta que exista el workspace raiz; despues: npm install en la raiz
Copy-Item .env.example .env        # y rellena las variables
npm run start:dev                  # watch mode
# GET http://localhost:3000/health
```

Scripts: `build`, `start` (usa `dist/`), `start:dev`, `lint` (oxlint), `typecheck`, `test` (unitarios + e2e), `test:e2e`, `prisma:validate`, `prisma:generate`.

`prisma validate` y `prisma generate` funcionan sin base de datos viva; con URLs dummy basta:

```powershell
$env:DATABASE_URL="postgresql://u:p@localhost:6543/db?pgbouncer=true"; $env:DIRECT_URL="postgresql://u:p@localhost:5432/db"
npm run prisma:validate; npm run prisma:generate
```

Tras clonar o cambiar cualquier `.prisma`, ejecuta `npm run prisma:generate` para actualizar el cliente tipado.

## Como rellenar un modulo (Ola 2 y 3)

1. Edita **solo** tu carpeta `src/<modulo>/` y tu `prisma/schema/<modulo>.prisma`. **No toques** `app.module.ts`, `base.prisma` ni los `.prisma` de otros.
2. Usa el usuario autenticado con el decorador, y filtra SIEMPRE por el:

   ```ts
   @Get()
   list(@CurrentUser('id') userId: string) {
     return this.prisma.miModelo.findMany({ where: { userId } });
   }
   ```

   `import { CurrentUser, Public } from '../auth'`. `PrismaService` es global (inyectalo sin importar modulo).
3. Modelos: columna plana `userId String @db.Uuid` + `@@index([userId, ...])`, tablas con `@@map("snake_case")`. **No** declares `@relation` hacia `Profile` (obligaria a editar `base.prisma`); la limpieza al borrar cuenta se hace en codigo (agente PUBLIC) o con FK en la migracion del Integrador.
4. Validacion de entrada con `zod` (esquemas de `@student-os/shared` cuando exista). El cuerpo JSON esta limitado a 1 MB.
5. Rate limit global: 120 peticiones/min por IP. Afina por ruta con `@Throttle({ default: { limit, ttl } })` de `@nestjs/throttler`.
6. Variables nuevas: usa `ConfigService.get('X')` (cae a `process.env`) y listalas en tu `docs/agent-notes/<AGENTE>.md`; el Integrador las incorpora a `src/config/env.schema.ts` y `.env.example`.

## Probar con un schema privado (agentes de Ola 3)

Nunca compartas el schema `public` de `student-os-dev` entre agentes en paralelo. Cada agente trabaja en su propio schema Postgres:

```powershell
# .env (solo local)
DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=dev_gym"
DIRECT_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?schema=dev_gym"

npx prisma db push          # crea el schema dev_gym (si no existe) y las tablas; NO crea migraciones
npm run start:dev
```

- Usa `dev_<agente>` (`dev_gym`, `dev_calendar`, ...). Es el que reemplaza al `public` solo para tu cliente.
- `db push` es solo para desarrollo. **Nunca** lo apuntes a `student-os-prod` ni al schema `public` de dev.
- Limpieza: `DROP SCHEMA dev_gym CASCADE;` (SQL Editor de Supabase).
- Los tests **no** necesitan base de datos: mockea `PrismaService` (ver `test/app.e2e-spec.ts`).

## Migraciones: solo el Integrador

**Los agentes NO ejecutan `prisma migrate` ni commitean `prisma/migrations/`.** El Integrador genera **una migracion consolidada por ola** tras fusionar las ramas:

```powershell
npx prisma migrate dev --name wave-<n>      # contra student-os-dev
npx prisma migrate deploy                   # contra student-os-prod, en la salida a produccion
```

Despues de cada migracion, el Integrador ejecuta `prisma/rls-baseline.sql` (ver abajo).

## RLS (Row Level Security): defensa en profundidad

La API habla con Postgres por conexion directa/pooler con un rol privilegiado (`postgres`, con `BYPASSRLS`), y la autorizacion real esta en el codigo (siempre `where: { userId }`). Pero Supabase expone el esquema `public` a la **Data API** (PostgREST) con los roles `anon` y `authenticated`: una anon key filtrada daria acceso a las tablas si no hubiera RLS.

Politica de la app: **RLS activada y sin politicas para `anon`/`authenticated` = denegar todo**. El cliente web nunca lee tablas directamente; todo pasa por la API.

- [`prisma/rls-baseline.sql`](prisma/rls-baseline.sql) activa (y fuerza) RLS en todas las tablas del schema, revoca privilegios a `anon`/`authenticated` y fija los privilegios por defecto de tablas futuras. Es idempotente.
- Se ejecuta **despues de cada migracion** (Integrador): SQL Editor, `psql "$DIRECT_URL" -f prisma/rls-baseline.sql` o `apply_migration`.
- Verificacion (debe dar 0 filas): `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' AND NOT rowsecurity;`
- El archivo incluye el patron de politicas por propietario por si algun dia se lee una tabla desde el cliente (no es el plan).

## Tests

```powershell
npm test          # unitarios (src/**/*.spec.ts) + e2e (test/**/*.e2e-spec.ts)
npm run test:e2e  # solo e2e
```

- **Guard**: token valido, expirado, `aud` incorrecto, `iss` incorrecto/ausente, firmado por otra clave, `kid` desconocido, algoritmo HS256, cabeceras mal formadas y rutas `@Public()`. Un servidor HTTP local (`test/helpers/jwks-server.ts`) sirve un JWKS generado con `jose`, asi se prueba `createRemoteJWKSet` real sin red externa.
- **e2e** (supertest): `/health`, helmet, CORS, `401`, filtro de errores (no filtra secretos/stack), rate limit (`429`).
- **Entorno**: `src/config/env.schema.spec.ts`.
- Ninguna prueba toca una base de datos; Prisma se sustituye por un doble.

## Despliegue en Render

[`render.yaml`](render.yaml) describe el web service (rootDir `apps/api`, build, start, `healthCheckPath: /health`, plan free). Render solo lee el Blueprint desde la raiz del repo: el Integrador lo mueve alli (o crea el servicio a mano con los mismos valores) y pega los secretos (`sync: false`) en el panel. Render free duerme tras 15 min sin trafico: el primer request tarda ~30-60 s (cold start); el cliente web debe tolerarlo.
