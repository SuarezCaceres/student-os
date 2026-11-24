# Plan de adopción del harness

> Rama: `chore/adoptar-harness`. Este plan guía la skill `adoptar-proyecto` con lo que ya sabemos de StudentOS.
> Se borra (o se archiva en `docs/decisions/0002-adopcion-del-harness.md`) al terminar la Fase 7.

## 0. Punto de partida

**Instalado:** `AGENTS.md`, `docs/` (project, stack, rules, specs, decisions, references, `features.json`, `TASKS.md`, `PROGRESS.md`), 7 skills del harness, `scripts/check.sh`, `init.sh`, `.githooks/` (pre-commit y pre-push), `.claude/settings.json` y `.claude/hooks/guard.sh`. `init.sh` ya activó `core.hooksPath=.githooks` y creó `.env`.

**Todo está vacío:** `AGENTS.md` (qué es, comandos), `PROJECT.md`, `ARCHITECTURE.md`, `stack/*`, `check.sh` (sin comandos), `init.sh` (sin pasos), `features.json` (solo un ejemplo), y las orquestadoras no apuntan a ninguna skill de terceros.

**Lo que ya existe en el proyecto y hay que enlazar, no duplicar:**

| Existente | Destino en el harness |
|---|---|
| `memories.md` (356 líneas: contexto, reglas de commits/PR, historial de versiones) | `PROJECT.md`, `ARCHITECTURE.md`, `rules/general.md`; el historial se archiva |
| `PLAN.md`, `PLAN_BACKEND.md`, `PRODUCT.md` | `PROJECT.md`, `ARCHITECTURE.md`, `features.json` |
| `docs/agent-notes/*.md` (10 informes de los agentes de backend) | `references/backend/` y `rules/` (deuda y decisiones) |
| `docs/qa/`, `docs/google-verification-checklist.md` | `references/testing/`, `TASKS.md` |
| 7 skills de terceros en `.agents/skills/` | secciones «Skills de terceros» de las orquestadoras y de `stack/*` |
| `.env.example` | fusionar con `.env.harness.example` |

## 1. Mapa de enlaces: una sola fuente de verdad por dato

Para que todo quede enlazado, cada dato se escribe **una vez** y los demás archivos solo apuntan a él.

| Dato | Se define en | Lo consumen |
|---|---|---|
| Qué es el producto | `docs/project/PROJECT.md` | `AGENTS.md` (2–3 líneas), skill `spec-plan-code` |
| Piezas y comunicación | `docs/project/ARCHITECTURE.md` | `AGENTS.md`, `stack/*`, ADRs |
| Comandos reales | `docs/stack/*.md` | `AGENTS.md` (tabla), `scripts/check.sh`, `init.sh` |
| Mapa de carpetas real | `AGENTS.md` (estructura) | `stack/*`, `apps/*/AGENTS.md`, `rules/testing.md` |
| Convenciones | `docs/rules/*.md` | las 7 skills y el `revisor` |
| Skills de terceros | `stack/*.md` | orquestadoras (`frontend`, `backend`, `pruebas`), tabla de `AGENTS.md` |
| Qué falta hacer | `docs/features.json` | `TASKS.md`, `docs/specs/NNN-*/`, `PROGRESS.md` |
| Por qué se decidió | `docs/decisions/` | `ARCHITECTURE.md`, `rules/` |

**Control de coherencia al cerrar cada fase:** (1) toda ruta citada en `AGENTS.md` existe; (2) los comandos de `stack/*` = `check.sh` = tabla de `AGENTS.md`; (3) toda skill listada existe en `.agents/skills/`; (4) `AGENTS.md` < 120 líneas.

## 2. Fases

Cada fase termina con tu **aprobación explícita** antes de pasar a la siguiente. Pregunto en rondas de 3–4 preguntas, con opciones cuando se pueda.

### Fase 0 · Decisiones de instalación (bloquean todo lo demás)
Qué pregunto:
1. **`.gitignore`:** `.claude/` y `.agents/` están ignorados, así que las skills, `settings.json` y `guard.sh` del harness no se versionan. ¿Los dejo de ignorar, salvo `.claude/settings.local.json` y `.claude/worktrees/`?
2. **Enlace de skills en Windows:** `core.symlinks=false`, así que `.claude/skills` es una copia y se desincronizará de `.agents/skills`. ¿Activo el modo desarrollador y el enlace real, o mantengo la copia con un script de sincronización?
3. **Rama base:** el PR #6 (`integration/backend`) sigue abierto. ¿Abro el PR del harness contra `integration/backend` o espero a que se fusione y lo rebaso sobre `main`?
4. **`.env`:** `init.sh` creó `.env` desde `.env.example`. ¿Fusiono `.env.harness.example` en `.env.example` y lo borro?

