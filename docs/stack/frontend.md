# Stack del frontend

> Fase 3 (2026-11-23): despliegue (Vercel + Render + Supabase), mapa de pruebas y pre-commit **confirmados por el humano**; el resto se dedujo del código.

| Aspecto            | Elección                                                        | Versión          |
|--------------------|-----------------------------------------------------------------|------------------|
| Lenguaje           | TypeScript                                                      | ~7.0.2           |
| Framework          | React                                                           | ^19.3            |
| Bundler            | Vite (+ `@vitejs/plugin-react`)                                 | ^8.3             |
| Estilos / UI       | Tailwind CSS v4 (`@tailwindcss/vite`), `clsx`, `tailwind-merge`, `lucide-react`, `canvas-confetti` | ^4.3 |
| Estado             | Estado de la app en un único `AppState` (`useSyncedAppState`: caché en `localStorage` + sync) + `syncStore` | — |
| Persistencia local | `localStorage` + IndexedDB (`idb-keyval`)                        | ^6.3             |
| Cliente HTTP / BD  | `src/services/api.ts` (API propia) y `@supabase/supabase-js` (auth) | ^2.119       |
| Validación         | `zod` + tipos de `@student-os/shared`                           | ^4.6             |
| Linter             | oxlint (`.oxlintrc.json` en la raíz)                            | ^1.90            |
| Pruebas unitarias  | Vitest + Testing Library + jsdom + fake-indexeddb               | ^5.1             |
| Pruebas E2E        | Playwright (`apps/web/e2e`, stack simulado)                     | ^1.65            |
| Gestor de paquetes | npm workspaces (Node >= 20; CI en 20, Render en 22)             | npm 11           |
| Despliegue         | Vercel, **Root Directory `apps/web`** (config en `apps/web/vercel.json`) | —       |

## Comandos
Se ejecutan desde la raíz del repo.

| Acción        | Comando                                              |
|---------------|------------------------------------------------------|
| Desarrollo    | `npm run dev:web` (Vite en `http://localhost:5173`)  |
| Build         | `npm run build -w @student-os/web` (`tsc -b && vite build`) |
| Lint          | `npm run lint -w @student-os/web`                    |
| Tipos         | `npm exec -w @student-os/web -- tsc -b`              |
| Pruebas       | `npm run test -w @student-os/web` (Vitest)           |
| E2E           | `npm run test:e2e -w @student-os/web` (levanta el stack simulado, ~2 min; la primera vez: `npx playwright install chromium`) |
| Stack simulado a mano | `npm run e2e:stack -w @student-os/web`       |

## Estructura de carpetas en `apps/web/`
```
src/
  components/     UI por módulo: account, auth, calendar, common, dashboard, gym, kanban,
                  landing, layout, learning, legal, quick-add, sync, university
  hooks/          useSyncedAppState
  services/       api.ts, supabase.ts, googleCalendar.ts, googleCloud.ts
  sync/           motor de sincronización: engine, syncStore, cola en IndexedDB, backup,
                  leader, hash; adapters/ (kanban, university, learning, gym, calendar, profile)
  types/  utils/  data/  assets/
e2e/              pruebas Playwright (01-nocloud … 04-two-devices) y support/harness
```
`src/App.tsx` concentra el `AppState` y el cableado: solo se edita con cuidado (ver `docs/project/ARCHITECTURE.md`).

## Skills de terceros instaladas
| Skill                      | Para qué                                   | Fuente |
|----------------------------|--------------------------------------------|--------|
| `ui-ux-pro-max`            | Guías de UI/UX, accesibilidad, responsive y paletas | `.agents/skills/ui-ux-pro-max/` |
| `frontend-design`          | Dirección estética y tipografía en pantallas nuevas | `.agents/skills/frontend-design/` |
| `design-taste-frontend`    | Solo landing y páginas de marketing (`components/landing/`) | `.agents/skills/design-taste-frontend/` |
| `playwright-best-practices`| Técnica de pruebas E2E (vía skill `pruebas-proyecto`) | `.agents/skills/playwright-best-practices/` |

Asignadas en la Fase 5 (2026-11-23) y enlazadas desde `frontend-proyecto` y `pruebas-proyecto`. Si contradicen `docs/rules/frontend.md` o `PRODUCT.md`, gana lo del proyecto.
