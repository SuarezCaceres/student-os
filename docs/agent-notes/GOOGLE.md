# Notas del agente GOOGLE (Ola 3)

Rama: `feat/be-google-persistent` (parte de `integration/backend`). Alcance: `apps/api/src/google/**`, `apps/api/prisma/schema/google.prisma`, tests propios (`apps/api/test/google*.e2e-spec.ts`, `apps/api/test/helpers/google-*`), `apps/web/src/services/googleCalendar.ts` (fachada), `apps/web/src/services/googleCloud.ts` (archivo nuevo, ver abajo), `GoogleCalendarSyncModal.tsx` y este archivo.

## Que hace

Antes: el token de Google Calendar vivia en el navegador (GIS, 1 hora, se perdia al cerrar). Ahora, con la nube configurada, el **servidor guarda el refresh token cifrado** y hace las llamadas a Calendar; el navegador **jamas ve ningun token de Google**. Conectas una vez y al dia siguiente sigue sincronizando.

```
Navegador ──JWT Supabase──▶ API NestJS ──access token (memoria)──▶ Google Calendar v3
                              │
                              └─ Postgres: refresh token AES-256-GCM (google_connections)
```

## API (`apps/api/src/google/`)

| Ruta | Auth | Que hace |
| :-- | :-- | :-- |
| `POST /google/connect` `{ returnTo? }` | JWT | Crea el estado PKCE y devuelve `{ url }` de Google. 10/min por IP. |
| `GET /google/callback` | **Publica** (`@Public()`) | Valida el `state`, canjea el codigo, cifra y guarda el refresh token, y responde **302** a la web con `?google=connected` o `?google=error[&reason=...]`. 30/min por IP. |
| `GET /google/status` | JWT | `{ configured, connected, needsReauth, email, connectedAt, scopes }`. Sin secretos. |
| `POST /google/disconnect` | JWT | Revoca en Google y borra el secreto: `{ disconnected, revoked }`. Idempotente. |
| `GET /google/calendar/primary` | JWT | Metadatos del calendario principal. |
| `GET /google/calendar/events` | JWT | Lista (`timeMin,timeMax,singleEvents,orderBy,timeZone,maxResults,pageToken,showDeleted`). |
| `GET /google/calendar/events/:id` y `/:id/instances` | JWT | Un evento / instancias de una serie. |
| `POST /google/calendar/events` | JWT | Crea (incluye `recurrence` RRULE, `reminders`, `extendedProperties.private`). |
| `PATCH /google/calendar/events/:id` | JWT | Actualiza; tambien recorta series (`recurrence` con `;UNTIL=...`). |
| `DELETE /google/calendar/events/:id` | JWT | 204. |
| `POST /google/calendar/freebusy` | JWT | Solo el calendario `primary` (el cuerpo no puede elegir otro). |

Siempre el calendario `primary` del usuario del JWT (`userId` nunca viene del body/query). Respuestas con `Cache-Control: no-store`.

### Decisiones

