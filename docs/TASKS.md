# Tareas

> El agente lee esto al empezar cada sesión y lo actualiza al terminar.
> Las funcionalidades grandes viven en `docs/features.json`; aquí van las tareas concretas.
> Prioridad: **Alto** (bloquea que el producto sea público o que los datos de un usuario estén a salvo), **Medio** (afecta a la calidad o a un flujo, pero hay alternativa) y **Bajo** (limpieza y deuda). Calificada por el agente el 2026-11-23 a partir de lo que pediste; corrígela si no coincide.

## En curso
- [ ] **Spec 010 en revisión** (rama `feat/010-entorno-de-trabajo-por-usuario`, PR apilado sobre la 009): C2 y C5 a C9 con prueba; C1 es manual y espera a producción (A3) y a la verificación de Google (A4).
- [ ] **Spec 009 en revisión** (rama `feat/009-login-google-calendar-automatico`, sin subir) · agente + humano. Código completo; falta la revisión final y el PR. **No fusionar hasta que producción (A3) esté configurada.**

## Pendiente

### ⭐ Pedidos por el humano (2026-11-23) · van antes que el resto

#### P1 · Poder decir «no voy al gimnasio» sin rellenar nada del gym
Objetivo del humano: que completar la información del gimnasio **no sea obligatorio**. Tiene que haber un botón/opción visible para indicar que no se va al gym (y que la app deje de pedir esos datos).
- **Dónde mirar:** `apps/web/src/components/dashboard/DailyHabitsCard.tsx`, `GymTracker`, `apps/web/src/utils/gym*.ts` (horario, asistencia, sincronización con Calendar) y `apps/web/src/sync/adapters/gym.ts`.
- **Falta:**
  - **Decisión del humano (2026-11-23):** la opción **oculta todo el módulo de gym** (dashboard, calendario y hábitos) y se puede reactivar desde ajustes.
  - [ ] Que sin datos de gym no se publiquen bloques de gym en Google Calendar ni se calcule asistencia.
  - [ ] Que la elección se guarde por usuario (sync) y se pueda revertir.
  - [ ] Pruebas unitarias y E2E.
- [x] Spec escrita en `docs/specs/011-gym-opcional/spec.md` (rama `feat/011-gym-opcional`, creada desde la 009 porque ambas tocan `App.tsx`). Spec aprobada por delegación (2026-11-24) con las decisiones recomendadas. Plan aprobado (2026-11-24). **Pasos 1 a 8 hechos** (revisión incluida, C5 cubierto); falta el visto bueno del cambio en el sync, la corrida completa de `check.sh` y fusionar después de la 009. ⚠️ **Antes del PR:** el `AGENTS.md` ahora marca `apps/web/src/sync/` como zona protegida y esta rama cambió `sync/adapters/gym.ts` (+34 líneas: proyecta `gymDisabled` como registro `preference`) y su prueba. El cambio es aditivo y está probado, pero hace falta tu visto bueno explícito. Sin migración ni dependencias nuevas; se fusiona después de la 009

#### P2 · Quehaceres cotidianos en la pantalla principal con meta diaria, motivación e historial
Objetivo del humano: en la pantalla principal, una lista de tareas cotidianas (tender la cama, darle de comer al perro, sacarlo a pasear, caminar 15 minutos, ir al mercado…) con una **meta diaria** (ejemplo: 5 quehaceres = «eres lo máximo», 10 = «sigue así») que dé motivación; el resultado de cada día se **guarda en un historial** para ver qué días rindió más o menos; y una opción **«hoy no puedo / estoy agobiado»** que también se registra.
- **Relación con lo existente:** ya hay `DailyHabitsCard` (hábitos diarios, con `localStorage` directo, ver M2). Decidir si los quehaceres lo amplían o son otra tarjeta.
- **Decisiones del humano (2026-11-23):**
  - Quehaceres: **lista base editable** (con ejemplos) **y** el usuario puede crear los suyos.
  - Frecuencia: **cada quehacer elige sus días de la semana** (p. ej. mercado solo el sábado).
  - Meta diaria: **niveles por cantidad**; por defecto 5 = «¡Eres lo máximo!» y 10 = «¡Sigue así!», con umbrales y mensajes editables.
  - «Hoy no puedo / estoy agobiado»: **día de descanso que no penaliza**; se guarda como «día difícil» en el historial, sin contar como fallo, con mensaje amable.
  - Historial: **gráfica semanal** para ver en qué día de la semana se hace más. Todo se guarda por usuario (sync).
