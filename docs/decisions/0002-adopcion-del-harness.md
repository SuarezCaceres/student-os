# ADR 0002 · Adopción del harness de agentes en StudentOS

- **Fecha:** 2026-11-23
- **Estado:** aceptada

## Contexto
StudentOS ya tenía código, tests y CI (monorepo `apps/web`, `apps/api`, `packages/shared`, con el PR #6 recién fusionado en `main`) pero su contexto para agentes vivía en `memories.md` (356 líneas, de lectura obligatoria antes de cada commit), `PLAN.md`, `PLAN_BACKEND.md`, `PRODUCT.md` y notas sueltas en `docs/agent-notes/`. No había `AGENTS.md`, ni sensores unificados (`check.sh`), ni hooks de git, ni memoria entre sesiones. Se instaló `harness-template` con `install.sh` y se adaptó a lo existente siguiendo la skill `adoptar-proyecto`, en 8 fases con aprobación del humano en cada una.

**Estado en que se encontró el proyecto:** `./scripts/check.sh` (lint, tipos, 361 + 288 + 35 pruebas unitarias, integración del API y 14 E2E) pasaba entero. Un único bug conocido (BUG-01) estaba cubierto por un `test.fail`. Producción (`student-os-prod`) y la verificación de la app en Google estaban sin hacer.

## Decisión
- **Se conserva la estructura del proyecto; el harness se adapta a ella.** `apps/api/test/` y `apps/web/e2e/` reemplazan a `tests/integration` y `tests/e2e` en el mapa (`docs/rules/testing.md`).
- **Una fuente de verdad por dato** (ver `AGENTS.md` → «Mapa de contexto»): producto en `PROJECT.md`, arquitectura en `ARCHITECTURE.md`, comandos en `docs/stack/`, reglas en `docs/rules/`, decisiones en `docs/decisions/`, estado en `PROGRESS.md`, `TASKS.md` y `features.json`.
- **`memories.md`, `PLAN.md` y `PLAN_BACKEND.md` se archivan** en `docs/references/historial/` y dejan de actualizarse.
- **Commits en español** (`docs/rules/general.md`); el formato de PR de 5 secciones lo sigue definiendo la skill `github-workflow-standards`.
- **Pre-commit:** `./scripts/check.sh --rapido` (lint, tipos, unitarias e integración, ~50 s). La E2E (~2 min) corre en `check.sh` completo, no en el hook.
- **Zonas protegidas** (preguntar antes de tocar): borrado y exportación de cuenta, importador del primer inicio y las claves de Google (`GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`).
- **Skills:** se asignan las 7 de terceros ya instaladas; no se añaden skills de NestJS, Supabase ni Prisma, ni skill propia (se pospone).
- **Se versionan `.claude/` y `.agents/`**, ignorando solo `.claude/settings.local.json` y `.claude/worktrees/`.
- **Vercel** pasa a Root Directory `apps/web` (hecho antes de la adopción, necesario para que `main` desplegara).

## Alternativas consideradas
- **Mover las pruebas a `tests/`:** descartada; rompería scripts, harness y CI.
- **Mantener `memories.md` vivo junto a `docs/`:** descartada; duplica información y contradice un `AGENTS.md` corto con divulgación progresiva.
- **Hooks más ligeros (solo lint y tipos):** descartada; se prefirió que el commit garantice que pasan las pruebas.

## Consecuencias
- Las convenciones «(observado)» de `rules/backend.md` y `rules/frontend.md` y el glosario de `PROJECT.md` son deducciones del código y siguen pendientes de revisión humana.
- **`.claude/skills` es una copia, no un enlace simbólico** (Windows exige Modo desarrollador). Hay que resincronizarla a mano tras tocar una skill, y está sin versionar, hasta crear el enlace (`docs/TASKS.md`).
- Quedan referencias a `memories.md` en `PRODUCT.md` y en comentarios de código; no bloquean nada.
- La E2E reescribe los JPG de `docs/qa/evidence/`: hay que revertirlos tras correr `check.sh` completo (deuda en `docs/TASKS.md`).
- Próximos pasos priorizados: producción (007), verificación de Google (008), BUG-01, `localStorage` directo y deuda técnica.
