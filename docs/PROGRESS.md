# Progreso

> Bitácora entre sesiones. Cada sesión **añade** una entrada al principio (la más reciente arriba).
> Su objetivo es que la siguiente sesión, que no recuerda nada, sepa dónde retomar.

<!-- Formato:
## AAAA-MM-DD · agente (Claude Code / Antigravity) · rama
- **Hecho:** qué se completó (con referencia a commits o PR)
- **Verificación:** resultado de ./scripts/check.sh
- **Pendiente:** qué queda y el siguiente paso concreto
- **Problemas:** errores, dudas o decisiones que necesitan al humano
-->

## 2026-11-27 · Claude Code (sesión «pendientes») · docs/008-declara-profile
- **Hecho:** se declara el scope `profile` para la verificación en Google. En producción, Supabase lo añade al login (`google_connections.scopes` = `calendar.events.owned userinfo.email userinfo.profile openid`, comprobado el 2026-11-26) y la app sí lo usa: nombre y foto en la cabecera (`useAuthState.ts`) y nombre inicial del perfil nuevo (`newAccountState.ts`). Decisión del humano: declararlo, no sustituir el login de Supabase. Actualizados `scopes.md`, `justificaciones.md` (texto en inglés de `openid`/`email`/`profile`), el checklist (H2, B1) y `TASKS.md` (A4). Antes, en esta sesión: revisión de #19 (scopes reducidos a `calendar.events.owned`), avisos de reconexión de la 009 y respuestas a Q1, Q4–Q8 y Q10 de la 008 (dominio `studentoshub.io`).
- **Verificación:** solo documentación; el hook de pre-commit (`check.sh --rapido`) pasa.
- **Pendiente:** comprobar con una cuenta real que `calendar.events.owned` devuelve los eventos de invitaciones; Q2 y Q3 del humano; bloque B (páginas legales con `profile`) y bloque H en la consola.
- **Problemas:** ninguno.

## 2026-11-27 · Claude Code · fix/render-google-redirect (producción desplegada)
- **Hecho:** producción de la 007 en marcha. Supabase `student-os-prod` (us-east-1; se pausó `bidercorp-demo` por el límite de 2 proyectos gratuitos, decisión del humano) con las 2 migraciones y `rls-baseline.sql` aplicadas por el conector; API en Render (`https://student-os-api.onrender.com`, Virginia, rama `main`); web en Vercel con `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_API_URL`; #9 fusionado en `main` (con 010, 011, 012, 008 y la parte de código de la 007 dentro). Login real verificado: perfil creado, Calendar vinculado sin botón, 7 registros sincronizados. Ping a Supabase activo (`PROD_API_URL` en GitHub; primera ejecución en verde).
- **Corrección:** la API necesitaba `GOOGLE_REDIRECT_URI` (la lee `GoogleConfig`, no `env.schema`) y no estaba en `render.yaml`; sin ella respondía `google_not_configured`. Ahora está en `render.yaml` y en `docs/stack/backend.md`, con una prueba que falla si la API lee una variable que `render.yaml` no declara.
- **Verificación:** `scripts/verificar-produccion.mjs` contra producción: 5 de 5 en verde. Criterios 007 C1–C4 marcados; C5 (otro dispositivo) y C6–C8 pendientes de prueba manual.
- **Pendiente:** el humano desactiva Vercel Authentication en producción (Settings → Deployment Protection; el agente no tiene permiso) para que entren otras personas; dominio `studentoshub.io`; verificación de Google (008), que debe declarar también `userinfo.profile` porque Supabase lo pide.
- **Problemas:** el secreto del cliente de Google se vio en una captura y se rotó; un `E2E_PORT_OFFSET` que deja la API en el puerto 5060 falla porque `fetch` de Node bloquea ese puerto.

