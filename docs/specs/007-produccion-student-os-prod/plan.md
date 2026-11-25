# Plan · 007 · Producción: `student-os-prod`, variables y API desplegada

> Estado: **borrador** (espera la aprobación del humano)
> Se escribe tras aprobar la spec (aprobada el 2026-11-25). Dice **cómo** se hace.
> **El agente no toca producción.** Las fases con credenciales las ejecuta el humano; el agente prepara la receta, una verificación de solo lectura y el ping.

## Enfoque
Producción se monta en capas, de la base de datos hacia fuera, y cada capa se **verifica antes de pasar a la siguiente**: Supabase → API en Render → web en Vercel → login con Google → ping. Hay dos tipos de trabajo:

- **Agente (sin credenciales):** un script de verificación de solo lectura, un endpoint de salud que toque la base, el workflow del ping y la documentación de variables.
- **Humano (con credenciales):** crear y configurar los servicios en los paneles de Supabase, Render, Vercel, Google Cloud y el registrador del dominio.

**Hallazgo que cambia el ping:** `GET /health` (`apps/api/src/health/health.controller.ts`) solo devuelve el tiempo activo y la versión; **no consulta la base de datos**. Un ping a esa ruta mantendría despierta la API de Render, pero no demuestra actividad en Supabase, que es lo que evita la pausa a los 7 días. Por eso se propone un endpoint `GET /health/ready` que ejecute `SELECT 1` por Prisma (paso A2).

Alternativas descartadas:
- *Ping directo a la API REST de Supabase con la clave pública:* con la RLS activada y sin privilegios para `anon` la petición se rechaza; no se sabe con certeza que Supabase la cuente como actividad.
- *Cron externo en vez de GitHub Actions:* ya decidido por el humano (GitHub Actions); queda el externo como respaldo opcional.
- *Migrar datos de desarrollo:* descartado por el humano; producción empieza vacía.

## Cambios por área
| Área | Archivos / lugar | Qué cambia |
|------|------------------|------------|
| Backend | `apps/api/src/health/health.controller.ts` (+ módulo y prueba) | Nuevo `GET /health/ready` público, sin límite de peticiones, que hace `SELECT 1` y devuelve 200 o 503. Sin migración ni dependencias nuevas. **Es cambio de código: requiere la aprobación de este plan.** |
| Verificación | nuevo `scripts/verificar-produccion.mjs` | Script de **solo lectura** (sin credenciales): comprueba `/health` y `/health/ready`, que una ruta protegida sin token da 401, que CORS rechaza un origen no listado, y que la web carga. No escribe nada. |
| CI | nuevo `.github/workflows/ping-supabase.yml` | Programa (cada 3 días) una petición a `${{ vars.PROD_API_URL }}/health/ready`. **Si la variable no existe, el workflow no hace nada y termina en verde** (así no falla antes de que exista producción). |
| Docs | `docs/stack/backend.md`, `docs/stack/frontend.md`, `.env.example` | Lista de variables de producción y orden de despliegue. `.env.example` está bloqueado para lectura en la configuración (pendiente M4): se actualiza solo si el humano lo autoriza. |
| Infra (humano) | Supabase, Render, Vercel, Google Cloud, registrador/DNS | Ver las fases B a G. |
| Datos | — | **Sin migraciones nuevas.** Se aplican las dos existentes y luego `rls-baseline.sql`. |

## Fases y orden
**Fase 0 · Decisiones pendientes del humano (antes de crear nada)**
- Dominio concreto y quién gestiona su DNS.
- Región: se recomienda **Supabase N. Virginia (`us-east-1`) y Render Virginia**, porque dejan la API y la base en la misma zona. Render no tiene São Paulo. La región no conviene cambiarla después; elegir bien desde el principio.

**Fase A · Agente (sin credenciales)**
- **A1:** `scripts/verificar-produccion.mjs` con su prueba contra el stack simulado (no contra producción).
- **A2:** `GET /health/ready` con su prueba unitaria y de integración (200 con base disponible, 503 sin ella).
- **A3:** workflow `ping-supabase.yml`, inactivo hasta que exista `PROD_API_URL`.
- **A4:** documentación de variables y orden de despliegue.

**Fase B · Humano · Supabase (`student-os-prod`)**
1. Crear el proyecto `student-os-prod` en la región elegida; guardar la contraseña de la base en un gestor de contraseñas.
2. Anotar `DATABASE_URL` (pooler, puerto 6543, `?pgbouncer=true`), `DIRECT_URL` (puerto 5432), `SUPABASE_URL` y la clave **pública** (publishable).
3. Aplicar, **en este orden y una sola vez**: `20261113000000_wave2_sync`, `20261113010000_wave3_google` y, después, `prisma/rls-baseline.sql`.
4. Comprobar C1: todas las tablas existen y tienen RLS activa; una consulta con la clave pública y sin sesión no devuelve filas.

