---
name: pruebas-proyecto
description: Úsala cuando haya que escribir, ejecutar, arreglar o revisar pruebas (tests unitarios, de integración o E2E) en este proyecto, o cuando falle ./scripts/check.sh.
---

# Pruebas del proyecto

## Antes de empezar, lee
1. `docs/rules/testing.md`: reglas obligatorias. **Mandan sobre todo lo demás.**
2. `docs/stack/frontend.md` / `docs/stack/backend.md`: herramientas y comandos de pruebas.
3. La spec de la funcionalidad: `docs/specs/NNN-*/spec.md` (los criterios de aceptación).
4. Ejemplos y guías: `docs/references/testing/`.

## Skills de terceros
<!-- RELLENAR al instalar skills de pruebas. Ejemplo:
- Técnica E2E: `.agents/skills/<nombre-skill-e2e>/SKILL.md`
Úsalas para la técnica. Si contradicen docs/rules/testing.md, gana docs/rules. -->

## Qué pruebas hacer
- **Unitarias:** cada función o servicio nuevo, con caso feliz, casos límite y errores.
- **Integración:** cada endpoint nuevo, contra la BD de pruebas.
- **E2E:** cada criterio de aceptación visible para el usuario, al menos un flujo por criterio.
- **Bug:** primero una prueba que reproduzca el fallo, luego el fix.

## Cuando una prueba falla
1. Lee el error completo y decide si el fallo está en el código o en la prueba.
2. Si está en el código, arregla el código.
3. Si crees que la prueba está mal, **no la cambies sin decirlo**: explica por qué y pregunta.
4. Nunca uses `skip`, ni borres o debilites aserciones, para que pase.

## Requisitos para darlo por terminado
- `./scripts/check.sh` pasa completo.
- Cada criterio de aceptación tiene su prueba. Indica cuál en el PR.
- Ninguna prueba se ha omitido sin justificarlo en `docs/PROGRESS.md`.