## 2026-11-26 · Claude Code · feat/007-produccion
- **Hecho:** fase A del plan 007 (aprobado), un commit por paso, sobre `feat/009-login-google-calendar-automatico`: A2 `GET /health/ready` (público, sin límite, `SELECT 1` con tope de 5 s; 200 `{ status: 'ok', db: 'ok' }` o 503 sin detalles del error en la respuesta ni en el log; `/health` sin cambios), A1 `scripts/verificar-produccion.mjs` (solo lectura, sin dependencias ni credenciales; prueba contra servidores falsos y contra la API real con Postgres embebido), A3 `.github/workflows/ping-supabase.yml` (cada 3 días y a mano; en verde sin hacer nada si falta `PROD_API_URL`; `permissions: {}`) y A4 variables y orden de despliegue en `docs/stack/backend.md`.
- **Verificación:** hook de cada commit con `E2E_PORT_OFFSET=1900` y `./scripts/check.sh` completo al cerrar (ver el PR).
- **Pendiente:** fases B a H del humano (Supabase, Google Cloud, Supabase Auth, Render, Vercel y DNS, variable `PROD_API_URL`) y después la verificación de punta a punta con el script. `docs/stack/frontend.md` y `.env.example` no se tocaron (el segundo está bloqueado para lectura, M4).
- **Problemas:** en el primer intento del hook, la suite `public.e2e-spec.ts` falló una vez con `P1001` al arrancar su Postgres embebido (puerto 56235) y pasó en las repeticiones sin cambios: posible inestabilidad al arrancar Postgres con la máquina cargada.

## 2026-11-26 · Claude Code · feat/008-verificacion-app-google (revisión del PR #19)
- **Hecho:** la revisión independiente del PR #19 encontró que la app no usaba `calendar.freebusy` (`fetchGoogleBusyIntervalsForWeek` solo se llamaba desde pruebas; los huecos salen de `events.list`) ni `calendar.calendars.readonly` (nada rellenaba `calendarName`). Decisión delegada por el humano: **solo `openid`, `email` y `calendar.events.owned`**. B1: retirados `fetchGoogleBusyIntervalsForWeek`, los mapeos `freeBusy`/`calendars/primary` del proxy web, `calendarName` de la meta local (no pasa por `src/sync/`), las rutas `GET /google/calendar/primary` y `POST /google/calendar/freebusy` del API con su esquema y su soporte en los dos servidores falsos de Google; una prueba de integración comprueba que esas rutas dan 404 sin llamar a Google y otra unitaria que el proxy web las rechaza. I1: fuente única `VERIFIED_GOOGLE_CALENDAR_SCOPES` en `@student-os/shared` (`googleScopes.ts`), de la que derivan `GOOGLE_SCOPES` (API) y `GOOGLE_LOGIN_CALENDAR_SCOPES` (web); prueba-candado gemela en `googleLogin.test.ts` con el mismo aviso de reverificar. M3: la E2E 02 comprueba que la web no pide `profile` ni scopes amplios o sin uso (el Supabase falso no añade `profile`; el real sí puede, queda pendiente). M4: comentario en `fake-google.mjs` sobre el 403 por scope. Docs: ADR 0008 («Revisión 2026-11-26»), `scopes.md`, `justificaciones.md`, `video-guion.md` (pasos 3 y 4 fusionados en uno y renumerados), 009-C4 (spec y `features.json`), checklist, notas de los anexos A y B de la spec 008 y fechas de los ADR 0005 y 0007.
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, 395 + 487 + 37 unitarias, 159 de integración y 36 E2E en 4,2 min). Las capturas JPG que reescribe la E2E se restauraron (solo ruido entre ejecuciones).
- **Pendiente:** antes de H2, con una cuenta real: que `calendar.events.owned` devuelve los eventos de invitaciones (ahora es el único scope de lectura) y qué scopes de identidad añade Supabase (¿`profile`?). Paso 6 del guion (antes 7) sigue por revisar.
- **Problemas:** la descripción de 009-C4 en `features.json` se actualizó para que no contradiga la spec; la regla del archivo solo deja tocar `estado` y `pasa`, así que revísalo.

