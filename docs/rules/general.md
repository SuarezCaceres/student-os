# Reglas generales

Estas reglas son obligatorias y mandan sobre cualquier skill de terceros.

## Git
- Ramas: `feat/NNN-nombre`, `fix/descripcion-corta`, `chore/descripcion-corta`. NNN es el id de `docs/features.json`.
- Nunca trabajes directamente en `main`. Los cambios llegan a `main` solo por PR.
- Commits pequeños y frecuentes, con formato *Conventional Commits* y **descripción en español**, en imperativo, en minúsculas y sin punto final:
  `feat(web): añade formulario de registro`, `fix(api): valida email duplicado`.
  Los tipos y ámbitos válidos son los de la skill `github-workflow-standards`. Sus ejemplos están en inglés solo como ilustración: **el idioma de los mensajes lo fija esta regla** (decisión del humano, 2026-11-23). Un commit = un cambio cohesivo que pasa `./scripts/check.sh --rapido`.
- Un PR por funcionalidad o fix. El formato (título y las 5 secciones obligatorias) lo define la skill `github-workflow-standards`; no lo dupliques aquí. Además, en la descripción enlaza la spec y lista los criterios de aceptación cubiertos.

## Código
- Sigue las convenciones que ya existen en el código cercano antes de introducir otras nuevas.
- No dejes código muerto, `console.log`/`print` de depuración ni TODOs sin una tarea asociada en `docs/TASKS.md`.
- Nombres descriptivos en inglés para el código; comentarios y docs en español.
- El formato lo decide el formateador del proyecto. No discutas estilo, ejecútalo.
- Comenta el *por qué*, no el *qué*.

## Documentación
- Si cambias la arquitectura, actualiza `docs/project/ARCHITECTURE.md`.
- Si tomas una decisión no obvia (librería, patrón o descarte de una opción), escribe un ADR en `docs/decisions/`.
- Si añades una variable de entorno, documéntala en `.env.example`.

## Lecciones aprendidas
<!-- El agente propone entradas aquí cuando el humano le corrige un error. Formato:
- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
