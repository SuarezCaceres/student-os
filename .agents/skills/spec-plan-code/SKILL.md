---
name: spec-plan-code
description: Úsala para cualquier funcionalidad nueva o cambio grande. Guía el flujo spec → plan → código con aprobación humana entre fases, pruebas por cada criterio de aceptación y actualización de la memoria del proyecto.
---

# Flujo spec → plan → código

## Fase 1 · Spec (qué y por qué)
1. Busca el siguiente id libre en `docs/features.json` (NNN).
2. Copia `docs/specs/_plantilla/` a `docs/specs/NNN-nombre/`.
3. Rellena `spec.md`. Si falta información, **pregunta** antes de inventar requisitos.
4. Cada criterio de aceptación debe poder comprobarse con una prueba.
5. Añade la funcionalidad a `docs/features.json` con estado `spec` y sus criterios (`pasa: false`).
6. **Detente y pide la aprobación de la spec.** No sigas sin un «sí» explícito.

## Fase 2 · Plan (cómo)
1. Lee `docs/project/ARCHITECTURE.md` y los `docs/stack/` y `docs/rules/` de las áreas afectadas.
2. Rellena `plan.md`: enfoque, cambios por área, qué prueba cubre cada criterio y pasos pequeños.
3. Marca de forma explícita si hace falta una migración o una dependencia nueva (requieren aprobación).
4. Cambia el estado en `features.json` a `plan`.
5. **Detente y pide la aprobación del plan.**

## Fase 3 · Código
1. Crea la rama `feat/NNN-nombre`. Estado → `en_curso`.
2. Implementa paso a paso, siguiendo el plan. En cada paso:
   - escribe o actualiza las pruebas (skill `pruebas-proyecto`);
   - para el código de frontend o backend, usa la skill `frontend-proyecto` o `backend-proyecto`;
   - ejecuta `./scripts/check.sh --rapido` y haz commit cuando pase.
3. Si el plan resulta ser incorrecto, detente, explica qué cambió y actualiza `plan.md` antes de seguir.

## Fase 4 · Revisión y cierre
1. Ejecuta `./scripts/check.sh` completo.
2. Usa la skill `revisor`. Corrige lo que encuentre.
3. Marca `pasa: true` solo en los criterios cuya prueba pasa de verdad. Estado → `revision`.
4. Abre el PR con un enlace a la spec y la lista de criterios cubiertos.
5. Actualiza `docs/TASKS.md` y añade una entrada a `docs/PROGRESS.md`.
6. Cuando el humano haga merge, estado → `hecho`.
