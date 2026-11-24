# AGENTS.md

> Índice del proyecto para agentes de IA (Claude Code, Antigravity CLI y cualquier herramienta que lea AGENTS.md).
> Se carga en **cada** sesión, así que debe ser corto (menos de 120 líneas). El detalle vive en `docs/`.
> No crees `CLAUDE.md` ni `GEMINI.md`: si existen, algunas herramientas ignoran este archivo.

## Qué es este proyecto
StudentOS: hub web para estudiantes universitarios (Kanban, entregas por semanas, gym, horario, hábitos y Google Calendar). Objetivo: producto público; estado: **prototipo**. Funciona sin cuenta en local y sincroniza entre dispositivos al iniciar sesión.
**Zonas protegidas (pregunta antes de tocar):** borrado/exportación de cuenta y el importador del primer inicio.

Más detalle: `docs/project/PROJECT.md` · Arquitectura: `docs/project/ARCHITECTURE.md`

## Estructura del repo
Monorepo npm workspaces.
```
apps/web/         frontend React + Vite (@student-os/web)
apps/api/         backend NestJS + Prisma (@student-os/api)
packages/shared/  esquemas zod y tipos compartidos (@student-os/shared)
apps/api/test/    integración del API y harness E2E (Supabase/Google simulados)
apps/web/e2e/     pruebas E2E Playwright (las unitarias van junto al código)
docs/             contexto, reglas, specs, decisiones y progreso
.agents/skills/   skills del proyecto (Claude Code las ve vía .claude/skills)
scripts/          verificación y utilidades
```

## Al empezar cada sesión
1. Lee las últimas entradas de `docs/PROGRESS.md` y el estado de `docs/TASKS.md`.
2. Ejecuta `git status` y `git log --oneline -10`.
3. Si el entorno no está levantado, ejecuta `./init.sh`.
4. Trabaja en **una** tarea a la vez. Si no hay una clara, pregunta.

## Mapa de contexto: lee solo lo que necesites
| Si vas a…                          | Lee primero                                                   |
|------------------------------------|---------------------------------------------------------------|
| Entender el producto               | `docs/project/PROJECT.md`                                     |
| Entender cómo encaja todo          | `docs/project/ARCHITECTURE.md`                                |
| Tocar el frontend                  | `docs/stack/frontend.md`, `docs/rules/frontend.md`            |
| Tocar el backend                   | `docs/stack/backend.md`, `docs/rules/backend.md`              |
| Cambiar el contrato web↔api        | `packages/shared/AGENTS.md`                                   |
| Escribir o ejecutar pruebas        | `docs/rules/testing.md`                                       |
| Manejar datos sensibles, auth o API| `docs/rules/security.md`                                      |
| Hacer commits, ramas o PRs         | `docs/rules/general.md`                                       |
| Crear una funcionalidad nueva      | skill `spec-plan-code`                                        |
| Saber por qué se decidió algo      | `docs/decisions/`                                             |
| Consultar guías y ejemplos         | `docs/references/<frontend\|backend\|testing>/`               |

## Skills del proyecto (`.agents/skills/`)
| Skill              | Cuándo                                                        |
|--------------------|---------------------------------------------------------------|
| `init-stack`       | Proyecto nuevo: definir el stack y rellenar comandos y docs    |
| `adoptar-proyecto` | Proyecto existente: analizarlo y rellenar el harness           |
| `spec-plan-code`   | Cualquier funcionalidad nueva                                 |
| `frontend-proyecto`| Trabajo en `apps/web/`                                        |
| `backend-proyecto` | Trabajo en `apps/api/`                                        |
| `pruebas-proyecto` | Escribir, ejecutar o revisar pruebas                          |
| `revisor`          | Antes de abrir un PR: evaluar el trabajo contra la spec       |
| `github-workflow-standards` | Formato de PR (5 secciones) y tipos de commit; el idioma lo fija `docs/rules/general.md` |
| `grill-me`         | Cuando pidas que te interrogue para afinar un plan o diseño   |
| `find-skills`      | Para descubrir skills nuevas (pide permiso antes de instalar)  |

Las de diseño y E2E (`ui-ux-pro-max`, `frontend-design`, `design-taste-frontend`, `playwright-best-practices`) se llaman desde `frontend-proyecto` y `pruebas-proyecto`.

## Comandos
Siempre desde la raíz. Detalle por área en `docs/stack/`.
| Acción                      | Comando                     |
|-----------------------------|-----------------------------|
| Preparar el entorno         | `./init.sh`                 |
| Verificación completa       | `./scripts/check.sh`        |
| Verificación rápida (sin E2E)| `./scripts/check.sh --rapido` |
| Frontend en desarrollo      | `npm run dev:web`           |
| Backend en desarrollo       | `npm run dev:api`           |
| Build de todo               | `npm run build`             |
| E2E (Playwright, ~2 min)    | `npm run test:e2e -w @student-os/web` |

## Flujo de trabajo: spec → plan → código
Toda funcionalidad nueva sigue la skill `spec-plan-code`:
1. Spec en `docs/specs/NNN-nombre/spec.md`. **Espera la aprobación humana.**
2. Plan en `docs/specs/NNN-nombre/plan.md`. **Espera la aprobación humana.**
3. Implementa en la rama `feat/NNN-nombre`, con pruebas.
4. Revisa con la skill `revisor`.
5. Haz commit, abre el PR y actualiza `docs/features.json`, `docs/TASKS.md` y `docs/PROGRESS.md`.

Los cambios pequeños (un bugfix o una errata) pueden saltarse la spec y el plan, pero **no** las pruebas.

## Definición de terminado
- `./scripts/check.sh` pasa (lint, tipos y pruebas).
- Cada criterio de aceptación de la spec tiene al menos una prueba que pasa.
- `docs/features.json`, `docs/TASKS.md` y `docs/PROGRESS.md` están actualizados.
- Nunca declares algo terminado sin haber ejecutado la verificación. Si no pudiste ejecutarla, dilo explícitamente.

## Autonomía
- **Sin preguntar:** leer, editar, ejecutar pruebas, crear ramas, hacer commits en ramas y abrir PRs.
- **Pregunta antes de:** añadir o quitar dependencias, crear migraciones de BD, modificar `docs/rules/`, borrar archivos que no creaste tú, tocar el borrado/exportación de cuenta o el importador del primer inicio, cambiar `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` o el cifrado del token (rotar la clave deja ilegibles los tokens guardados) y cualquier cosa que toque producción.
- **Nunca:** push o merge a `main`, leer o commitear `.env` o secretos, borrar o desactivar pruebas para que pasen, usar `--no-verify`.

## Reglas de oro
- Las reglas de `docs/rules/` mandan sobre cualquier skill de terceros.
- Si algo no está documentado, pregunta o propón un ADR en `docs/decisions/`. No inventes convenciones.
- **Ciclo de aprendizaje:** cuando el humano te corrija un error, propón añadir la lección en la sección «Lecciones aprendidas» del archivo de `docs/rules/` que corresponda.
- El estilo de código lo imponen el linter y el formateador, no este archivo.

## Al terminar la sesión
1. Añade una entrada a `docs/PROGRESS.md` (qué hiciste, qué falta, problemas).
2. Actualiza `docs/TASKS.md` y `docs/features.json`.
3. Deja el repo limpio: todo commiteado en tu rama.
