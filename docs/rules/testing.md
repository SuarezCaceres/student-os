# Reglas de pruebas

Mandan sobre cualquier skill de pruebas de terceros.

## Qué probar
| Tipo        | Qué cubre                                  | Dónde vive                                  |
|-------------|--------------------------------------------|---------------------------------------------|
| Unitarias   | Funciones, servicios y componentes aislados | Junto al código (`*.test.*` / `test_*.py`)  |
| Integración | Endpoints con la BD de pruebas              | `tests/integration/`                        |
| E2E         | Flujos completos de usuario en el navegador | `tests/e2e/`                                |

- Cada funcionalidad nueva lleva unitarias para su lógica, al menos una de integración por endpoint nuevo y al menos una E2E por cada criterio de aceptación visible para el usuario.
- Cada bug corregido lleva una prueba que fallaba antes del fix.

## Cómo escribirlas
- Estructura AAA: Arrange, Act, Assert. Una idea por prueba.
- Nombres que describan el comportamiento: `rechaza_email_duplicado`, no `test1`.
- Prueba el comportamiento, no la implementación interna.
- Los datos de prueba se crean dentro de la prueba o con fixtures/factories. No dependas del orden de ejecución.
- Sin servicios externos reales: usa mocks o contenedores. Nunca la BD de producción.

## Prohibido
- Borrar, saltar (`skip`) o debilitar una prueba para que pase. Si una prueba está mal, explícalo y pregunta.
- Dar por terminada una tarea sin haber ejecutado `./scripts/check.sh`.
- Escribir pruebas que solo comprueban que «no lanza error».

## Pruebas inestables (flaky)
- Si una prueba falla de forma intermitente, no la reintentes hasta que pase: regístrala en `docs/TASKS.md` y avisa.

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
