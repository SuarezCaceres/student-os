# ADR 0005 · Refresh token de Google cifrado en el servidor

- **Fecha:** 2026-11-23 (decisión de la Ola 3 del backend; registrada al adoptar el harness)
- **Estado:** aceptada (ajustado por el ADR 0008)

## Contexto
Antes, el token de Google Calendar vivía en el navegador (GIS, 1 hora, se perdía al cerrar). Se quería que la conexión persistiera al día siguiente sin que el navegador viera ningún token. Fuente: `docs/agent-notes/GOOGLE.md`.

## Decisión
- Flujo OAuth con **PKCE**, `access_type=offline` y `prompt=consent`. Scopes mínimos: `openid email calendar.readonly calendar.events` (hasta el 2026-11-25; desde entonces, los del ADR 0008).
- El servidor guarda el *refresh token* **cifrado con AES-256-GCM** (`apps/api/src/google/token-cipher.ts`): IV aleatorio de 12 bytes por registro, versión de clave en el blob y `userId` como AAD (un blob copiado a otra fila no descifra). La clave sale de `GOOGLE_TOKEN_ENC_KEY` con HKDF-SHA256.
- El servidor hace de proxy a Calendar v3; el navegador nunca ve un token de Google.
- Un error de refresco (`invalid_grant`, clave cambiada o blob ilegible) responde **409** `google_reauth_required`, no 401, para que `services/api.ts` no lo confunda con una sesión de Supabase caducada.
- Al borrar la cuenta se revoca el token en Google y se borra la fila (`registerAccountDeletionHook`).

## Alternativas consideradas
- **Mantener el token en el navegador (GIS):** descartada: dura 1 hora y se pierde al cerrar.
- **Guardar el token en claro en la BD:** descartada por seguridad.

## Consecuencias
- **Rotar `GOOGLE_TOKEN_ENC_KEY` deja ilegibles los tokens guardados** y obliga a reconectar: requiere aprobación del humano (ver `docs/rules/security.md`).
- La verificación de la app en Google (`docs/google-verification-checklist.md`) sigue pendiente; hasta entonces el login admite 100 usuarios de prueba.

## Actualización (ADR 0007, 2026-11-24)
El refresh token ya no se obtiene con el botón «Conectar» (`/google/connect`) sino en el propio login: la web lo entrega una sola vez a `POST /google/link-login`. El cifrado, la clave y el borrado de cuenta no cambian. La web ya no usa `/google/connect`, `/google/disconnect` ni el transporte de Google Identity Services.
