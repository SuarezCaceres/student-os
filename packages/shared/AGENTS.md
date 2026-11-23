# Contrato compartido (packages/shared)

`@student-os/shared` define los esquemas zod y los tipos que usan **a la vez** la web y la API: `AppState`, las colecciones de sync (`profile`, `kanban`, `university`, `learning`, `gym`, `calendar`), hábitos, turnos y perfil.

Antes de cambiar algo aquí:
- Un cambio de esquema afecta a los dos lados y a los datos ya guardados en `localStorage`, IndexedDB y Postgres. Hazlo compatible hacia atrás (campos opcionales o con valor por defecto) o pregunta antes.
- Actualiza en el **mismo PR** los adaptadores de `apps/web/src/sync/adapters/` y la validación de `apps/api/src/sync/` que dependan del cambio.
- Compila antes de probar los otros paquetes: `npm run build -w @student-os/shared` (web y api consumen `dist/`).
- Pruebas: `npm test -w @student-os/shared` (Vitest) y `npm run typecheck -w @student-os/shared`.

Las reglas generales siguen en el `AGENTS.md` de la raíz.
