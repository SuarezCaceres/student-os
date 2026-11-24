# Frontend (apps/web)

Antes de tocar código aquí, lee:
- `docs/stack/frontend.md`: tecnologías y comandos
- `docs/rules/frontend.md`: reglas obligatorias
- skill `frontend-proyecto`

Específico de este proyecto:
- `src/App.tsx` concentra el `AppState` y el cableado del sync: edítalo con cuidado y en cambios pequeños.
- El modo local (`useLocalStorage`) y el modo nube (`useSyncedAppState`) deben seguir funcionando los dos.
- **Zona protegida (pregunta antes de tocar):** el importador del primer inicio (`src/components/auth/SyncGate.tsx`, `src/components/sync/SyncProvider.tsx`, `src/sync/`).
- Los tipos del contrato salen de `@student-os/shared`: no los dupliques (ver `packages/shared/AGENTS.md`).
- Pruebas: unitarias junto al código (Vitest) y E2E en `e2e/` (Playwright). Comando: `npm run test:e2e -w @student-os/web`.
- Despliegue en Vercel con Root Directory `apps/web` (`vercel.json`): no cambies `installCommand`, `buildCommand` ni `outputDirectory` sin avisar.

Las reglas generales siguen en el `AGENTS.md` de la raíz.