- **PKCE + `access_type=offline` + `prompt=consent`** (siempre se entrega refresh token). Scopes: `openid email calendar.events.owned calendar.freebusy calendar.calendars.readonly` (los mas estrechos que acepta Google para lo que hace el proxy, ADR 0008; se quito `profile`, el servidor no necesita nombre ni foto). Si el usuario desmarca `calendar.events.owned` en el consentimiento granular, se revoca lo concedido y se vuelve con `reason=missing_scopes`.
- **`state` = `base64url(json{u,n,e}).HMAC-SHA256`**: ligado al usuario (`u`), a un nonce de un solo uso (`n`) y a una expiracion de 10 min (`e`). La clave HMAC se deriva con HKDF de `GOOGLE_TOKEN_ENC_KEY` con otro `info` que la de cifrado. El **verifier PKCE** se guarda en `google_oauth_states` (cifrado, TTL 10 min, fila borrada al usarse: un solo uso, tambien contra carreras con `deleteMany`). El callback cruza `state.u` con `fila.userId`.
- **Sin open redirect**: el `returnTo` se valida contra `WEB_ORIGINS` (origen exacto, sin credenciales, sin `\`, sin caracteres de control; solo se conserva `origen + ruta`) al crear el flujo Y otra vez al redirigir. Si el `state` es invalido se redirige al primer origen de `WEB_ORIGINS`.
- **Cifrado AES-256-GCM** (`token-cipher.ts`): IV aleatorio de 12 bytes por registro, version de clave en el blob (`v1.<iv>.<tag>.<ct>`) y columna `keyVersion`, **AAD = `userId`** (un blob copiado a otra fila no descifra). Clave = HKDF-SHA256 del secreto (>= 32 bytes). Rotacion: `GOOGLE_TOKEN_ENC_KEY_VERSION` (+ `GOOGLE_TOKEN_ENC_KEY_PREVIOUS[_VERSION]`); un blob con clave anterior se re-cifra solo al usarse.
- **Access token solo en memoria** (`Map` por usuario), renovado cuando le quedan < 60 s, con *single-flight* (llamadas simultaneas comparten una renovacion). Si Google responde 401 con un token "vigente", renueva una vez y reintenta; si sigue 401 -> reautorizar.
- **Errores**: `invalid_grant`/`invalid_client`/blob ilegible (clave cambiada o dato alterado) -> `needsReauth = true` y **`409 { code: 'google_reauth_required' }`**. **Es 409 y NO 401 a proposito**: `services/api.ts` trata cualquier 401 como "la sesion de Supabase expiro", intenta renovarla y cierra sesion. Una vez marcado, el servidor no vuelve a molestar a Google hasta que el usuario reconecte. Otros codigos estables: `google_not_connected` (409), `google_not_configured` (503), `google_bad_request` (400), `google_forbidden` (403), `google_not_found` (404), `google_gone` (410), `google_conflict` (409), `google_rate_limited` (429), `google_invalid_return_to` (400) y `google_upstream_error` (**424**, no 5xx: el cliente web reintenta los 5xx hasta ~90 s y repetir un POST podria duplicar eventos). Nunca se reenvia el cuerpo crudo de Google (solo el `message` de un 400, saneado).
- **Lista blanca de campos** (zod) en el proxy: se descartan `attendees`, `conferenceData`, `id`, etc. Ids de evento validados (`[A-Za-z0-9_@-]` + `.`; no pueden empezar por `.`).
- **Logs**: nunca se registran tokens, codigos, secretos ni el `state` (hay una prueba que audita todos los logs de un ciclo completo).
- **Bases de URL configurables solo para pruebas**: `GOOGLE_OAUTH_BASE`, `GOOGLE_API_BASE`, `GOOGLE_AUTH_URL` (por defecto los reales). En `NODE_ENV=production` deben ser `https://` o el servicio se niega a usarlas.
- **Gancho de borrado de cuenta**: `registerAccountDeletionHook({ name: 'google', run })` en `onModuleInit` -> revoca, borra la conexion y los estados PKCE pendientes del usuario (idempotente). PUBLIC solo debe llamar `runAccountDeletionHooks(userId)`.
- Sin dependencias nuevas: `fetch` nativo y `node:crypto`. `GoogleService` queda exportado por `GoogleModule`.

### Tablas (`prisma/schema/google.prisma`; sin migracion, la crea el Integrador)

- `google_connections`: `userId` unico, `refreshTokenEnc`, `keyVersion`, `scopes`, `accountEmail`, `connectedAt`, `needsReauth`, `updatedAt`.
- `google_oauth_states`: `id` (nonce), `userId`, `codeVerifierEnc`, `redirectTo`, `expiresAt` (indices por `expiresAt` y `userId`). Se limpian los caducados oportunistamente al crear uno nuevo (no hay cron).

## Variables de entorno nuevas / que activar

Ninguna se agrego a `env.schema.ts` (no era mia): `ConfigService.get` cae a `process.env`. **Todas se leen con `ConfigService.get`.**

| Variable | Donde | Obligatoria | Descripcion |
| :-- | :-- | :-- | :-- |
| `GOOGLE_CLIENT_ID` | API | si (para conectar) | Cliente OAuth tipo **Aplicacion web**. |
| `GOOGLE_CLIENT_SECRET` | API (Render) | si | Nunca en el repo ni en el web. |
| `GOOGLE_TOKEN_ENC_KEY` | API (Render) | si | >= 32 caracteres. `openssl rand -base64 32`. **Si se pierde o cambia sin rotar, los usuarios deben reconectar.** |
| `GOOGLE_REDIRECT_URI` | API | si | URL publica EXACTA del callback: `https://<tu-api>.onrender.com/google/callback`. |
| `GOOGLE_TOKEN_ENC_KEY_VERSION` | API | no (defecto 1) | Version de la clave vigente al rotar. |
| `GOOGLE_TOKEN_ENC_KEY_PREVIOUS` / `_PREVIOUS_VERSION` | API | no | Clave anterior para seguir descifrando durante la rotacion. |
| `GOOGLE_OAUTH_BASE`, `GOOGLE_API_BASE`, `GOOGLE_AUTH_URL` | API | **solo pruebas** | NO definir en produccion. |

Si falta cualquiera de las cuatro primeras, `GET /google/status` devuelve `configured: false` y `POST /google/connect` responde 503 `google_not_configured` (la UI lo explica; el resto de la API no se ve afectado). `WEB_ORIGINS` (ya existente) **debe incluir el origen exacto de la web** (cada dominio de Vercel que se use, incluidas previews).

Para el `.env.example` de la raiz / `apps/api/.env.example` (lo consolida el Integrador):

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_TOKEN_ENC_KEY=            # >= 32 caracteres; openssl rand -base64 32
GOOGLE_REDIRECT_URI=http://localhost:3000/google/callback
```

## Que debe configurar el USUARIO en Google Cloud

1. Proyecto con **Google Calendar API habilitada**.
2. **Pantalla de consentimiento**: scopes `openid`, `email`, `.../auth/calendar.events.owned`, `.../auth/calendar.freebusy` y `.../auth/calendar.calendars.readonly` (ADR 0008); agregar usuarios de prueba mientras este en *Testing*.
3. Credenciales -> ID de cliente OAuth tipo **Aplicacion web** (puede ser el mismo que usa GIS, o uno nuevo). En **URI de redireccionamiento autorizados** agregar EXACTAMENTE el callback de la API (sin barra final, mismo esquema/host/puerto que `GOOGLE_REDIRECT_URI`):
   - Produccion: `https://<tu-api>.onrender.com/google/callback`
   - Local: `http://localhost:3000/google/callback`
4. Copiar *Client ID* y *Client secret* a las variables de Render. (Los *Orígenes autorizados de JavaScript* siguen haciendo falta solo para el modo GIS de respaldo.)

## Limites que hay que conocer (honestidad)

- **Modo *Testing*: el refresh token caduca a los 7 dias** (y hay un maximo de 100 usuarios de prueba). El servidor lo detecta como `invalid_grant`, marca `needsReauth` y la UI muestra "Requiere reconexión" con una explicacion en espanol. Para que la persistencia sea real hay que pasar la pantalla de consentimiento a **In production**.
- **En produccion sin verificar**: maximo **100 usuarios** y aviso de "app no verificada". Los scopes de Calendar son *sensibles* (confirmar la clasificacion de cada uno en la consola, spec 008 C9): para pasar de 100 usuarios hay que enviar la app a **verificacion de Google** (politica de privacidad, dominio verificado, video de demostracion; el agente PUBLIC aporta las paginas legales). Puede tardar semanas.
- Google tambien invalida refresh tokens sin uso durante 6 meses, o si el usuario cambia su contrasena de Google / quita el acceso (se ve igual que `invalid_grant`), y guarda como maximo 100 refresh tokens por usuario y cliente.
- El access token vive en memoria del proceso: tras un reinicio/dormida de Render se vuelve a renovar con el refresh token (1 llamada extra, transparente).

## Web (patron fachada)

`apps/web/src/services/googleCalendar.ts` **conserva todas las firmas y su semantica** (`auth_missing | partial | error | ok`); hay una prueba que congela cada export (`googleCalendar.signatures.test.ts`) y otra (`googleCalendar.gis.test.ts`) que fija que el modo GIS hace exactamente las mismas llamadas directas a Google de siempre. Solo se **agregaron** exports.

- **Modo nube** = `VITE_API_URL` + `VITE_SUPABASE_URL` (+ clave publica) configuradas **y** sesion de Supabase iniciada (`isGoogleCloudMode()`; `resolveGoogleCloudMode()` es la version asincrona definitiva). Si falta algo -> GIS intacto (la app desplegada hoy no tiene esas variables y sigue igual).
- En modo nube, el "token" que circula por las funciones existentes es el marcador `GOOGLE_CLOUD_ACCESS_TOKEN` (no es un secreto). Todas las llamadas a Calendar pasan por `googleFetch`, que enruta por la API (`/google/calendar/*`) o va directo a Google con el token GIS. Los errores de la API se traducen a la semantica vieja: `google_reauth_required`/`google_not_connected` -> respuesta 401 sintetica (mensaje "expiró" -> `auth_missing` en los borrados de series, token inexistente en `getStoredAccessToken`), 404/410 se conservan, 424/red/timeout -> `error`/excepcion.
- `getStoredAccessToken()` en modo nube devuelve el marcador si la meta local dice "conectado" y la API no pidio reautorizar; `trySilentGoogleReconnect()` consulta `/google/status` (cache 30 s, llamadas simultaneas compartidas). Un fallo transitorio (servidor dormido) NO desconecta.
- `connectGoogleCalendar()` / `signInWithGoogleAccount()` en modo nube: si el servidor ya tiene la conexion la devuelve; si no, navega a Google y **la promesa no se resuelve** (se abandona la pagina). Al volver, la API agrega `?google=connected|error[&reason]`; la fachada lo captura **al cargar el modulo**, limpia la URL y, si salio bien, deja la meta en "conectado" para que la sincronizacion automatica de `App` lo detecte sin tocar nada.
- `disconnectGoogleCalendar()` (que `App` llama al **cerrar sesion**) en modo nube **solo olvida el estado local**: NO revoca la conexion persistente (si no, cada logout obligaria a reconectar). La desconexion real es la nueva `disconnectGoogleCalendarCloud()`, que usa el modal.
- Archivo nuevo `services/googleCloud.ts` (transporte nube, estado de sesion, captura de la redireccion). Esta dentro del dominio GOOGLE pero no figuraba en la lista de alcance; si prefieres, se puede fusionar dentro de `googleCalendar.ts`.
- Exports nuevos: `GOOGLE_CLOUD_ACCESS_TOKEN`, `isGoogleCloudToken`, `isGoogleCloudMode`, `resolveGoogleCloudMode`, `refreshGoogleCloudConnection`, `beginGoogleCloudConnect`, `disconnectGoogleCalendarCloud`, `consumeGoogleRedirectResult` y los tipos `GoogleCloudConnectionState`, `GoogleCloudStatus`, `GoogleRedirectResult`.
- `GoogleCalendarSyncModal.tsx`: estados Conectado / Sin conectar / Requiere reconexión / Revisando conexión, "Conectar" (redireccion, sin popup), "Reconectar", "Desconectar" con confirmacion (revoca de verdad y avisa si Google no confirmo), mensajes del resultado de volver de Google, aviso si el servidor no esta configurado. Objetivos tactiles `.t-btn` (>= 44 px), texto >= 13 px, sin violeta. En modo GIS el modal se comporta como antes.
- `GoogleChangeBanner.tsx`, `GoogleImpactModal.tsx` y `googleCalendarDiff.ts` **no necesitaron cambios** (no tocan tokens).

## Lo que debe cablear el Integrador

1. **Fusionar y regenerar**: lockfile (no se anadieron dependencias), y **una migracion** con `google_connections` y `google_oauth_states` (`prisma migrate dev`). Ejecutar `prisma/rls-baseline.sql` despues (itera todas las tablas de `public`; `google_connections` guarda secretos cifrados, no debe ser legible por PostgREST). Opcional: FK a `profiles(id) ON DELETE CASCADE` en `userId`.
2. **Render**: definir `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY`, `GOOGLE_REDIRECT_URI` y revisar `WEB_ORIGINS` (compuerta humana de la Ola 3, §7).
3. **Logs (importante)**: `pino-http` registra `req.url` **con la query string**, y el callback recibe `?code=...&state=...` de Google. Aunque el codigo es de un solo uso y esta atado a PKCE + client secret, la regla es no loguearlo. `app.module.ts` no es mio: anadir en `LoggerModule.forRootAsync -> pinoHttp`:
   ```ts
   serializers: { req: (req) => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0] }) },
   ```
4. **App.tsx** (opcional, nada es obligatorio porque la fachada mantiene las firmas):
   - Tras el login de Supabase, restaurar la conexion para usuarios que vuelven (el cierre de sesion borra la meta local): `refreshGoogleCloudConnection()`; si devuelve `accessToken`, `setIsGoogleConnected(true)` y `refreshGoogleCalendarWeek({ explicitToken })`.
   - Mostrar un aviso con `consumeGoogleRedirectResult()` (devuelve una sola vez `{ status: 'connected' | 'error', reason? }`) y/o abrir `GoogleCalendarSyncModal` si `status === 'error'`. El modal ya muestra ese mensaje si se abre.
5. **PUBLIC**: el borrado de cuenta debe llamar `runAccountDeletionHooks(userId)` (el gancho `google` ya esta registrado en `onModuleInit`).
6. Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` activan el modo nube; `VITE_GOOGLE_CLIENT_ID` sigue siendo necesaria solo para el modo GIS de respaldo.

## Pruebas

- `apps/api/src/google/*.spec.ts` (89 tests): cifrado (round-trip, IV distinto, manipulacion de ct/tag/IV/version, clave incorrecta, AAD de otro usuario, clave corta, rotacion), `state` (valido, expirado exacto, de otro usuario, alterado, firma ajena, malformado), PKCE (vector del RFC 7636), open redirect (17 URLs hostiles), flujo completo contra el servidor falso de Google (verifica de verdad client secret, redirect_uri, **code_verifier contra code_challenge**, codigo de un solo uso), renovacion del access token (margen de 60 s, single-flight, reintento por 401), `invalid_grant`, aislamiento entre usuarios, mapeo de errores, series RRULE/UNTIL, revocacion/borrado de cuenta y auditoria de logs.
- `apps/api/test/google.e2e-spec.ts` (33 tests): HTTP real sobre `AppModule` (guard JWT, throttler, filtros) con **Postgres real embebido** (`embedded-postgres`, puerto **54334**, schema `dev_google`, `prisma db push`, sin Docker/Supabase) + JWKS local + servidor falso de Google. Helpers: `test/helpers/google-fake.ts`, `google-fixtures.ts`, `google-pg.ts`, `google-pg-server.mjs`.
- Web (Vitest): `googleCalendar.signatures.test.ts` (firmas congeladas), `googleCalendar.gis.test.ts` (modo GIS = llamadas directas de siempre), `googleCalendar.cloud.test.ts` (modo nube, mapeo de errores, conectar/desconectar, redireccion), `GoogleCalendarSyncModal.test.tsx` (estados de la UI).

## Deuda y fuera de alcance

- No se verifico contra Google real ni contra Supabase/Render (todo con servidores falsos y valores falsos). Falta una prueba manual del flujo real con un cliente OAuth de verdad antes de publicar.
- Tipos `GoogleStatus` duplicados en api y web (no se toco `packages/shared`, fuera de mi alcance). Si se quiere contrato compartido: `shared/src/google.ts`.
- Rotacion de claves: solo una clave anterior; no hay comando de re-cifrado masivo (se re-cifra al usarse).
- `google_oauth_states` caducados se purgan oportunistamente (al crear uno nuevo); un cron no es necesario pero se podria agregar.
- El proxy no pagina automaticamente (igual que antes: `maxResults` 250/500); `pageToken` esta soportado en la API por si hace falta.
- Si el servidor esta dormido (Render free), `trySilentGoogleReconnect` puede tardar hasta ~90 s en la primera llamada del dia (el cliente API reintenta con backoff); la UI no se bloquea porque App no espera por ella en el arranque.
