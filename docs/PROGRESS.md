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

## 2026-11-23 · Claude Code · chore/adopt-agent-harness
- **Hecho:** Fase 0 (decisiones de instalación) y Fase 1 (exploración y borrador técnico): `docs/stack/*`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh` e `init.sh`. Antes, PR #6 fusionado en `main` y Vercel corregido (Root Directory `apps/web`).
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, 361+288+35 unitarias, integración del API y 14 E2E; 164 s).
- **Pendiente:** Fase 2 (producto → `PROJECT.md`) y Fase 3 (confirmar arquitectura y stack con el humano). Enlace simbólico de skills a la espera del Modo desarrollador.
- **Problemas:** BUG-01 (logout), la E2E ensucia `docs/qa/evidence`, módulos vacíos en el API. Todo en `docs/TASKS.md`.

## Inicio
- **Hecho:** plantilla de harness creada.
- **Pendiente:** ejecutar `./init.sh` y la skill `init-stack`.