## 2026-11-25 · Claude Code · feat/008-verificacion-app-google
- **Hecho:** plan de la 008 aprobado por el humano y bloque A completo, en una rama **apilada sobre la 009** (los scopes del login viven allí). A1: `scopes.md` con la tabla endpoint → scope de la referencia oficial. Q9 decidida por el humano: **estrechar todo** a `calendar.events.owned`, `calendar.freebusy` y `calendar.calendars.readonly` (ADR 0008; 009-C4, ADR 0005, ADR 0007 y notas de GOOGLE actualizados). A2: `scopes-verificados.spec.ts` (mitad automática de C8; `pasa` sigue en false hasta declarar los scopes en la consola). El servidor falso de Google del API ahora responde 403 si falta un scope aceptado por el endpoint. A3–A5: `justificaciones.md`, `video-guion.md`, `rondas-google.md` y `docs/google-verification-checklist.md` reescrito como única lista.
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, 396 + 480 + 37 unitarias, 160 de integración y 36 E2E). Comprobado que la prueba de C8 falla si se añade `profile` y que la integración falla con 403 si se quita `calendar.freebusy`.
- **Pendiente:** bloques H1 (dominio, Search Console), H2 (consola) y B (legales y landing), que dependen del humano, la 007 y la 009. Antes de H2, con una cuenta real: invitaciones con `calendar.events.owned` y scopes de identidad que añade Supabase.
- **Problemas:** en la 009 los avisos de `App.tsx` dicen «reconecta en Google Sync» aunque ya no hay botón «Conectar» (afecta al paso 7 del vídeo). Al cambiar de rama hay que recompilar `packages/shared` (`npm run build -w @student-os/shared`): si no, falla `GYM_PREFERENCE_RECORD_ID`.

## 2026-11-25 · Claude Code · feat/012-historial
- **Hecho:** vista mínima de historial en la tarjeta de quehaceres (`ChoresHistory`, plegada tras «Ver historial», solo lectura, 14 días y «Ver más»), con el nombre copiado en cada registro y etiqueta amable para los días difíciles. Cierra el criterio C11 de la spec 012 (`features.json`). PR apilado sobre la 009; no se fusiona antes de producción.
- **Verificación:** vitest web, `tsc -b`, lint y E2E 07 (9 pruebas, con `E2E_PORT_OFFSET=1300`); cada commit pasó `./scripts/check.sh --rapido` en el hook.
- **Pendiente:** nada propio; el PR espera a la 009.
- **Problemas:** un registro sin nada completado ni día difícil no se lista en el historial (decisión de diseño).

