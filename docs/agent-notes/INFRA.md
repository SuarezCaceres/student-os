# Notas del agente INFRA (Ola 1) — `feat/be-infra`

## Qué se hizo
- Monorepo npm workspaces: `"workspaces": ["apps/*", "packages/*"]` en el `package.json` raíz (privado, `engines.node >=20`).
- Frontend movido con `git mv` a `apps/web/`: `src`, `public`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `scripts`. Historial conservado (git detecta los renombres al 100 %).
- `apps/web/package.json` (`@student-os/web`) con las dependencias y scripts previos (`dev`, `build`, `lint`, `preview`) más `@supabase/supabase-js`, `zod`, `idb-keyval`, y `vitest` (no había runner) con `test: vitest run --passWithNoTests`.
- Scripts raíz: `dev:web`, `dev:api` (`--if-present`), `build`, `lint`, `test` (estos tres con `--workspaces --if-present`).
- `tsconfig.base.json` común (target, skipLibCheck, moduleDetection, noFallthroughCasesInSwitch); `tsconfig.app.json` y `tsconfig.node.json` de web lo extienden con `../../tsconfig.base.json`.
- `.oxlintrc.json` (raíz): `ignorePatterns` ahora con `**/` para cubrir `apps/*/dist`, etc. El lint de web usa `oxlint -c ../../.oxlintrc.json` (oxlint solo busca la config en el cwd).
- `.gitignore`: `apps/*/node_modules`, `apps/*/dist`, `*.tsbuildinfo`, `*.env*` (excepto `.env.example`), `.env.local`.
- CI (`.github/workflows/ci.yml`): jobs `web`, `api`, `shared`; Node 20; `npm ci` en la raíz en cada job; dispara en `main` e `integration/**` (push y PR).
- `apps/web/vercel.json`.

## Decisiones y justificación
1. **`envDir: '../..'` en `apps/web/vite.config.ts`.** Vite lee `.env*` de la raíz del proyecto (ahora `apps/web`). Para no cambiar el comportamiento de quien ya tiene `.env.local` en la raíz del repo (y para que `.env.example` raíz siga siendo la referencia) se apunta a la raíz del monorepo. En Vercel no influye (las variables llegan por `process.env`). Es el único cambio de código en archivos movidos.
2. **`vercel.json` en `apps/web/` y no en la raíz.** Con *Root Directory* = `apps/web`, Vercel solo lee el `vercel.json` de esa carpeta; uno en la raíz se ignoraría. Contenido: `framework: vite`, `installCommand: "cd ../.. && npm ci"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`. El `install` sube a la raíz porque el lockfile y los workspaces viven ahí (`npm ci` dentro de `apps/web` fallaría/ignoraría el lockfile raíz y no enlazaría `@student-os/shared`). El `build` corre en `apps/web` (`tsc -b && vite build`) y produce `apps/web/dist`. No se añadieron `rewrites` porque hoy no hay router (no es un cambio de comportamiento).
3. **Pasos del CI de api/shared con guarda `if [ -f .../package.json ]`.** `npm run <x> -w apps/api --if-present` NO es suficiente: `--if-present` cubre un script ausente, pero con la carpeta inexistente npm falla con `No workspaces found` (comprobado, exit 1). Con la guarda, el job pasa en verde hoy y ejecuta de verdad en cuanto el workspace exista.
4. **Vitest 5.1** como runner del web (compatible con Vite 8; `npm test` verde con `--passWithNoTests`).
5. **`tsBuildInfoFile` sigue en `./node_modules/.tmp/...`** de `apps/web`; `tsc -b` crea la carpeta, funciona con las dependencias hoisted en la raíz.

## DESVIACIÓN: `@student-os/shared` NO está en `apps/web/package.json`
El encargo pedía añadir `@student-os/shared` como `"*"`. No se hizo en esta rama porque `packages/shared` lo crea CONTRACT (fuera de mi alcance): con la dependencia declarada y sin esa carpeta, `npm install`/`npm ci` hacen 404 contra el registro y la rama no sería instalable ni verificable. **Acción del Integrador al fusionar CONTRACT:** añadir en `apps/web/package.json` `"dependencies"`: `"@student-os/shared": "*"` y ejecutar `npm install` (regenera el lockfile, que de todos modos se regenera tras cada ola según PLAN_BACKEND §2).

## Ajuste exacto del Integrador en Vercel (tras fusionar INFRA)
En el proyecto Vercel → Settings → General:
- **Root Directory:** `apps/web`
- Activar **"Include source files outside of the Root Directory in the Build Step"** (por defecto activo; imprescindible para ver el lockfile y `packages/*`).
- **Framework Preset:** Vite. **Install / Build / Output:** déjalos en blanco (sin override en el dashboard) para que mande `apps/web/vercel.json`: install `cd ../.. && npm ci`, build `npm run build`, output `dist`. Si hubiera overrides en el dashboard, quitarlos o igualarlos a esos valores.
- **Node.js Version:** 20.x (o superior).
- Variables: se mantiene `VITE_GOOGLE_CLIENT_ID`; más adelante `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL` (las define el Integrador; INFRA no añade ninguna).
- Verificar un deploy de preview antes de promover.

## Variables de entorno nuevas
Ninguna. (Los `.env*` se leen de la raíz del repo por `envDir`.)

## Riesgos / deuda
- **README.md** (no tocable por mí) cita `npm run dev` y `npm run preview` en la raíz; ya no existen ahí. Usar `npm run dev:web` (o `npm run dev -w apps/web`; `preview`: `npm run preview -w apps/web`). El Integrador debe actualizarlo.
- El lockfile se generó sin `packages/shared` ni `apps/api`; tras fusionar API-CORE y CONTRACT hay que correr `npm install` (conflicto de lock => descartar y regenerar).
- `npm run lint` pasa con 7 warnings preexistentes (variables sin uso, deps de hooks); ninguno es un error.
- `scripts/*.mjs` usan rutas relativas a su propia carpeta (`../public/...`) y siguen funcionando en `apps/web/scripts`.
- El build emite el aviso preexistente de chunk > 500 kB (sin cambios).
- Si el CI de PR a `integration/**` es indeseado, quitar `'integration/**'` de `on:`.
- Puerto 5173 en esta máquina estaba ocupado por otro proceso; Vite subió solo a 5174 (comportamiento normal de Vite, no un fallo).