- **Falta:** confirmar con el humano la spec antes de implementar.
- [x] Spec 012 aprobada (lista base: tender la cama, pasear al perro, ducharme, limpiar mi cuarto y proyectos de IA) y plan aprobado. **Implementada** en `feat/012-quehaceres-diarios`: contrato, sync, lógica, tarjeta, editor, gráfica semanal, revisión independiente corregida y E2E `07-quehaceres`. **14 de 15 criterios cumplidos; el C11 solo a nivel de datos** (el nombre se guarda en el historial, pero ninguna pantalla muestra días pasados). Decisiones tuyas pendientes: qué cuenta un día sin registro (hoy cuenta 0 en el promedio), si se añade una vista de historial, y si una cuenta sin red debe sembrar la lista base localmente. Toca `apps/web/src/sync/adapters/calendar.ts` (zona protegida, aditivo, incluido en el plan aprobado).

### 🔴 Alto

#### A0 · Fusionar los PRs pendientes a `main` · lo hace el humano (parte 1 hecha el 2026-11-25)
El `AGENTS.md` prohíbe que el agente haga merge a `main`: estos pasos son de la persona.
- [x] **Hecho el 2026-11-25:** #12, #8, #13 y #14 fusionados a `main` con merge commit, sin conflictos (`main` en `ecd9ad5`). Verificación completa de `./scripts/check.sh` sobre `main` con los puertos por defecto: lint, tipos, 368 + 288 + 35 unitarias, 152 de integración y 14 E2E, todo en verde (confirma que `E2E_PORT_OFFSET` con valor 0 no cambia nada).
- [ ] **No fusionar #9** (la 009, que ya lleva dentro el gym opcional, los datos por usuario y los quehaceres diarios) hasta que producción (A3) esté lista: sigue en borrador a propósito. Antes de fusionarlo, pasarlo a «Ready for review», incorporar `main` en su rama y confirmar que sus checks están en verde.
- [ ] Borrar las ramas remotas ya fusionadas (`chore/adopt-agent-harness`, `feat/agent-1-university-kanban`, `feat/agent-2-gym-calendar-dashboard`, `feat/student-os-core-hub`, `feat/ui-taste-foundation`, `integration/backend`, y ahora también `chore/puertos-pruebas-configurables`, `docs/prioriza-pendientes`, `docs/spec-007-produccion`, `docs/spec-008-verificacion-google`) y las obsoletas (`feat/011-gym-opcional`, `feat/overview-summary`) **solo con confirmación del humano**. Hacer `git pull` en los worktrees locales desfasados (`student-os-008`, `student-os-011` y el directorio principal).
- [ ] Limpiar lo que dejaron los agentes: un Postgres de pruebas huérfano (procesos 33604 y 36648, puerto 55395; ya no aparecen ocupando puertos) y la carpeta `C:\Users\Sergio Suarez\Projects\student-os-int-009`.
- [x] **Decisiones tomadas el 2026-11-25:** 012: un día sin registro **cuenta como 0** en el promedio (se mantiene), se **añade una vista de historial** (hecha en el PR #17, apilado sobre la 009) y sin red **no se siembra** la lista base. 007: `student-os-prod` **empieza vacía**, **dominio propio**, ping con **GitHub Actions**, el humano tiene **dos o más cuentas de Google**, y se aprueban los criterios C6–C8 (PR #18).
- [ ] Decisiones del humano que siguen abiertas: **dominio propio concreto** y su DNS, **región** de Supabase y Render, **aprobar la spec 007** para pasar a su plan; las Q1–Q10 de la spec 008 (varias dependen del dominio y de los datos legales); y confirmar que sembrar los quehaceres cuente como «cambios sin subir» al cerrar sesión (aserciones 6b y 6d de la E2E `06-cerrar-sesion`).

#### A1 · ⭐ IMPORTANTE · Login con Google para cualquier usuario y Calendar vinculado automáticamente (funcionalidad 009)
Objetivo del humano: que **cualquier persona** entre con su cuenta de Google y que su Google Calendar quede **ya vinculado, sin pulsar ningún botón «Conectar»**.
- **Hoy:** el login usa Supabase Auth con Google (`apps/web/src/services/supabase.ts`). Vincular Calendar es **otro flujo aparte** que exige pulsar «Conectar» en `GoogleCalendarSyncModal` (`POST /google/connect`, PKCE, refresh token cifrado en el servidor). Además la web en producción **no tiene API desplegada**, así que el login con la nube no funciona de verdad todavía.
- **Falta:**
  - [ ] Abrir el login a cualquier cuenta de Google. Hoy está limitado a 100 usuarios de prueba y mostraría «app no verificada». Depende de **A4 (verificación de Google)**.
  - [ ] Configurar el proveedor Google en Supabase de producción (credenciales, URLs de redirección y orígenes autorizados). Depende de **A3 (producción)**.
  - [ ] Vincular Calendar en el propio login: pedir los permisos de Calendar en el mismo consentimiento y guardar el refresh token en el servidor al terminar, sin segundo paso. Decisión técnica pendiente (spec 009): Supabase no conserva el refresh token del proveedor, así que hace falta un flujo propio. **Es zona protegida** (claves de Google, ver `AGENTS.md`).
  - [ ] Si el usuario niega los permisos de Calendar, la app debe seguir funcionando y ofrecer vincularlo después.
  - [ ] Probarlo con Google y Supabase reales, no con los simulados (criterio C5 de la funcionalidad 002).
- **Decisiones del humano (2026-11-24):** login **estrictamente con Google** (se eliminan el registro con correo, el modo local y «Explorar demo»); permisos de Calendar los mismos de hoy (leer y crear/editar); **sin botón de desvincular**; el calendario se comporta como hoy (se lee todo de Google y se publican gym, turno de trabajo y los bloques marcados).
- **Más decisiones (2026-11-24):** Calendar forma parte del login y es **obligatorio** (si el usuario lo desmarca en la pantalla de Google, no entra); los datos locales del prototipo **se descartan** (sin importador).
- **Preguntas abiertas** (ver la spec): ¿se mantiene la landing pública?, ¿basta sin botón de desvincular para la verificación de Google?, y aprobar dejar obsoletos la funcionalidad 001, la 003 (importador) y el ADR 0004. Los permisos de Calendar son «sensibles» para Google y exigen verificación completa *(deducido; confirmar con `docs/google-verification-checklist.md`)*.
- [x] Spec aprobada por el humano el 2026-11-24 (`docs/specs/009-login-google-para-todos-y-calendar-automatico/spec.md`)
- [x] Plan escrito (`plan.md`), **a la espera de tu aprobación**: decisión técnica D1 (cómo llega el refresh token al servidor; recomendada la opción B), relajar C10, actualizar la prueba que congela las firmas de `googleCalendar.ts` y añadir el estado `obsoleta` a `features.json`
- [x] Plan aprobado el 2026-11-24 (D1 = opción B; C10 relajado a «nunca persistente»; estado `obsoleta` añadido a `features.json`)
- [x] **Pasos 1 a 4 del plan hechos** en `feat/009-login-google-calendar-automatico`: prueba de viabilidad (`docs/references/frontend/supabase-provider-tokens.md`), `POST /google/link-login`, harness (Supabase y Google falsos) y login web con enlace automático, storage que no persiste el token y aviso si falta Calendar (C4, C5, C9 y C10 cubiertos con pruebas unitarias, de integración y E2E)
- [x] **Pasos 5 a 8 hechos:** retiradas la cuenta local, la demo, el botón Conectar y el de desvincular, el importador, el transporte de Google Identity Services y el modo local; `App.tsx` solo con sesión y BUG-01 corregido; E2E `01` a `05` (C7 y C8 cubiertos); ADR 0007 y documentación actualizada
- [ ] **Paso 9 pendiente:** `./scripts/check.sh` completo, skill `revisor` y PR. Quedan sin cumplir C12 (manual, necesita producción y la verificación de Google)
- ⚠️ **No fusionar esta rama hasta que producción (A3) esté configurada:** hoy Vercel no tiene variables de Supabase y la web funciona con el login antiguo (GIS). Al retirarlo, sin Supabase en producción nadie podría entrar. Además el proveedor Google de Supabase debe usar el **mismo client id y secret** que el API (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

#### A2 · Entorno de trabajo por usuario: cada uno guarda sus propios datos (funcionalidad 010)
Objetivo del humano: que cada usuario tenga su espacio y se guarden **por usuario** sus tareas pendientes y demás datos.
- **Ya existe en el código:** cada registro se guarda con `(userId, collection, id)`, el `userId` sale del JWT (nunca del body), hay RLS en Supabase y pruebas de aislamiento entre dos usuarios (`apps/api/test/*.e2e-spec.ts`). **Pero solo está probado en local con servicios simulados: en producción todavía no guarda nada por usuario** (la API no está desplegada).
- **Falta:**
  - [ ] Desplegarlo y comprobar con **dos cuentas reales distintas** que cada una ve solo lo suyo (depende de A3).
  - [ ] Los 4 componentes que usan `localStorage` directo (`AuthModal`, `BackupModal`, `DailyHabitsCard`, `GymTracker`) no sincronizan en modo nube: hábitos y gym podrían quedarse en el navegador y no «seguir» al usuario a otro dispositivo (ver M2).
  - [ ] **Riesgo a analizar:** si el usuario A cierra sesión y el B entra en el mismo navegador, el importador del primer inicio podría ofrecer subir los datos locales de A a la cuenta de B. Decidir qué pasa con el estado local al cambiar de cuenta.
  - [ ] Definir qué ve un usuario nuevo (estado vacío o datos de ejemplo) y los límites por cuenta (hoy 5000 registros y 64 KB por registro).
- [x] Spec escrita en `docs/specs/010-entorno-de-trabajo-por-usuario/spec.md` (rama `feat/010-entorno-de-trabajo-por-usuario`, **aprobada**; `plan.md` escrito, **a la espera de tu aprobación**). Decisiones tuyas del 2026-11-24: cuenta nueva vacía con guía, subir antes de cerrar sesión y avisar al llegar al límite sin subirlo. Los puntos de `localStorage` directo y del cambio de cuenta ya los cubre la 009.

#### A3 · Producción: `student-os-prod`, variables y API desplegada (funcionalidad 007)
Prerrequisito de A1 y A2. Acciones del humano, necesitan credenciales.
- [ ] Migrar la base a `student-os-prod` y aplicar `apps/api/prisma/migrations/` a mano, y luego `prisma/rls-baseline.sql`
- [ ] Variables de producción en Vercel (`VITE_*`) y Render (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS`, `GOOGLE_*`)
- [ ] Desplegar la API en Render y verificar `/health`
- [ ] Ping programado contra la pausa de Supabase a los 7 días
- [x] Spec escrita en `docs/specs/007-produccion-student-os-prod/spec.md` (borrador, rama `docs/spec-007-produccion`): **a la espera de tu aprobación**; propone los criterios C6–C8 y deja 6 preguntas abiertas. El agente no toca producción: prepara la receta y la verificación

#### A4 · Verificación de la app en Google (funcionalidad 008)
Prerrequisito de A1: sin ella el login no es «para todos».
- [ ] Completar `docs/google-verification-checklist.md` en Google Cloud Console (lo hace el humano)
- [x] Escribir la spec en `docs/specs/008-verificacion-app-google/spec.md` (aprobada el 2026-11-24)
- [x] Plan aprobado el 2026-11-25 y **bloque A hecho** (rama `feat/008-verificacion-app-google`, apilada sobre la 009): `scopes.md`, prueba `scopes-verificados.spec.ts`, `justificaciones.md`, `video-guion.md`, `rondas-google.md` y checklist reescrito.
- [x] Q9 decidida: **scopes estrechos** (`calendar.events.owned`, `calendar.freebusy`, `calendar.calendars.readonly`), ADR 0008.
- [x] **Hallazgo de la revisión del PR #19 (2026-11-26):** la app no usaba `calendar.freebusy` (`freebusy.query` solo se llamaba desde pruebas; los huecos salen de `events.list`) ni `calendar.calendars.readonly` (nada rellenaba el nombre del calendario). **Decisión (delegada por el humano, 2026-11-26): pedir solo `openid`, `email` y `calendar.events.owned`.** Código muerto retirado, fuente única `VERIFIED_GOOGLE_CALENDAR_SCOPES` en `@student-os/shared` con prueba-candado en web y API, y docs al día (ADR 0008 «Revisión 2026-11-26», `scopes.md`, `justificaciones.md`, `video-guion.md`, 009-C4, checklist).
- [ ] Antes de declarar los scopes en la consola (H2), con una cuenta real: comprobar que `calendar.events.owned` devuelve los eventos de invitaciones (ahora es el único scope de lectura; si no, hay que pasar a uno más amplio y decidir de nuevo) y qué scopes de identidad añade Supabase (¿`profile`?).
- [ ] Revisar tras la 009 el paso 6 del guion (antes 7; se renumeró el 2026-11-26): los avisos de `App.tsx` dicen «reconecta en Google Sync», pero la 009 quitó el botón «Conectar».

> **Orden de ejecución sugerido:** A3 (producción) y A4 (verificación, que tarda semanas) **en paralelo y cuanto antes**; después A1 y A2, que se pueden desarrollar ya con servicios simulados y se validan al final contra producción.

### 🟡 Medio

- [x] **M1 · BUG-01:** corregido en la spec 009 (`handleLogout` espera a `signOut()` antes de volver a la landing); la E2E 2c ya no lleva `test.fail`.
- [x] **M2 · `localStorage` directo:** resuelto en la spec 009 (paso 5e): `AuthModal` se reescribió y `BackupModal`, `DailyHabitsCard` y `GymTracker` ya pasan siempre por `App`. Falta quitar la excepción de `docs/rules/frontend.md` (línea 24), que es una regla y necesita tu permiso.
- [ ] **M6 · Reabrir sin red tras perder IndexedDB:** el motor descarta `localStorage` cuando el documento de sync de la cuenta no está arrancado en el navegador (regla de la spec 009). Si el navegador borró IndexedDB, o está en memoria (modo privado restrictivo), una recarga **sin red** muestra el estado de una cuenta nueva en vez de la última caché hasta recuperar la conexión. Valorar conservar la caché cuando `localStorage` guarda el id de la cuenta que está entrando.
- [ ] **M3 · E2E en el CI:** el CI no ejecuta la E2E (solo build, lint y tests unitarios de los tres paquetes). Valorar un job de E2E.
- [ ] **M4 · `.claude/settings.json`** deniega `Read(./.env.*)` y eso bloquea también leer `.env.example`, que el harness pide mantener al día. Decidir: listar solo los `.env` con secretos (`.env`, `.env.local`, `.env.production`…) o aceptar la limitación.
- [ ] **M5 · Revisar lo deducido:** las convenciones «(observado)» de `docs/rules/backend.md` y `frontend.md`, el glosario de `PROJECT.md` y los ADRs 0004 a 0006 salen del código y de las notas de los agentes, no de una decisión tuya.

### 🟢 Bajo
- [ ] Crear el enlace simbólico `.claude/skills → ../.agents/skills` (requiere activar el Modo desarrollador de Windows). Hoy es una copia sin versionar que hay que resincronizar a mano tras tocar una skill.
- [ ] El hook `.claude/hooks/guard.sh` da un falso positivo si el texto del comando contiene «git … push … main» (por ejemplo en el cuerpo de un PR). Afinar el regex.
- [x] **Volcar los cambios pendientes antes de cerrar sesión:** hecho en la spec 010 (`syncStore.flushPending`, máximo 5 s, aviso si no se puede).
- [ ] **Quitar `VITE_GOOGLE_CLIENT_ID`** de Vercel y de `.env.example` (la web ya no la usa; `.env.example` está bloqueado por el hook, ver M4).
- [ ] **E2E y worktrees:** el harness E2E usa puertos fijos (54340-54343, 3100, 5293, 5294). Dos sesiones que lo ejecuten a la vez desde worktrees distintos se pisan (caídas a mitad de corrida y pruebas contra el código del otro worktree). Hacer los puertos configurables o detectar el conflicto con un mensaje claro.
- [ ] `apps/web/src/data/initialData.ts` ya solo lo usan las pruebas (la app parte de `emptyAppState`): moverlo a fixtures de pruebas.
- [ ] El aviso de «Cerrar sesión» no se actualiza si la sync termina mientras está abierto; la guía de Aprendizaje no tiene aserción E2E.
- [ ] Los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son controladores vacíos de 6 líneas (el dato viaja por `/sync`). Decidir: eliminarlos o rellenarlos.
- [ ] Bundle web de ~1 MB (aviso de Vite sobre chunks > 500 kB): evaluar `import()` dinámico.
- [ ] 4 avisos de oxlint en `apps/web` (`LearningView.tsx` ×3, `App.tsx:205`).
- [ ] `./scripts/check.sh` (E2E) reescribe los JPG versionados de `docs/qa/evidence/` y ensucia el árbol de git. Dirigir la salida a una carpeta ignorada o dejar de versionar esas imágenes.
- [ ] Versiones de Node dispares: `engines >=20`, CI en 20, Render en 22, Vercel en 26.x. Unificarlas. Síntoma ya visto (2026-11-26): en el CI (Node 20) el reporter de vitest se rompe con «Map.groupBy is not a function» (`Map.groupBy` llega en Node 21).
- [ ] **Prueba frágil:** `apps/web/src/components/calendar/GoogleCalendarSyncModal.test.tsx` (existe en `main`) («si Google no confirma la revocacion…») falló una vez en el job Web del PR #18 (que solo cambia docs) y pasó al relanzarla (2026-11-26). La 009 elimina ese flujo de desconectar; si sobrevive, estabilizarla (espera explícita en vez de temporizador).
- [ ] TypeScript distinto entre paquetes: web `~7.0.2`, api `^5.9`.
- [ ] `pre-commit` tarda ~50 s (decidido mantenerlo; revisar si molesta).
- [ ] `docs/qa/BUGS.md` está citado en el test 2c pero **no existe**: recrearlo o quitar la referencia.
- [ ] Ramas remotas ya fusionadas que se pueden borrar: `feat/agent-1-university-kanban`, `feat/agent-2-gym-calendar-dashboard`, `feat/student-os-core-hub`, `feat/ui-taste-foundation`, `integration/backend`, `chore/adopt-agent-harness`. `feat/overview-summary` se fusionó con squash en el PR #5: confirmar y borrar.
- [ ] Archivos de instrucciones antiguas en la raíz (`AGENT_WT1_INSTRUCTIONS.md` … `AGENT_WT4_*`, `AGENT_WT1_AUDIT_*`, `AGENT_WT2_AUDIT_*`): archivarlos en `docs/references/historial/` o borrarlos.
- [ ] Comentarios de código y `PRODUCT.md` (línea 47) que aún citan `memories.md` y `PLAN_BACKEND.md`: actualizar la ruta.

## Bloqueado
- [ ] Enlace simbólico de skills · Windows exige Modo desarrollador o administrador · que el humano lo active

## Hecho
- 2026-11-24 · Spec 009 implementada en `feat/009-login-google-calendar-automatico` (pasos 1 a 8): login solo con Google con Calendar vinculado, sin modo local ni importador; pendiente de revisión y de producción para fusionar
- 2026-11-24 · PR #7 fusionado: harness de agentes adoptado en `main` y desplegado en Vercel (web en modo local; sin API en producción)
- 2026-11-23 · Fase 6: `features.json` poblado, `memories.md` y los planes archivados en `docs/references/historial/`, carpetas de spec, prioridades
- 2026-11-23 · Fases 0 a 5 de la adopción del harness (instalación, borrador técnico, producto, arquitectura, reglas, skills) y ADRs 0002 a 0006
- 2026-11-23 · PR #6 `integration/backend → main` fusionado; Root Directory de Vercel = `apps/web`; lint del harness E2E corregido
