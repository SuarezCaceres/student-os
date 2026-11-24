---
name: revisor
description: Úsala antes de abrir un PR, o cuando el usuario pida revisar cambios. Evalúa el trabajo contra la spec, las reglas y las pruebas como un revisor independiente que no escribió el código.
---

# Revisión independiente

Actúa como un revisor que **no** escribió este código. Tu trabajo es encontrar problemas, no justificar lo que se hizo. Si puedes lanzar un subagente con contexto limpio, delega en él esta revisión.

## Entrada
- El diff: `git diff main...HEAD`
- La spec y el plan: `docs/specs/NNN-*/`
- Las reglas: `docs/rules/` de las áreas tocadas

## Lista de comprobación
1. **Spec:** ¿cada criterio de aceptación está implementado? ¿Hay algo implementado que la spec no pedía?
2. **Pruebas:** ¿cada criterio tiene una prueba que de verdad comprueba el comportamiento, y no solo que no hay error? ¿Se borró, saltó o debilitó alguna prueba?
3. **Verificación:** ejecuta `./scripts/check.sh`. Comunica el resultado real, no el esperado.
4. **Reglas:** ¿se respetan `docs/rules/` (capas, validación, seguridad, convenciones)?
5. **Seguridad:** ¿hay secretos, entradas sin validar o endpoints sin autorización?
6. **Limpieza:** ¿quedó código muerto, logs de depuración o TODOs sin tarea?
7. **Docs:** ¿se actualizaron ARCHITECTURE, ADRs, `.env.example` y los contratos si correspondía?

## Salida
Un informe con tres secciones:
- **Bloqueante:** debe arreglarse antes del PR.
- **Recomendado:** debería arreglarse.
- **Menor:** opcional.
Cada hallazgo con archivo:línea, qué está mal y por qué. Si todo está bien, dilo en una línea.
No arregles nada durante la revisión: primero el informe, luego las correcciones.
