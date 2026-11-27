# Spec · 007 · Producción: `student-os-prod`, variables y API desplegada

> Estado: **borrador** (espera la aprobación del humano)
> Dice **qué** y **por qué**, no **cómo**. El cómo va en `plan.md`, después de aprobar esta spec.
> Prioridad: Alto (`docs/TASKS.md`). Es prerrequisito de la 009 (login para todos) y de la 010 (datos por usuario): ninguna puede fusionarse ni probarse de verdad sin esto.
> Esta spec la ejecuta sobre todo **el humano** (necesita credenciales y paneles de Supabase, Render, Vercel y Google). El agente **no toca producción**: prepara la receta y la verificación.

## Problema
Hoy la web desplegada en Vercel **no tiene API**: no hay servicio en Render, la base de producción no existe y Vercel no tiene las variables de Supabase. Todo lo de la nube (login, sync entre dispositivos, Calendar vinculado) solo funciona en local con servicios simulados. Mientras eso siga así:
- la 009 retira el login antiguo; si se fusiona antes de tener producción, **nadie podría entrar** a la web desplegada;
- nadie ha probado la app contra Supabase, Render y Google reales (criterio pendiente de la funcionalidad 002).

## Objetivo
Existe un entorno de producción completo y probado de punta a punta: un proyecto Supabase `student-os-prod` con las migraciones y las políticas de seguridad aplicadas, la API desplegada en Render con sus variables, la web de Vercel apuntando a esa API, y una persona real de prueba que entra con Google, ve su Calendar vinculado y sincroniza datos entre dos dispositivos.

## Alcance
- **Incluye:**
  - Proyecto Supabase `student-os-prod` con las migraciones de `apps/api/prisma/migrations/` y luego `rls-baseline.sql`, aplicadas a mano.
  - Proveedor de Google en Supabase Auth, con el **mismo client id y secret** que usa la API (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) y las URLs de redirección y orígenes autorizados correctos.
  - Variables de producción: Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`) y Render (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`; `NODE_ENV`, `NODE_VERSION` y `SUPABASE_JWT_AUDIENCE` ya vienen en `render.yaml`).
  - API desplegada en Render con `autoDeploy: false` (el humano aprueba cada despliegue) y `GET /health` en verde.
  - Un ping programado que evite que Supabase pause el proyecto a los 7 días sin actividad. Se ejecuta con **GitHub Actions** programado (decisión del humano, 2026-11-25).
  - Una verificación de punta a punta con una cuenta de prueba real.
  - Quitar `VITE_GOOGLE_CLIENT_ID` de Vercel cuando la 009 retire el transporte de Google Identity Services.
- **No incluye:**
  - La verificación de la app ante Google (es la 008); mientras no termine, el login sigue limitado a 100 usuarios de prueba y muestra «app no verificada».
  - Cambios de código del producto, nuevas migraciones o dependencias nuevas (cualquiera de ellas requiere aprobación aparte).
  - Rotar claves ya emitidas, dominio propio o monitorización avanzada (ver preguntas abiertas).

## Historias de usuario
- Como responsable del producto, quiero un entorno de producción separado del de desarrollo, para no mezclar datos de prueba con los de personas reales.
- Como estudiante, quiero entrar con Google en la web desplegada y que mis datos me sigan a otro dispositivo, para usar la app de verdad.
- Como responsable del producto, quiero que los secretos nunca estén en el repositorio ni en los logs, para proteger las cuentas de los usuarios.

## Criterios de aceptación
Los criterios **C1 a C5** son los de `docs/features.json` (no se reescriben). Cada uno debe poder comprobarse.
- **C1:** Existe el proyecto Supabase `student-os-prod` con las migraciones de `apps/api/prisma/migrations` aplicadas y `rls-baseline.sql` ejecutado sin errores. *Se comprueba:* las tablas del esquema existen y todas tienen la seguridad por filas (RLS) activada; una consulta con la clave pública, sin sesión, no devuelve filas de ninguna tabla.
- **C2:** Vercel (`VITE_*`) y Render (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `WEB_ORIGINS`, `GOOGLE_*`) tienen sus variables de producción. *Se comprueba:* la API arranca (valida su entorno al iniciar) y la web carga el botón «Continuar con Google» habilitado, no el aviso de «sin nube».
- **C3:** La API está desplegada en Render y `GET /health` responde 200. *Se comprueba además:* una petición protegida sin token devuelve 401 y una petición desde un origen no listado en `WEB_ORIGINS` es rechazada por CORS.
- **C4:** Un ping programado evita la pausa de Supabase a los 7 días. *Se comprueba:* el ping se ejecuta en su horario y deja constancia (registro o actividad visible) al menos una vez tras activarlo.
- **C5:** Un usuario de prueba puede iniciar sesión y sincronizar contra producción de punta a punta. *Se comprueba:* con una cuenta de Google real (de las permitidas como usuario de prueba), entra a la app, su Calendar queda vinculado sin pulsar nada, crea un dato en un dispositivo y lo ve en otro.

