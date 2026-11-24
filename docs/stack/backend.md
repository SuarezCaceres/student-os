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