## 2026-11-25 · Claude Code · docs/tareas-fusion-hecha
- **Hecho:** el humano fusionó #12, #8, #13 y #14 a `main` en el orden recomendado, sin conflictos. Se verificó `main` (`ecd9ad5`) con `./scripts/check.sh` completo y puertos por defecto: todo en verde, incluidas las 14 E2E. Se añade a `TASKS.md` la nota A0 con el estado real (la que se escribió el día anterior llegó a la rama de #14 después de fusionarse y solo está en la rama de la 009).
- **Pendiente:** #9 (la 009 con la 010, la 011 y la 012 dentro) sigue en borrador **hasta que producción (007) esté lista**; decisiones abiertas del humano (012, specs 007 y 008); limpieza de ramas ya fusionadas con su confirmación. La rama de la 009 deberá incorporar `main` antes de fusionarse y **tendrá un conflicto previsible en `docs/TASKS.md` (la nota A0, versión antigua frente a esta)**: quedarse con esta versión.
- **Problemas:** ninguno nuevo.
- **Decisiones del 2026-11-25 y limpieza:** se borraron 4 worktrees y carpetas huérfanas, 24 ramas locales y 12 remotas ya fusionadas, y el directorio principal quedó limpio. 012: día sin registro = 0, historial sí (PR #17), sin red no se siembra. 007: vacía, dominio propio, ping con GitHub Actions, dos o más cuentas de prueba, criterios C6–C8 (PR #18). Siguen abiertos: dominio concreto, región, aprobar la 007 y Q1–Q10 de la 008.

## 2026-11-24 · Claude Code · docs/spec-007-produccion
- **Hecho:** spec 007 (producción) en borrador, partiendo de `origin/main`. Propone los criterios C6 a C8 (dos cuentas reales, sin secretos, respaldo de `GOOGLE_TOKEN_ENC_KEY`) y reparte qué hace el humano y qué prepara el agente. La spec 008 (verificación de Google) la redacta «agente 2» en su propia rama.
- **Pendiente:** tu aprobación de la spec; después, el plan y el script de verificación de solo lectura. Mientras tanto A3 y A4 siguen siendo las acciones del humano que bloquean la 009.
- **Problemas:** `.env.example` está bloqueado para lectura por `.claude/settings.json` (M4 de `TASKS.md`), así que las variables salen de `env.schema.ts` y `render.yaml`.

## 2026-11-24 · Claude Code · feat/012-quehaceres-diarios
- **Hecho:** 012 implementada por pasos con sub-agentes: contrato (`chores.ts` en shared, kinds `chore`/`choreDay`/`choreSettings` dentro de la colección `calendar`, sin migración), adaptador de sync, lógica pura (`utils/chores.ts`), hook `useChores`, `ChoresCard`, `ChoresEditor`, `ChoresChart` y E2E `07-quehaceres`. Una revisión independiente encontró 2 bloqueantes (foco robado por el editor y documentos sin cerrar) y 4 recomendados (re-render de App por el store de sync, esqueleto sin fin sin red, datos dañados, gráfica en ceros); se corrigieron con una prueba que reproduce cada fallo.
- **Verificación:** hook de cada commit (lint, tipos, unitarias, integración del API) con `E2E_PORT_OFFSET`; 450 pruebas de la web; E2E `03`, `04`, `05-calendario`, `05-gym-opcional` y `07-quehaceres` pasan (con puertos desplazados temporalmente). **No corrí `./scripts/check.sh` completo ni las E2E `01` y `02`** (puertos fijos ocupados por otras sesiones hasta fusionar el PR #12). El diseño se vio en capturas solo en tema oscuro.
- **Pendiente:** fusionar #12 y repetir la verificación completa; decisiones del humano (día sin registro, vista de historial, siembra sin red); C11 solo a nivel de datos; fusionar **después de la 009** (la 012 va apilada sobre ella).
- **Problemas:** dos pruebas del sub-agente se reescribieron porque afirmaban lo contrario del C13 (gráfica en ceros). Al editar, las entradas inválidas se descartan del estado (los datos de una versión futura que no cumplan el esquema actual se perderían).

## 2026-11-24 · Claude Code · feat/010-entorno-de-trabajo-por-usuario (implementación)
- **Hecho:** pasos 1 a 6 del plan. `emptyAppState` (cuenta nueva vacía), guías con `EmptyHint`, aviso visible de límite y de cambios rechazados, `syncStore.flushPending` (zona protegida, con tu permiso) y cierre de sesión que sube antes de salir o avisa. E2E `06-cerrar-sesion` (comprobado que falla sin la subida) y `03`/`04` adaptadas al estado vacío.
- **Defecto real que cazó la E2E:** sin red, `signOut` dejaba la sesión guardada y la app la volvía a adoptar (no se podía salir). Ahora cae al cierre local.
- **Verificación:** `./scripts/check.sh` completo pasa: 381 unitarias del API, 35 de shared, 321 del frontend, 151 de integración y 22 E2E.
- **Pendiente:** C1 es manual (dos cuentas reales en producción: 007 y 008). Mover `initialData` a fixtures. **No fusionar antes de la 009 ni de producción.**
- **Problemas:** C5 pide guía en Aprendizaje y hábitos: la de Aprendizaje es solo texto y no tiene aserción E2E; hábitos usa valores por defecto. `docs/rules/frontend.md` línea 24 sigue citando excepciones de `localStorage` ya resueltas (necesita tu permiso).

## 2026-11-24 · Claude Code · feat/010-entorno-de-trabajo-por-usuario (spec)
- **Hecho:** spec 010 redactada (10 criterios; C3, C4 y C10 ya los cubren la 009 y las pruebas del API) y `features.json` en estado `spec`. Decisiones del humano: cuenta nueva **vacía con guía**, **subir antes de cerrar sesión** (con tiempo máximo y aviso sin red) y **avisar claro al llegar al límite** (5000 registros, 64 KB) sin subirlo.
- **Hecho también:** spec aprobada y `plan.md` escrito (7 pasos, sin migraciones ni dependencias; los cambios son solo de la web).
- **Pendiente:** que apruebes el plan, en especial el permiso para añadir `flushPending` a `sync/syncStore.ts` (zona protegida), los textos de las guías y `career` por defecto. La rama parte de la 009 (PR #9, sin fusionar) y puede chocar con la 011 en `GymTracker`.
- **Problemas:** C1 es manual y necesita producción (007) y la verificación de Google (008).

## 2026-11-24 · Claude Code · feat/011-gym-opcional
- **Hecho:** specs 011 (gym opcional) y 012 (quehaceres diarios) con su plan; la 011 implementada: contrato (`gymDisabled`, registro `preference` en la colección `gym`), adaptador de sync, aislamiento en el API, estado en `App.tsx`, navegación, resumen y agregado rápido sin gym, botón «No voy al gimnasio» (asistente, pestaña y resumen) y «Reactivar». Rebasada sobre la 009. Sin migración ni dependencias nuevas.
- **Revisión (skill `revisor`):** 2 bloqueantes corregidos (la pestaña Gym del agregado rápido y la pantalla vacía si un aviso abría Gym estando desactivado). Pendiente de tu visto bueno: el cambio en `sync/adapters/gym.ts` (zona protegida).
- **Verificación:** tipos, lint y unitarias pasan (vitest web, `shared`, 383 del API); E2E: `05-gym-opcional` (6), `03`, `04` y `05-calendario` pasan; `01` y `02` pasaron tras el rebase y antes de las dos correcciones. La corrida final con `./scripts/check.sh` completo no pude hacerla: otra sesión mantenía un stack E2E en los puertos fijos 54340–54343, 3100 y 5293/5294 (corrí mis E2E con un desplazamiento de puertos temporal, ya revertido).
- **Pendiente:** correr `./scripts/check.sh` completo cuando el stack quede libre; fusionar **después de la 009**; la 012 espera la aprobación de su plan.
- **Problemas:** los puertos del E2E están escritos a fuego en 3 sitios (`config.mjs`, `harness.ts` y las E2E 01/02): dos sesiones no pueden correr E2E a la vez. Valorar un desplazamiento por variable de entorno.

## 2026-11-24 · Claude Code · feat/009-login-google-calendar-automatico (pasos 5b a 8)
- **Hecho:** 5b `1ac122c` (sin botones Conectar/Desvincular), 5c `1d477f1` (importador retirado; el motor descarta lo ajeno y, con la nube vacía, sube el estado de una cuenta nueva), 5d (transporte de Google Identity Services, `googleCalendar.gis.test.ts` y la prueba de firmas actualizada, que ahora vigila que lo retirado no vuelva), 5e (`useLocalStorage` y `localStorage` directo fuera; `clearLegacyLocalData`; estado de cuenta nueva = partida sin bloques de ejemplo y con el nombre de Google), aviso en el modal de que los datos locales se eliminan, E2E `05-calendario` (C7, C8), ADR 0007 y documentación (001 `obsoleta`, 009 `revision`).
- **Fallos reales que cazaron las pruebas:** (1) en el primer acceso de un dispositivo los eventos de Google tardaban hasta 45 s en aparecer porque la carga inicial se decidía antes de saber que Calendar estaba vinculado (corregido en `App.tsx`); (2) la nube vacía sin subir el estado dejaba dos dispositivos con datos distintos.
- **Verificación:** 291 pruebas del frontend, tipos, lint, integración del API y E2E (01 a 05) en verde; falta el `check.sh` completo y la revisión del paso 9.
- **Pendiente:** paso 9 (`check.sh`, skill `revisor`, PR), volcar cambios antes de cerrar sesión, decidir qué ve una cuenta nueva (aún recibe Kanban, entregas y gym de ejemplo; es la spec 010), quitar `VITE_GOOGLE_CLIENT_ID`. **No fusionar antes de producción (007).**
- **Problemas:** C8 se verifica por E2E con el turno y un bloque; el gym usa la misma función (`upsertGoogleGymEvent`, probada por unidad) pero no tiene E2E propia. C12 es manual. `docs/rules/frontend.md` línea 24 cita excepciones de `localStorage` ya resueltas: es una regla, no la toqué sin tu permiso. El onboarding de gym del primer acceso ya no se abre (la spec 011 lo vuelve opcional).

## 2026-11-24 · Claude Code · feat/009-login-google-calendar-automatico (paso 5a)
- **Hecho:** `80af0db`. El modal pasa a un único «Continuar con Google»; la landing quita registro, demo y «100 % offline» (afirmaciones que dejaron de ser ciertas); `App.tsx` ya no se fía de la sesión local sobrante (C2) y el cierre de sesión espera a `signOut` (**BUG-01 corregido**, se quitó el `test.fail` del caso 2c). `features.json`: 002-C4 y 009 (C1, C2, C3, C4, C5, C9, C10, C13) en `pasa: true`.
- **Fallos reales que cazaron las pruebas:** (1) una sesión local sobrante abría la app sin login; (2) `supabase-js` emite `SIGNED_IN` dos veces y el segundo enlace pisaba el motivo real del error.
- **Verificación:** 311 pruebas del frontend, tipos, lint y E2E de login (5/5), landing (3/3), importador y dos dispositivos en verde.
- **Pendiente:** 5b botón Conectar/Desvincular, 5c importador (zona protegida), 5d transporte GIS y prueba de firmas, 5e modo local y limpieza de datos (C11 herencia, C14), onboarding de gym y nombre en el primer acceso, E2E 03, ADR 0007 y revisión. **No fusionar antes de producción (007).**
- **Problemas:** hay edits ajenos sin commitear en `docs/TASKS.md` (pedidos P1 «gym opcional» y P2 «quehaceres», fechados 2026-11-23); no son míos y no los incluí. Con el modo local fuera, el primer acceso ya no abre el onboarding de gym ni fija el nombre (lo hacía `onAuthSuccess`).

## 2026-11-24 · Claude Code · feat/009-login-google-calendar-automatico (implementación, pasos 1 a 4)
- **Hecho:** `955d97c` (viabilidad + `POST /google/link-login`, 373 pruebas del API y 39 HTTP en verde) y `e96059a` (harness, login web con enlace automático, `storage` que elimina `provider_*`, aviso C9, E2E 2b y 2e). Se encontró y corrigió una carrera: el `getSession()` inicial marcaba la sesión como iniciada antes de terminar el enlace; la E2E 2e la detectó. Se rompió un ciclo de imports (`supabase.ts` ↔ `googleLogin.ts` ↔ `api.ts`) cargando `api` bajo demanda.
- **Verificación:** 305 pruebas del frontend, tipos y lint en verde; E2E `02-login` en verde (5 de 5, el 2c sigue siendo el fallo conocido BUG-01).
- **Pendiente:** pasos 5 a 9 del plan. **No fusionar antes de 007** (ver TASKS A1).
- **Problemas:** la landing tiene 3 componentes con «Explorar demo», «Ver demo» y «Crear cuenta» (`HeroSection`, `LandingNavbar`, `LandingFooter`) y un mockup clicable que entra al demo; todos pasan a un único «Continuar con Google» (C1). El proveedor Google de Supabase debe compartir cliente OAuth con el API.

## 2026-11-24 · Claude Code · feat/009-login-google-calendar-automatico (plan)
- **Hecho:** spec 009 aprobada (landing se mantiene, sin botón de desvincular, 001/003 y ADR 0004 obsoletos) y `plan.md` escrito con 9 pasos. Verificado en la documentación de Supabase que **no guarda los tokens del proveedor** y recomienda enviarlos a un servidor propio. `features.json` en estado `plan`.
- **Pendiente:** que apruebes el plan, en especial D1 (opción B recomendada) y la nueva redacción de C10. Luego empezar por el paso 1 (prueba de viabilidad).
- **Problemas:** el comportamiento real de Supabase y Google solo se confirma en producción (007 y 008). El criterio C12 es manual.

## 2026-11-24 · Claude Code · feat/009-login-google-calendar-automatico
- **Hecho:** análisis del login y del calendario y spec 009 en borrador (`docs/specs/009-…/spec.md`, 13 criterios, `features.json` en estado `spec`). Hallazgos: hoy hay tres caminos de entrada (Google por GIS, Google por Supabase y una cuenta local falsa); en Vercel solo existe `VITE_GOOGLE_CLIENT_ID`, así que producción funciona en modo GIS; el calendario ya es casi el mismo entorno que Google una vez conectado (los eventos se leen en vivo y gym, turno y bloques marcados se publican), y lo que falta es vincular sin botón en el login.
- **Decisiones del humano:** solo Google (sin registro, sin modo local, sin demo), mismos permisos de Calendar, Calendar obligatorio como parte del login (si lo desmarca no entra), datos locales del prototipo descartados (se retira el importador), sin botón de desvincular, calendario como hoy.
- **Pendiente:** que apruebes la spec y respondas 3 preguntas abiertas (landing pública, desvincular y verificación de Google, y dejar obsoletos 001, 003 y el ADR 0004); después `plan.md`.
- **Problemas:** el importador del primer inicio, el cifrado del token y el borrado de cuenta son zonas protegidas y esta spec los toca. Depende de 007 y 008.

## 2026-11-24 · Claude Code · docs/prioriza-pendientes
- **Hecho:** `docs/TASKS.md` reordenado por prioridad Alto/Medio/Bajo. Dos pendientes nuevos de prioridad Alta pedidos por el humano: **A1** login con Google para cualquier usuario y Calendar vinculado sin botón (funcionalidad 009, marcado importante) y **A2** entorno de trabajo por usuario (010). `features.json` con 009 y 010 y sus carpetas de spec. Verificado que el PR #7 está en `main` y que Vercel sirve la web en https://student-os-mocha-iota.vercel.app (HTTP 200).
- **Pendiente:** escribir las specs 009 y 010 con `spec-plan-code`. Producción (A3) y verificación de Google (A4) son prerrequisitos y van en paralelo.
- **Problemas:** la API no está desplegada, así que hoy el login y los datos por usuario no funcionan de verdad en producción; solo en local con servicios simulados. Posible riesgo al cambiar de cuenta en el mismo navegador (el importador podría ofrecer subir datos locales de otro usuario).

## 2026-11-24 · Claude Code · chore/puertos-pruebas-configurables
- **Hecho:** variable `E2E_PORT_OFFSET` (entero, por defecto 0) que desplaza todos los puertos fijos de las pruebas (integración del API y E2E) para poder correr varias sesiones a la vez. Fuente única en `apps/api/test/ports.cjs`; prueba `ports.e2e-spec.ts`; documentado en `docs/stack/backend.md` y `frontend.md`.
- **Verificación:** con `E2E_PORT_OFFSET=500`: `./scripts/check.sh --rapido` pasa, 14 E2E pasan y el hook de pre-commit pasa. Con offset 0 solo se comprobó que la lista de puertos es la original (prueba unitaria): los puertos 54329-54337 estaban ocupados por otras sesiones.
- **Pendiente:** nada. Cada sesión debe usar un offset distinto (separados al menos 20).
- **Problemas:** en Windows hay rangos de puertos reservados (`netsh int ipv4 show excludedportrange protocol=tcp`); un offset de 2000 cayó en uno y Postgres embebido falló sin mensaje.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 7, cierre)
- **Hecho:** ADR 0002, plan de adopción archivado en `docs/references/historial/`, `check.sh` completo (5 de 5, 169 s) y revisión con la skill `revisor`. Correcciones de la revisión: permisos de ejecución (`100755`) en scripts y hooks, `.gitattributes` con LF para scripts, `.claude/skills/` ignorado como directorio y rutas corregidas.
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, unitarias, integración del API y 14 E2E).
- **Pendiente:** que el humano revise y haga merge del PR; decidir qué hacer con el `deny` de `.env.*` (bloquea leer `.env.example`); enlace simbólico de skills; prioridades de `docs/TASKS.md` (producción primero).
- **Problemas:** ninguno bloqueante.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 6)
- **Hecho:** `docs/features.json` con 8 funcionalidades (001–006 existentes con `pasa: true` solo donde una prueba que pasa lo respalda; 007 producción y 008 verificación de Google pendientes). `memories.md`, `PLAN.md` y `PLAN_BACKEND.md` archivados con `git mv` en `docs/references/historial/` (`memories.md` con aviso de archivado). Carpetas de spec para 007 y 008. `TASKS.md` reordenado por tu prioridad: producción, verificación de Google, BUG-01, `localStorage` directo, deuda.
- **Pendiente:** Fase 7 (ADR 0002, `check.sh` completo, skill `revisor`, PR). Las specs de 007 y 008 se escriben con `spec-plan-code`.
- **Problemas:** `PRODUCT.md` y varios comentarios de código siguen citando `memories.md`; quedó en `TASKS.md`. El estado `en_curso` de la funcionalidad 002 depende del BUG-01.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 5)
- **Hecho:** skills conectadas: `frontend-proyecto` (`ui-ux-pro-max`, `frontend-design`, `design-taste-frontend` solo para landing), `pruebas-proyecto` (`playwright-best-practices`, con la nota del stack simulado), `backend-proyecto` (ninguna, decisión del humano). `AGENTS.md` lista `github-workflow-standards`, `grill-me` y `find-skills`. La skill de flujo de GitHub lleva una nota: commits en español.
- **Pendiente:** Fase 6 (`features.json`, `TASKS.md`, qué hacer con `memories.md`) y Fase 7 (cierre, ADR 0002, PR).
- **Problemas:** `design-taste-frontend` es para sitios de marketing; si se usa en la app interna puede chocar con la identidad de `PRODUCT.md`.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fase 4)
- **Hecho:** reglas: `general.md` (commits en español, PR por la skill), `security.md` (exportar/borrar cuenta, RLS, tokens de Google, límites por usuario, logs sin PII), `testing.md` (`test.fail` solo con bug en TASKS; lección sobre verificar el código de salida), convenciones «(observado)» en `backend.md` y `frontend.md`; ADRs 0003 a 0006.
- **Pendiente:** que confirmes las convenciones observadas y los ADRs. Fase 5 (skills), Fase 6 (backlog), Fase 7 (cierre y PR).
- **Problemas:** la skill `github-workflow-standards` y `memories.md` aún dicen «commits en inglés»; la regla de `general.md` manda sobre ellas. En modo nube, 4 componentes guardan en `localStorage` sin pasar por el sync.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fases 2 y 3)
- **Hecho:** Fase 2 (`PROJECT.md`: producto público, prototipo, alcance, zonas protegidas, glosario) y Fase 3 (despliegue y mapa de pruebas confirmados; `apps/web`, `apps/api` y `packages/shared` con su `AGENTS.md`; `rules/testing.md` adaptado a `apps/api/test` y `apps/web/e2e`).
- **Pendiente:** Fase 4 (reglas: unificar commits/PR de `memories.md` con `rules/general.md`, seguridad y ADRs), Fase 5 (skills), Fase 6 (backlog), Fase 7 (cierre y PR).
- **Problemas:** el glosario de `PROJECT.md` está deducido, falta tu revisión.

## 2026-11-23 · Claude Code · chore/adopt-agent-harness (Fases 0 y 1)
- **Hecho:** Fase 0 (decisiones de instalación) y Fase 1 (exploración y borrador técnico): `docs/stack/*`, `ARCHITECTURE.md`, comandos de `AGENTS.md`, `scripts/check.sh` e `init.sh`. Antes, PR #6 fusionado en `main` y Vercel corregido (Root Directory `apps/web`).
- **Verificación:** `./scripts/check.sh` completo pasa (lint, tipos, 361+288+35 unitarias, integración del API y 14 E2E; 164 s).
- **Pendiente:** Fase 2 (producto → `PROJECT.md`) y Fase 3 (confirmar arquitectura y stack con el humano). Enlace simbólico de skills a la espera del Modo desarrollador.
- **Problemas:** BUG-01 (logout), la E2E ensucia `docs/qa/evidence`, módulos vacíos en el API. Todo en `docs/TASKS.md`.

## Inicio
- **Hecho:** plantilla de harness creada.
- **Pendiente:** ejecutar `./init.sh` y la skill `init-stack`.
