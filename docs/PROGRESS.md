# Progreso

> Bitácora entre sesiones. Cada sesión **añade** una entrada al principio (la más reciente arriba).
> Su objetivo es que la siguiente sesión, que no recuerda nada, sepa dónde retomar.

<!-- Formato:
## AAAA-MM-DD · agente (Claude Code / Antigravity) · rama
- **Hecho:** qué se completó (con referencia a commits o PR)
- **Verificación:** resultado de ./scripts/check.sh
- **Pendiente:** qué queda y el siguiente paso concreto
- **Problemas:** errores, dudas o decisiones que necesitan al humano
-->

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 6)
- **Hecho:** `docs/features.json` con 8 funcionalidades (001–006 existentes con `pasa: true` solo donde una prueba que pasa lo respalda; 007 producción y 008 verificación de Google pendientes). `memories.md`, `PLAN.md` y `PLAN_BACKEND.md` archivados con `git mv` en `docs/references/historial/` (`memories.md` con aviso de archivado). Carpetas de spec para 007 y 008. `TASKS.md` reordenado por tu prioridad: producción, verificación de Google, BUG-01, `localStorage` directo, deuda.
- **Pendiente:** Fase 7 (ADR 0002, `check.sh` completo, skill `revisor`, PR). Las specs de 007 y 008 se escriben con `spec-plan-code`.
- **Problemas:** `PRODUCT.md` y varios comentarios de código siguen citando `memories.md`; quedó en `TASKS.md`. El estado `en_curso` de la funcionalidad 002 depende del BUG-01.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 5)
- **Hecho:** skills conectadas: `frontend-proyecto` (`ui-ux-pro-max`, `frontend-design`, `design-taste-frontend` solo para landing), `pruebas-proyecto` (`playwright-best-practices`, con la nota del stack simulado), `backend-proyecto` (ninguna, decisión del humano). `AGENTS.md` lista `github-workflow-standards`, `grill-me` y `find-skills`. La skill de flujo de GitHub lleva una nota: commits en español.
- **Pendiente:** Fase 6 (`features.json`, `TASKS.md`, qué hacer con `memories.md`) y Fase 7 (cierre, ADR 0002, PR).
- **Problemas:** `design-taste-frontend` es para sitios de marketing; si se usa en la app interna puede chocar con la identidad de `PRODUCT.md`.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 4)
- **Hecho:** reglas: `general.md` (commits en español, PR por la skill), `security.md` (exportar/borrar cuenta, RLS, tokens de Google, límites por usuario, logs sin PII), `testing.md` (`test.fail` solo con bug en TASKS; lección sobre verificar el código de salida), convenciones «(observado)» en `backend.md` y `frontend.md`; ADRs 0003 a 0006.
- **Pendiente:** que confirmes las convenciones observadas y los ADRs. Fase 5 (skills), Fase 6 (backlog), Fase 7 (cierre y PR).
- **Problemas:** la skill `github-workflow-standards` y `memories.md` aún dicen «commits en inglés»; la regla de `general.md` manda sobre ellas. En modo nube, 4 componentes guardan en `localStorage` sin pasar por el sync.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fases 2 y 3)
- **Hecho:** Fase 2 (`PROJECT.md`: producto público, prototipo, alcance, zonas protegidas, glosario) y Fase 3 (despliegue y mapa de pruebas confirmados; `apps/web`, `apps/api` y `packages/shared` con su `AGENTS.md`; `rules/testing.md` adaptado a `apps/api/test` y `apps/web/e2e`).
- **Pendiente:** Fase 4 (reglas: unificar commits/PR de `memories.md` con `rules/general.md`, seguridad y ADRs), Fase 5 (skills), Fase 6 (backlog), Fase 7 (cierre y PR).
- **Problemas:** el glosario de `PROJECT.md` está deducido, falta tu revisión.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fases 0 y 1)
- **Hecho:** Fase 0 (decisiones de instalación) y Fase 1 (exploración y borrador técnico): `docs/stack/*`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh` e `init.sh`. Antes, PR #6 fusionado en `main` y Vercel corregido (Root Directory `apps/web`).
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, 361+288+35 unitarias, integración del API y 14 E2E; 164 s).
- **Pendiente:** Fase 2 (producto → `PROJECT.md`) y Fase 3 (confirmar arquitectura y stack con el humano). Enlace simbólico de skills a la espera del Modo desarrollador.
- **Problemas:** BUG-01 (logout), la E2E ensucia `docs/qa/evidence`, módulos vacíos en el API. Todo en `docs/TASKS.md`.

## Inicio
- **Hecho:** plantilla de harness creada.
- **Pendiente:** ejecutar `./init.sh` y la skill `init-stack`.