**Fase C · Humano · Google Cloud (depende de la 008)**
Crear el cliente OAuth **de producción** (decisión de la 008). Añadir como URI de redirección autorizada la de Supabase (`https://<ref>.supabase.co/auth/v1/callback`) y como origen el dominio propio. Añadir las dos cuentas de prueba.

**Fase D · Humano · Supabase Auth**
Proveedor Google con **el mismo client id y secret** que usará la API. `Site URL` = el dominio de la web; añadir a la lista de redirecciones permitidas el dominio y `www`.

**Fase E · Humano · Render (API)**
1. Crear el servicio con el `render.yaml` del repo (`autoDeploy: false`) en la región elegida.
2. Variables: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS` (el dominio, sin barra final ni ruta), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_TOKEN_ENC_KEY`.
3. **`GOOGLE_TOKEN_ENC_KEY`:** generarla (`openssl rand -base64 32`) y **respaldarla en un lugar seguro antes de la primera vinculación** (C8). Rotarla deja ilegibles los tokens guardados.
4. Desplegar a mano y comprobar `GET /health`. Asociar `api.<dominio>` como dominio personalizado.

**Fase F · Humano · Vercel y DNS (web)**
1. `Root Directory = apps/web`. Variables de producción: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_API_URL=https://api.<dominio>`. **Quitar `VITE_GOOGLE_CLIENT_ID`** cuando la 009 retire el transporte antiguo.
2. Asociar el dominio a Vercel y crear los registros DNS que indique cada panel (web y `api`; el registro TXT de verificación de Google es de la 008).

**Fase G · Ping**
Crear la variable de repositorio `PROD_API_URL` (`https://api.<dominio>`), activar el workflow y comprobar que una ejecución termina en verde (C4).

**Fase H · Verificación de punta a punta**
- El agente ejecuta `scripts/verificar-produccion.mjs` (C2, C3).
- El humano prueba con las dos cuentas reales: login, Calendar vinculado sin pulsar nada, un dato creado en un dispositivo visto en otro (C5) y cada cuenta viendo solo lo suyo (C6).
- Revisión de secretos: el agente busca en el repositorio, y el humano en los logs de Render, secretos o tokens (C7).

## Pruebas
| Criterio | Cómo se comprueba | Quién |
|----------|-------------------|-------|
| C1 | Consulta de comprobación de tablas con RLS activa y lectura anónima vacía | Humano (SQL) |
| C2 | La API arranca validando su entorno; la web muestra «Continuar con Google» habilitado | Script + humano |
| C3 | `/health` 200, ruta protegida 401 sin token, CORS rechaza origen no listado | Script de solo lectura |
| C4 | Una ejecución real del workflow en verde; `GET /health/ready` 200 | Humano + CI |
| C5 | Login real con Google, Calendar vinculado y un dato visto en otro dispositivo | Humano (manual) |
| C6 | Dos cuentas reales sin cruce de datos | Humano (manual) |
| C7 | Búsqueda de secretos en repo y revisión de logs de Render | Agente + humano |
| C8 | Confirmación escrita del humano de que respaldó la clave antes del primer enlace | Humano |

Las pruebas del endpoint nuevo (A2) y del script (A1) corren en el CI normal contra el stack simulado.

## Pasos
Cada paso del agente deja el proyecto en verde (`./scripts/check.sh` pasa) y acaba en un commit; los pasos B a G los hace el humano y se registran en `docs/PROGRESS.md`.
1. **A2** `GET /health/ready` con pruebas (requiere aprobar este plan).
2. **A1** script de verificación con su prueba.
3. **A3** workflow del ping, inactivo sin `PROD_API_URL`.
4. **A4** documentación de variables y orden.
5. Fases **B a G** (humano), una por una, comprobando al final de cada una.
6. **H** verificación de punta a punta y actualización de `features.json`, `TASKS.md` y `PROGRESS.md`.

## Riesgos
- **Fusionar la 009 antes de tener producción** deja la web desplegada sin forma de entrar (retira el login antiguo). El PR #9 se fusiona **solo después de la fase H**.
- **Previsualizaciones de Vercel:** las variables de producción no deben usarse en las previsualizaciones de ramas.
- **Región mal elegida:** no se puede cambiar en Render y es costoso en Supabase; se decide en la fase 0.
- **Arranque en frío de Render (plan gratuito):** la primera petición tarda; el ping de la fase G lo suaviza pero no lo elimina.
- **Redirecciones de OAuth mal escritas:** causa habitual de que el login falle en producción; se verifican con cuentas reales en la fase H.
- **Supabase gratuito:** si el ping falla durante 7 días el proyecto se pausa y hay que reactivarlo a mano desde el panel.
- **Secretos:** ninguno se escribe en el repositorio, en commits, en logs ni en chats; las claves van solo en los paneles y en el gestor de contraseñas del humano.
- **Rollback:** Render permite volver a un despliegue anterior y Vercel a una versión anterior; la base de datos empieza vacía, así que antes del lanzamiento puede recrearse.
