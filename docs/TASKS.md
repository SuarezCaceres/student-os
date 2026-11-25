# Tareas

> El agente lee esto al empezar cada sesión y lo actualiza al terminar.
> Las funcionalidades grandes viven en `docs/features.json`; aquí van las tareas concretas.
> Prioridad: **Alto** (bloquea que el producto sea público o que los datos de un usuario estén a salvo), **Medio** (afecta a la calidad o a un flujo, pero hay alternativa) y **Bajo** (limpieza y deuda). Calificada por el agente el 2026-11-23 a partir de lo que pediste; corrígela si no coincide.

## En curso
- [ ] Priorización de pendientes (esta rama: `docs/prioriza-pendientes`) · agente + humano

## Pendiente

### 🔴 Alto

#### A1 · ⭐ IMPORTANTE · Login con Google para cualquier usuario y Calendar vinculado automáticamente (funcionalidad 009)
Objetivo del humano: que **cualquier persona** entre con su cuenta de Google y que su Google Calendar quede **ya vinculado, sin pulsar ningún botón «Conectar»**.
- **Hoy:** el login usa Supabase Auth con Google (`apps/web/src/services/supabase.ts`). Vincular Calendar es **otro flujo aparte** que exige pulsar «Conectar» en `GoogleCalendarSyncModal` (`POST /google/connect`, PKCE, refresh token cifrado en el servidor). Además la web en producción **no tiene API desplegada**, así que el login con la nube no funciona de verdad todavía.
- **Falta:**
  - [ ] Abrir el login a cualquier cuenta de Google. Hoy está limitado a 100 usuarios de prueba y mostraría «app no verificada». Depende de **A4 (verificación de Google)**.
  - [ ] Configurar el proveedor Google en Supabase de producción (credenciales, URLs de redirección y orígenes autorizados). Depende de **A3 (producción)**.
  - [ ] Vincular Calendar en el propio login: pedir los permisos de Calendar en el mismo consentimiento y guardar el refresh token en el servidor al terminar, sin segundo paso. Decisión técnica pendiente (spec 009): Supabase no conserva el refresh token del proveedor, así que hace falta un flujo propio. **Es zona protegida** (claves de Google, ver `AGENTS.md`).
  - [ ] Si el usuario niega los permisos de Calendar, la app debe seguir funcionando y ofrecer vincularlo después.
  - [ ] Probarlo con Google y Supabase reales, no con los simulados (criterio C5 de la funcionalidad 002).
- **Pregunta abierta:** ¿Calendar es obligatorio para entrar o opcional? Los permisos de Calendar son «sensibles» para Google y exigen verificación completa *(deducido; confirmar con `docs/google-verification-checklist.md`)*.
- [ ] Escribir la spec en `docs/specs/009-login-google-para-todos-y-calendar-automatico/spec.md` (con `spec-plan-code`)

#### A2 · Entorno de trabajo por usuario: cada uno guarda sus propios datos (funcionalidad 010)
Objetivo del humano: que cada usuario tenga su espacio y se guarden **por usuario** sus tareas pendientes y demás datos.
- **Ya existe en el código:** cada registro se guarda con `(userId, collection, id)`, el `userId` sale del JWT (nunca del body), hay RLS en Supabase y pruebas de aislamiento entre dos usuarios (`apps/api/test/*.e2e-spec.ts`). **Pero solo está probado en local con servicios simulados: en producción todavía no guarda nada por usuario** (la API no está desplegada).
- **Falta:**
  - [ ] Desplegarlo y comprobar con **dos cuentas reales distintas** que cada una ve solo lo suyo (depende de A3).
  - [ ] Los 4 componentes que usan `localStorage` directo (`AuthModal`, `BackupModal`, `DailyHabitsCard`, `GymTracker`) no sincronizan en modo nube: hábitos y gym podrían quedarse en el navegador y no «seguir» al usuario a otro dispositivo (ver M2).
  - [ ] **Riesgo a analizar:** si el usuario A cierra sesión y el B entra en el mismo navegador, el importador del primer inicio podría ofrecer subir los datos locales de A a la cuenta de B. Decidir qué pasa con el estado local al cambiar de cuenta.
  - [ ] Definir qué ve un usuario nuevo (estado vacío o datos de ejemplo) y los límites por cuenta (hoy 5000 registros y 64 KB por registro).
- [ ] Escribir la spec en `docs/specs/010-entorno-de-trabajo-por-usuario/spec.md`

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
- [x] Escribir la spec en `docs/specs/008-verificacion-app-google/spec.md` (borrador, espera tu aprobación)

> **Orden de ejecución sugerido:** A3 (producción) y A4 (verificación, que tarda semanas) **en paralelo y cuanto antes**; después A1 y A2, que se pueden desarrollar ya con servicios simulados y se validan al final contra producción.

