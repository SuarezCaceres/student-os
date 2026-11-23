# Reglas de pruebas

Mandan sobre cualquier skill de pruebas de terceros.

## Qué probar
| Tipo        | Qué cubre                                  | Dónde vive                                  |
|-------------|--------------------------------------------|---------------------------------------------|
| Unitarias   | Funciones, servicios y componentes aislados | Junto al código: web y shared `*.test.ts(x)` (Vitest), api `*.spec.ts` (Jest) |
| Integración | Endpoints del API con Postgres embebido     | `apps/api/test/*.e2e-spec.ts` (+ `helpers/`) — `npm run test:e2e -w @student-os/api` |
| E2E         | Flujos completos de usuario en el navegador, con Supabase y Google simulados | `apps/web/e2e/*.spec.ts` (Playwright) y harness en `apps/api/test/e2e-harness/` — `npm run test:e2e -w @student-os/web` |

> Mapa adaptado al proyecto (decisión del humano, 2026-11-23): se conservan las carpetas existentes en vez de mover las pruebas a `tests/`.

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
