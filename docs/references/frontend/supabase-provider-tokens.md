# Tokens del proveedor (Google) en supabase-js

> De qué trata: qué hace `@supabase/supabase-js` con `provider_token` y `provider_refresh_token` al iniciar sesión con Google, y cómo evitar que el refresh token quede guardado en el navegador. Útil al tocar el login o la vinculación de Calendar (spec 009, paso 1, prueba de viabilidad del 2026-11-24).

## Qué se comprobó
- **Documentación de Supabase:** los tokens del proveedor **no se guardan** en la base de datos del proyecto, a propósito; si se necesitan fuera del navegador, se recomienda enviarlos a un servidor propio y de confianza.
- **Código de `@supabase/auth-js` 2.119.0** (`GoTrueClient.ts`):
  - Tras el login, `session.provider_token` y `session.provider_refresh_token` vienen en la sesión del evento `SIGNED_IN` de `onAuthStateChange`.
  - `_saveSession` **persiste la sesión completa** en el `storage` configurado (por defecto `localStorage`), **incluidos esos dos campos**.
  - Por eso la opción B de la spec 009 («entregar el token al API una vez») dejaría el refresh token de Google en `localStorage` hasta el siguiente refresco de sesión, y rompería el criterio C10.

## Solución adoptada
`createClient` acepta `auth.storage`. Se pasa un **adaptador** que, antes de escribir la sesión, elimina `provider_token` y `provider_refresh_token` (y los deja en memoria solo el tiempo del enlace). Así el token no se persiste en ningún momento.

## Condiciones para que el servidor pueda usar el token
- Los refresh tokens de Google están ligados al **cliente OAuth** que los emitió. El proveedor Google de Supabase debe usar **el mismo client id y secret** que el API (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Si no, `POST /google/link-login` recibirá `invalid_client` y responderá 400.
- En Google Cloud, además del redirect del API (`/google/callback`), hay que autorizar el redirect de Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`).
- Para que Google entregue el refresh token hace falta `access_type=offline` y `prompt=consent` en la petición de login.
- Lo que **no** se puede comprobar sin producción: el comportamiento real de Supabase y Google (consentimiento, entrega del refresh token, cuentas Workspace). Se valida con 007 y 008.