### 🟡 Medio

- [ ] **M1 · BUG-01:** al cerrar sesión con la nube activa, `App.tsx` (efecto ~línea 202) re-adopta la sesión de Supabase mientras `signOut()` sigue en vuelo y el usuario no vuelve a la landing. Lo cubre `apps/web/e2e/02-login.spec.ts` (2c) con `test.fail`; al arreglarlo, quita esa marca y marca `pasa: true` en el criterio C4 de la funcionalidad 002. Importa para A1 y A2 (cambio de cuenta).
- [ ] **M2 · `localStorage` directo:** revisar `AuthModal`, `BackupModal`, `DailyHabitsCard` y `GymTracker` y decidir cuál es intencional y cuál debe pasar por `AppState`/el sync.
- [ ] **M3 · E2E en el CI:** el CI no ejecuta la E2E (solo build, lint y tests unitarios de los tres paquetes). Valorar un job de E2E.
- [ ] **M4 · `.claude/settings.json`** deniega `Read(./.env.*)` y eso bloquea también leer `.env.example`, que el harness pide mantener al día. Decidir: listar solo los `.env` con secretos (`.env`, `.env.local`, `.env.production`…) o aceptar la limitación.
- [ ] **M5 · Revisar lo deducido:** las convenciones «(observado)» de `docs/rules/backend.md` y `frontend.md`, el glosario de `PROJECT.md` y los ADRs 0004 a 0006 salen del código y de las notas de los agentes, no de una decisión tuya.

### 🟢 Bajo
- [ ] Crear el enlace simbólico `.claude/skills → ../.agents/skills` (requiere activar el Modo desarrollador de Windows). Hoy es una copia sin versionar que hay que resincronizar a mano tras tocar una skill.
- [ ] El hook `.claude/hooks/guard.sh` da un falso positivo si el texto del comando contiene «git … push … main» (por ejemplo en el cuerpo de un PR). Afinar el regex.
- [ ] Los módulos `kanban`, `university`, `gym` y `calendar` de `apps/api/src/` son controladores vacíos de 6 líneas (el dato viaja por `/sync`). Decidir: eliminarlos o rellenarlos.
- [ ] Bundle web de ~1 MB (aviso de Vite sobre chunks > 500 kB): evaluar `import()` dinámico.
- [ ] 4 avisos de oxlint en `apps/web` (`LearningView.tsx` ×3, `App.tsx:205`).
- [ ] `./scripts/check.sh` (E2E) reescribe los JPG versionados de `docs/qa/evidence/` y ensucia el árbol de git. Dirigir la salida a una carpeta ignorada o dejar de versionar esas imágenes.
- [ ] Versiones de Node dispares: `engines >=20`, CI en 20, Render en 22, Vercel en 26.x. Unificarlas.
- [ ] TypeScript distinto entre paquetes: web `~7.0.2`, api `^5.9`.
- [ ] `pre-commit` tarda ~50 s (decidido mantenerlo; revisar si molesta).
- [ ] `docs/qa/BUGS.md` está citado en el test 2c pero **no existe**: recrearlo o quitar la referencia.
- [ ] Ramas remotas ya fusionadas que se pueden borrar: `feat/agent-1-university-kanban`, `feat/agent-2-gym-calendar-dashboard`, `feat/student-os-core-hub`, `feat/ui-taste-foundation`, `integration/backend`, `chore/adopt-agent-harness`. `feat/overview-summary` se fusionó con squash en el PR #5: confirmar y borrar.
- [ ] Archivos de instrucciones antiguas en la raíz (`AGENT_WT1_INSTRUCTIONS.md` … `AGENT_WT4_*`, `AGENT_WT1_AUDIT_*`, `AGENT_WT2_AUDIT_*`): archivarlos en `docs/references/historial/` o borrarlos.
- [ ] Comentarios de código y `PRODUCT.md` (línea 47) que aún citan `memories.md` y `PLAN_BACKEND.md`: actualizar la ruta.

## Bloqueado
- [ ] Enlace simbólico de skills · Windows exige Modo desarrollador o administrador · que el humano lo active

## Hecho
- 2026-11-24 · PR #7 fusionado: harness de agentes adoptado en `main` y desplegado en Vercel (web en modo local; sin API en producción)
- 2026-11-23 · Fase 6: `features.json` poblado, `memories.md` y los planes archivados en `docs/references/historial/`, carpetas de spec, prioridades
- 2026-11-23 · Fases 0 a 5 de la adopción del harness (instalación, borrador técnico, producto, arquitectura, reglas, skills) y ADRs 0002 a 0006
- 2026-11-23 · PR #6 `integration/backend → main` fusionado; Root Directory de Vercel = `apps/web`; lint del harness E2E corregido
