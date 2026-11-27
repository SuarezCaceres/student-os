# Frontend (apps/web)

Antes de tocar código aquí, lee:
- `docs/stack/frontend.md`: tecnologías y comandos
- `docs/rules/frontend.md`: reglas obligatorias
- skill `frontend-proyecto`

Específico de este proyecto:
- `src/App.tsx` concentra el `AppState` y el cableado del sync: edítalo con cuidado y en cambios pequeños.
- No hay modo local ni cuenta local: sin sesión de Google solo se ve la landing (ADR 0007). El estado vive en `useSyncedAppState`; los componentes no escriben en `localStorage` por su cuenta.
- **Zona protegida (pregunta antes de tocar):** el motor de sync y su regla de descarte de datos ajenos (`src/sync/`, `src/components/sync/SyncProvider.tsx`).
- Los tipos del contrato salen de `@student-os/shared`: no los dupliques (ver `packages/shared/AGENTS.md`).
- Pruebas: unitarias junto al código (Vitest) y E2E en `e2e/` (Playwright). Comando: `npm run test:e2e -w @student-os/web`.
- Despliegue en Vercel con Root Directory `apps/web` (`vercel.json`): no cambies `installCommand`, `buildCommand` ni `outputDirectory` sin avisar.

Las reglas generales siguen en el `AGENTS.md` de la raíz.
