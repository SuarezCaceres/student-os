# ADR 0004 · Modo local sin cuenta y modo nube con sesión

- **Fecha:** 2026-11-23 (decisión de la Ola 0/2 del backend; registrada al adoptar el harness)
- **Estado:** reemplazada por ADR 0007 (2026-11-24: se retiran el modo local y el importador)

## Contexto
StudentOS nació como una app 100 % local (`localStorage`, clave `student_os_state_v1`) para una sola persona. El objetivo actual es un producto público con sincronización entre dispositivos. Fuentes: `PRODUCT.md`, `PLAN_BACKEND.md`.

## Decisión
Se mantienen **dos modos**:
- **Local (sin cuenta):** `useLocalStorage` guarda todo el `AppState` en el navegador.
- **Nube (con sesión):** `useSyncedAppState` envuelve el `AppState` por *slices*, calcula diferencias por `id` y las envía a la API en segundo plano (ver ADR 0003).
- Al iniciar sesión por primera vez, un **importador** decide qué hacer con los datos locales frente a los de la nube y descarga un respaldo antes de reemplazar nada.

## Alternativas consideradas
- **Solo nube:** descartada *(deducido)*: obligaría a todos a crear una cuenta y rompería el uso offline y privado que ya existía.
- **Reescribir `App.tsx` para usar un store nuevo:** descartada: el cambio se hizo con un solo cambio de línea (`useLocalStorage` → `useSyncedAppState`) para no tocar los módulos.

## Consecuencias
- Toda funcionalidad nueva debe funcionar en ambos modos.
- El importador y la migración son **zona protegida**: un fallo puede pisar datos de un usuario (ver `docs/project/PROJECT.md`).
- Los E2E cubren los dos modos (`apps/web/e2e/01-nocloud.spec.ts` y siguientes).
