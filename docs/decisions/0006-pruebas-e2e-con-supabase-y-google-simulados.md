# ADR 0006 · Pruebas E2E con Supabase y Google simulados

- **Fecha:** 2026-11-23 (decisión de la Ola 4, QA-E2E; registrada al adoptar el harness)
- **Estado:** aceptada

## Contexto
Hay que probar flujos reales de navegador (sin nube, login con Google, importador, PC + móvil) sin depender de cuentas reales, red ni credenciales.

## Decisión
- Playwright en `apps/web/e2e/`, con un **stack local** levantado por `apps/api/test/e2e-harness/stack.mjs`: la API real contra Postgres embebido y servidores falsos de Supabase (`fake-supabase.mjs`, incluido el flujo PKCE) y de Google (`fake-google.mjs`).
- Comando: `npm run test:e2e -w @student-os/web` (~2 min). Las pruebas de integración del API usan Postgres embebido sin navegador (`npm run test:e2e -w @student-os/api`).
- El CI actual no ejecuta la E2E; corre con `./scripts/check.sh` completo.

## Alternativas consideradas
- **Servicios reales (Supabase y Google):** descartada *(deducido)*: necesitaría credenciales, red y cuentas de prueba, y no sería reproducible ni gratuita.

## Consecuencias
- La E2E es reproducible y sin secretos, pero **no prueba** la integración real con Supabase ni con Google: esa verificación manual sigue pendiente para producción.
- Correr la E2E reescribe los JPG de `docs/qa/evidence/` (deuda en `docs/TASKS.md`).
- Las pruebas conocidas como fallo (BUG-01) usan `test.fail` según `docs/rules/testing.md`.
