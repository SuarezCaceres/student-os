# Tareas

> El agente lee esto al empezar cada sesión y lo actualiza al terminar.
> Las funcionalidades grandes viven en `docs/features.json`; aquí van las tareas concretas.

## En curso
- [ ] Adopción del harness (Fases 2–7 de `docs/PLAN_ADOPCION_HARNESS.md`) · `chore/adopt-agent-harness` · agente + humano

## Pendiente

### Adopción del harness
- [ ] Crear el enlace simbólico `.claude/skills → ../.agents/skills` (requiere activar el Modo desarrollador de Windows). Hoy `.claude/skills` es una copia sin versionar.
- [ ] Borrar la funcionalidad de ejemplo de `docs/features.json` y poblarla (Fase 6)
- [ ] Escribir los ADRs de decisiones no obvias (Fase 4)

### Producción (acciones del humano, necesitan credenciales)
- [ ] Migrar la base a `student-os-prod` y aplicar `apps/api/prisma/migrations/` a mano
- [ ] Variables de producción en Vercel (`VITE_*`) y Render (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS`, `GOOGLE_*`)
- [ ] Ping programado contra la pausa de Supabase a los 7 días
- [ ] Desplegar la API en Render y verificar `/health`
- [ ] Verificación de la app en Google (`docs/google-verification-checklist.md`)

### Bugs
- [ ] **BUG-01:** al cerrar sesión con la nube activa, `App.tsx` (efecto ~línea 202) re-adopta la sesión de Supabase mientras `signOut()` sigue en vuelo y el usuario no vuelve a la landing. Lo cubre `apps/web/e2e/02-login.spec.ts` (2c) con `test.fail`; al arreglarlo hay que quitar esa marca.
- [ ] `docs/qa/BUGS.md` está citado en el test pero **no existe** en el repo: recrearlo o quitar la referencia.

### Deuda técnica
- [ ] `./scripts/check.sh` (E2E) reescribe los JPG versionados de `docs/qa/evidence/`, lo que ensucia el árbol de git. Dirigir la salida a una carpeta ignorada o dejar de versionar esas imágenes.
- [ ] Los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son controladores vacíos de 6 líneas (el dato viaja por `/sync`). Decidir: eliminarlos o rellenarlos.
- [ ] Bundle web de ~1 MB (`index-*.js`, aviso de Vite sobre chunks > 500 kB): evaluar `import()` dinámico.
- [ ] 4 avisos de oxlint en `apps/web` (`LearningView.tsx` ×3, `App.tsx:205`).
- [ ] Versiones de Node dispares: `engines >=20`, CI en 20, Render en 22, Vercel en 26.x. Unificarlas.
- [ ] TypeScript distinto entre paquetes: web `~7.0.2`, api `^5.9`.
- [ ] `pre-commit` tarda ~50 s (lint, tipos, unitarias e integración). Evaluar si es aceptable (Fase 3).
- [ ] Ramas remotas ya fusionadas que se pueden borrar: `feat/agent-1-university-kanban`, `feat/agent-2-gym-calendar-dashboard`, `feat/student-os-core-hub`, `feat/ui-taste-foundation`, `integration/backend`. `feat/overview-summary` se fusionó con squash en el PR #5: confirmar y borrar.
- [ ] `memories.md` (356 líneas) y `PLAN*.md` conviven con `docs/`: decidir cuál es la fuente de verdad (Fase 6).

## Bloqueado
- [ ] Enlace simbólico de skills · Windows exige Modo desarrollador o administrador · que el humano lo active

## Hecho
- 2026-11-23 · Fase 3: `AGENTS.md` locales de `apps/web`, `apps/api` y `packages/shared`; mapa de pruebas adaptado en `rules/testing.md`; zonas intocables en `AGENTS.md` y `PROJECT.md`
- 2026-11-23 · Fase 2: `PROJECT.md` (producto público, prototipo, alcance y glosario)
- 2026-11-23 · PR #6 `integration/backend → main` fusionado; Root Directory de Vercel = `apps/web`; lint del harness E2E corregido
- 2026-11-23 · Harness instalado en `chore/adopt-agent-harness` (Fase 0)
- 2026-11-23 · Fase 1: `stack/*`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh` e `init.sh` rellenados; `check.sh` pasa completo