### Criterios adicionales (aprobados por el humano el 2026-11-25 y añadidos a `features.json` con `pasa: false`)
- **C6:** Dadas **dos cuentas reales distintas**, cuando cada una crea datos, entonces cada una ve solo lo suyo y no hay filas de una en la otra (es el criterio C1 de la funcionalidad 010).
- **C7:** Dado el repositorio y los logs de la API en producción, cuando se revisan, entonces no contienen ningún secreto (`GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`, claves de Supabase, contraseñas de base de datos) ni tokens de Google.
- **C8:** Dado que `GOOGLE_TOKEN_ENC_KEY` cifra los tokens guardados, cuando se genera la clave de producción, entonces queda respaldada en un lugar seguro del humano **antes** de la primera vinculación, porque rotarla deja ilegibles los tokens ya guardados.

## Reparto de trabajo
| Quién | Qué |
|---|---|
| **Humano** (credenciales) | Crear `student-os-prod`; ejecutar las migraciones y `rls-baseline.sql`; crear el servicio en Render; pegar secretos en Render y Vercel; configurar el proveedor de Google en Supabase y el cliente OAuth en Google Cloud; aprobar cada despliegue. |
| **Agente** (sin tocar producción) | Redactar el plan paso a paso; preparar un script o checklist de **verificación de solo lectura** que compruebe C1–C3 desde fuera; dejar la receta del ping; actualizar `.env.example` y la documentación si cambia algo. |

## Casos límite y errores
- **Dos URLs de conexión:** la API usa el pooler (puerto 6543, `?pgbouncer=true`) y las migraciones usan la conexión directa (5432). Mezclarlas rompe las migraciones o agota conexiones.
- **`WEB_ORIGINS`:** es obligatoria en producción y cada origen va sin ruta ni barra final; con un valor mal formado la API no arranca (por diseño).
- **Mismo cliente de Google en dos sitios:** si Supabase y la API usan credenciales distintas, el login funciona pero el refresh token no encaja y Calendar no se vincula.
- **Redirecciones de OAuth:** la URL de callback de Supabase debe estar entre las URIs autorizadas del cliente de Google, y el dominio de Vercel entre las URLs de redirección permitidas de Supabase.
- **Arranque en frío de Render (plan gratuito):** la primera petición tras inactividad tarda; es una limitación aceptada, no un fallo.
- **Pausa de Supabase (plan gratuito):** sin actividad el proyecto se pausa a los 7 días; el ping (C4) existe para evitarlo y hay que saber cómo reactivarlo si ocurre.
- **Migraciones a mano:** se aplican en orden (`20261113000000_wave2_sync`, luego `20261113010000_wave3_google`) y después `rls-baseline.sql`; no se re-ejecutan sobre una base que ya las tiene.
- **Sin verificación de Google (008):** solo los usuarios de prueba autorizados pueden entrar, y verán la advertencia de «app no verificada».

## Decisiones tomadas (2026-11-25)
- **Datos de partida:** `student-os-prod` **empieza vacía**; no se migran datos del Supabase de desarrollo (coherente con la 010: cada cuenta nueva parte limpia).
- **Dominio:** la web de producción usa un **dominio propio** (Google exige un dominio verificado para la verificación de la app, spec 008). Afecta a `WEB_ORIGINS`, a las redirecciones de Supabase y a la pantalla de consentimiento.
- **Ping contra la pausa de Supabase:** **GitHub Actions** programado (cada ~3 días). Aviso: GitHub desactiva las tareas programadas de un repositorio público tras 60 días sin actividad en el repo; habrá que reactivarlas desde la pestaña Actions si ocurre.
- **Cuentas de prueba:** el humano tiene dos o más cuentas de Google, suficientes para el criterio C6 (aislamiento entre cuentas).
- **Criterios C6 a C8:** aprobados y añadidos a `docs/features.json`.

## Preguntas abiertas
- ¿Cuál es el **dominio propio** concreto (y quién gestiona su DNS)? Hace falta para `WEB_ORIGINS`, las redirecciones de Supabase y la spec 008.
- ¿Qué **región** usan Supabase y Render? Conviene que coincidan para minimizar latencia.
- Aprobación final de esta spec para pasar a su plan.
