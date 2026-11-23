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
| *(ninguna todavía)* | Se decide en la Fase 5 (candidatas: NestJS, Supabase/Postgres) | — |
