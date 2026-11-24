# Tareas

> El agente lee esto al empezar cada sesión y lo actualiza al terminar.
> Las funcionalidades grandes viven en `docs/features.json`; aquí van las tareas concretas.

## En curso
- [ ] Adopción del harness: Fase 7 (cierre) de `docs/PLAN_ADOPCION_HARNESS.md` · `chore/adopt-agent-harness` · agente + humano

## Pendiente (en orden de prioridad, decidido por el humano el 2026-11-23)

### 1. Producción (funcionalidad 007; acciones del humano, necesitan credenciales)
- [ ] Migrar la base a `student-os-prod` y aplicar `apps/api/prisma/migrations/` a mano, y luego `prisma/rls-baseline.sql`
- [ ] Variables de producción en Vercel (`VITE_*`) y Render (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS`, `GOOGLE_*`)
- [ ] Desplegar la API en Render y verificar `/health`
- [ ] Ping programado contra la pausa de Supabase a los 7 días
- [ ] Escribir la spec en `docs/specs/007-produccion-student-os-prod/spec.md` (con `spec-plan-code`)

### 2. Verificación de la app en Google (funcionalidad 008)
- [ ] Completar `docs/google-verification-checklist.md` en Google Cloud Console (lo hace el humano)
- [ ] Escribir la spec en `docs/specs/008-verificacion-app-google/spec.md`

### 3. BUG-01
- [ ] Al cerrar sesión con la nube activa, `App.tsx` (efecto ~línea 202) re-adopta la sesión de Supabase mientras `signOut()` sigue en vuelo y el usuario no vuelve a la landing. Lo cubre `apps/web/e2e/02-login.spec.ts` (2c) con `test.fail`; al arreglarlo, quita esa marca y marca `pasa: true` en el criterio C4 de la funcionalidad 002.
- [ ] `docs/qa/BUGS.md` está citado en ese test pero **no existe**: recrearlo o quitar la referencia.

### 4. `localStorage` directo
- [ ] `AuthModal`, `BackupModal`, `DailyHabitsCard` y `GymTracker` leen o escriben `localStorage` directamente en vez de usar `AppState`/el sync: en modo nube ese estado no se sincroniza. Revisar cuál es intencional.

### 5. Deuda técnica
- [ ] Los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son controladores vacíos de 6 líneas (el dato viaja por `/sync`). Decidir: eliminarlos o rellenarlos.
- [ ] Bundle web de ~1 MB (aviso de Vite sobre chunks > 500 kB): evaluar `import()` dinámico.
- [ ] 4 avisos de oxlint en `apps/web` (`LearningView.tsx` ×3, `App.tsx:205`).
- [ ] `./scripts/check.sh` (E2E) reescribe los JPG versionados de `docs/qa/evidence/` y ensucia el árbol de git. Dirigir la salida a una carpeta ignorada o dejar de versionar esas imágenes.
- [ ] Versiones de Node dispares: `engines >=20`, CI en 20, Render en 22, Vercel en 26.x. Unificarlas.
- [ ] TypeScript distinto entre paquetes: web `~7.0.2`, api `^5.9`.
- [ ] `pre-commit` tarda ~50 s (decidido mantenerlo; revisar si molesta).
- [ ] El CI no ejecuta la E2E (solo build, lint y tests unitarios de los tres paquetes): valorar un job de E2E.
- [ ] Ramas remotas ya fusionadas que se pueden borrar: `feat/agent-1-university-kanban`, `feat/agent-2-gym-calendar-dashboard`, `feat/student-os-core-hub`, `feat/ui-taste-foundation`, `integration/backend`. `feat/overview-summary` se fusionó con squash en el PR #5: confirmar y borrar.
- [ ] Archivos de instrucciones antiguas en la raíz (`AGENT_WT1_INSTRUCTIONS.md` … `AGENT_WT4_*`, `AGENT_WT1_AUDIT_*`, `AGENT_WT2_AUDIT_*`): archivarlos en `docs/references/historial/` o borrarlos.
- [ ] Comentarios de código que citan `memories.md` y `PLAN_BACKEND.md` (`apps/web/src/sync/adapters/calendar.ts`, `index.ts`, `packages/shared/test/appState.test.ts`): actualizar la ruta o dejar.
- [ ] `PRODUCT.md` (línea 47) aún dice que la memoria está en `memories.md`.
- [ ] Revisar las convenciones «(observado)» de `docs/rules/backend.md` y `frontend.md`, y el glosario de `PROJECT.md` (deducido, no confirmado).

### Adopción del harness
- [ ] Crear el enlace simbólico `.claude/skills → ../.agents/skills` (requiere activar el Modo desarrollador de Windows). Hoy `.claude/skills` es una copia sin versionar que hay que resincronizar a mano tras tocar una skill.
- [ ] Fase 7: ADR 0002, borrar `docs/PLAN_ADOPCION_HARNESS.md` o archivarlo, `check.sh` completo, `revisor` y PR

## Bloqueado
- [ ] Enlace simbólico de skills · Windows exige Modo desarrollador o administrador · que el humano lo active

## Hecho
- 2026-11-23 · Fase 6: `features.json` poblado (001–008), `memories.md` y los planes archivados en `docs/references/historial/`, carpetas de spec para 007 y 008, prioridades fijadas
- 2026-11-23 · Fase 5: las 7 skills de terceros asignadas (`ui-ux-pro-max`, `frontend-design`, `design-taste-frontend` → `frontend-proyecto`; `playwright-best-practices` → `pruebas-proyecto`; `github-workflow-standards`, `grill-me` y `find-skills` en `AGENTS.md`). Sin skills nuevas de NestJS, Supabase ni Prisma, y sin skill propia, por decisión del humano
- 2026-11-23 · Fase 4: reglas (`general`, `security`, `testing`, convenciones observadas) y ADRs 0003–0006
- 2026-11-23 · Fase 3: `AGENTS.md` locales de `apps/web`, `apps/api` y `packages/shared`; mapa de pruebas adaptado; zonas intocables
- 2026-11-23 · Fase 2: `PROJECT.md` (producto público, prototipo, alcance y glosario)
- 2026-11-23 · Fase 1: `stack/*`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh` e `init.sh`; `check.sh` pasa completo
- 2026-11-23 · Fase 0: harness instalado en `chore/adopt-agent-harness`
- 2026-11-23 · PR #6 `integration/backend → main` fusionado; Root Directory de Vercel = `apps/web`; lint del harness E2E corregido