Archivos: `.gitignore`, `.claude/skills`, `.env.example`. Salida: instalación versionable y reproducible.

**Resolución (2026-11-23):**
1. `.gitignore`: se dejó de ignorar `.claude/` y `.agents/`; solo se ignoran `.claude/settings.local.json` y `.claude/worktrees/`. ✔
2. Enlace de skills: elegido **enlace simbólico real**. ⏳ Windows no deja crearlo sin Modo desarrollador. Mientras tanto `.claude/skills` es una copia **sin versionar** (idéntica a `.agents/skills`). Al activar el modo: `rm -rf .claude/skills && git config core.symlinks true && ln -s ../.agents/skills .claude/skills`.
3. Rama base: el PR #6 se fusionó en `main` (tras corregir el lint del harness E2E y poner Root Directory `apps/web` en Vercel). El harness vive en `chore/adopt-agent-harness`, creada desde `main`. ✔
4. `.env.example`: se conserva el del proyecto y se eliminó `.env.harness.example` (solo traía 3 variables genéricas comentadas). La regla de `settings.json` impide leer `.env*`, así que los nombres de variables se contrastarán con el código en la Fase 1. ✔

### Fase 1 · Exploración y borrador (sin preguntarte)
Leo el código, `package.json` (raíz, web, api, shared), `.github/`, `render.yaml`, `vercel.json`, Prisma, `git log`, TODO/FIXME, `memories.md` y los planes. Relleno el **borrador** de `stack/frontend.md`, `stack/backend.md`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh`, `init.sh` y `.env.example` (solo nombres de variables, nunca leo `.env`). **Ejecuto `check.sh`** y anoto qué falla.
Te presento «esto es lo que entendí» para que confirmes o corrijas. Salida: borrador técnico verificado.

### Fase 2 · Producto → `PROJECT.md`
Preguntas:
- ¿Para quién es (solo tú, estudiantes en general, producto público)? ¿Qué problema resuelve frente a Notion/Trello?
- Estado: MVP o producción; ¿hay usuarios reales? (condiciona qué es «no tocar»).
- Alcance: ¿qué entra y qué queda fuera por ahora (p. ej. móvil nativo, otras universidades, otros calendarios)?
- Glosario: confirmar términos (Kanban, semanas académicas 1–16, cuenta nube vs modo local, importador, harness del agente).

Enlaza con: `AGENTS.md` («Qué es este proyecto») y la spec de cada funcionalidad.

### Fase 3 · Arquitectura y stack → `ARCHITECTURE.md`, `stack/*`, `check.sh`, `init.sh`
Preguntas (solo lo que el código no dice):
- Despliegue: confirmar Vercel (web) + Render (API) + Supabase y el entorno `student-os-prod`.
- **Carpetas de pruebas:** el harness espera `tests/integration` y `tests/e2e`, pero el proyecto usa `apps/api/test` y `apps/web/e2e`. Propongo **cambiar el mapa, no las carpetas**. ¿De acuerdo?
- Cobertura mínima y qué debe correr en el pre-commit (hoy: unitarias de 3 paquetes) frente a lo que queda para CI (E2E).
- ¿Hay servicios que el agente nunca debe tocar (Supabase prod, claves de Google)?

Archivos: `stack/*.md`, `ARCHITECTURE.md` (web ↔ API ↔ Supabase, motor de sync, contrato en `packages/shared`), `AGENTS.md` (estructura y comandos), `check.sh`, `init.sh`, `apps/web/AGENTS.md`, `apps/api/AGENTS.md`, `packages/` (añadir un `AGENTS.md` local si hace falta).
Salida: `check.sh` corre de verdad y los tres lugares con comandos coinciden.

### Fase 4 · Reglas → `docs/rules/*.md` (+ ADRs)
Esta fase toca `docs/rules/`, que exige tu permiso. Propongo cada cambio y espero el «sí».
Preguntas:
- **Conflicto de commits y PR:** `memories.md` exige commits en imperativo con tipos `feat/refactor/fix/ui/docs/merge/ci/chore` y PR de 5 secciones; `rules/general.md` pide *Conventional Commits* en español. ¿Cuál manda? Lo unifico en `general.md` y retiro la duplicación.
- Convenciones observadas (marcadas «(observado)» hasta que las confirmes): capas NestJS, validación con zod, manejo de errores, RLS y cifrado AES-256-GCM, throttling por usuario.
- Seguridad específica: manejo del refresh token de Google, redacción de logs, política de borrado de cuenta, qué nunca se loguea.
- Pruebas: nivel de exigencia y política de E2E contra servicios simulados.

Archivos: las 5 reglas, `docs/decisions/` (un ADR por decisión no obvia: sync por slices, Supabase, cifrado del token, mocks en E2E).

### Fase 5 · Skills
Preguntas:
- Asignación de las 7 skills que ya tienes: `design-taste-frontend`, `frontend-design` y `ui-ux-pro-max` → `frontend-proyecto`; `playwright-best-practices` → `pruebas-proyecto`; `github-workflow-standards` → `rules/general.md`; `find-skills` y `grill-me` → tabla de `AGENTS.md`. ¿Alguna sobra o se contradice con las reglas?
- Skills nuevas para el stack: NestJS, Supabase/Postgres y, si quieres, Vercel o Prisma. Te propongo fuente y alcance y **instalo solo las que apruebes** (`npx skills add …` añade dependencias externas).
- ¿Alguna skill propia del proyecto (p. ej. «añadir un adaptador de sync», «agregar un módulo»)? Candidatas: las tareas que más repitieron los agentes de backend.

Archivos: «Skills de terceros» de `frontend-proyecto`, `backend-proyecto`, `pruebas-proyecto`, `stack/*.md` y la tabla de `AGENTS.md`.

### Fase 6 · Memoria y backlog → `features.json`, `TASKS.md`, `specs/`
Preguntas:
- Confirmar el inventario de funcionalidades **hechas** (kanban, universidad, gym, calendario, Google, sync, cuenta pública) y las **pendientes**.
- Prioridad de lo pendiente. Candidatas que ya detecté: producción (`student-os-prod`, variables, ping anti-pausa de Supabase), ramas remotas ya fusionadas por borrar (`feat/overview-summary` entró con squash en el PR #5), BUG-01 del logout, bundle web de ~1 MB, avisos de lint, verificación de Google.
- Bugs conocidos y deuda técnica.
- Qué hago con `memories.md`: archivarlo en `docs/references/` como historial y dejar de actualizarlo, o mantenerlo vivo.

Archivos: `features.json` (borro el ejemplo), `TASKS.md`, carpetas `docs/specs/NNN-nombre/` para las prioritarias (la spec se escribe después con `spec-plan-code`), primera entrada de `PROGRESS.md`.

### Fase 7 · Limpieza y cierre
1. Fusiono y borro los `*.harness.*` (pidiendo confirmación en cada conflicto).
2. Confirmo que no hay `CLAUDE.md` ni `GEMINI.md`; si apareciera alguno, paso su contenido y te pido permiso para borrarlo.
3. ADR `0002-adopcion-del-harness.md` con el estado inicial y las decisiones tomadas.
4. Ejecuto `./scripts/check.sh` completo, el control de coherencia de la sección 1 y la skill `revisor`.
5. Commit en la rama y PR con el resumen. Propongo la primera funcionalidad para estrenar `spec-plan-code`.

## 3. Orden y dependencias

```
F0 decisiones ─▶ F1 exploración ─▶ F2 producto ─┐
                                  F3 arquitectura┼─▶ F4 reglas ─▶ F5 skills ─▶ F6 backlog ─▶ F7 cierre
                                  (F2 y F3 se pueden hacer en la misma sesión)
```

F4 va después de F3 porque las reglas dependen del stack; F5 después de F4 porque las skills nuevas no pueden contradecir las reglas; F6 al final porque el backlog usa el vocabulario y las rutas ya fijados.

## 4. Lo que **no** haré sin tu permiso
Añadir o quitar dependencias, instalar skills (`npx skills add`), crear migraciones, modificar `docs/rules/`, borrar archivos que no creé, tocar producción, leer `.env`, hacer push a `main`.
