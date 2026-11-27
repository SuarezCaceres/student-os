# 008 · Justificación de cada permiso (C11)

> Paso A3 del plan. Textos **en inglés** para pegar en el formulario de verificación de Google, uno por permiso.
> Debajo de cada texto, la tabla de respaldo: cada afirmación con el código, el ADR o la prueba que la sostiene. Si el código cambia, se corrige el texto (nunca al revés) y se revisa esta tabla.
> Scopes: `openid`, `email`, `profile` (lo añade Supabase) y `calendar.events.owned` (ADR 0008, revisión del 2026-11-26; fuente única `VERIFIED_GOOGLE_CALENDAR_SCOPES`). Revisado contra el código de la rama de la 008 el 2026-11-26.
> Ya **no** se piden `calendar.freebusy` ni `calendar.calendars.readonly`: la app no usaba `freebusy.query` ni `calendars.get` (los huecos libres salen de `events.list`), así que se quitaron sus textos.

## Qué guarda StudentOS de Google (comprobado en el código)
| Dato | Dónde | Respaldo |
|---|---|---|
| Refresh token, **cifrado** (AES-256-GCM, IV por registro, `userId` como AAD) | Tabla `google_connections`, columna `refreshTokenEnc` | `apps/api/prisma/schema/google.prisma`, `apps/api/src/google/token-cipher.ts`, ADR 0005, `token-cipher.spec.ts` y `google.e2e-spec.ts` («conecta, cifra el refresh token en Postgres…», «C5: vincula, cifra…») |
| Correo de la cuenta de Google conectada y scopes concedidos | `google_connections.accountEmail` y `.scopes` | `google.prisma`; el correo sale de `userinfo` (`GoogleApiClient.fetchAccountEmail`) |
| Identificador (`googleEventId`) de los eventos **que la propia app creó** al publicar un bloque, una sesión de gym o el turno laboral | Registros sincronizados del usuario (bloques de calendario y gym) | `packages/shared/src/calendar.ts` y `gym.ts`; `apps/web/src/sync/adapters/calendar.ts` (comentario «CRITERIO DE PROPIEDAD») |
| Contenido de los eventos de Google (títulos, horas, invitados) | **No se guarda.** Se lee en vivo a través del proxy y se muestra; no forma parte del estado que se sincroniza | `apps/api/src/google/google.controller.ts` (solo reenvía), `calendar.ts` del sync («Los eventos de Google Calendar no viven en `AppState`»), `calendar.test.ts` («NO sube bloques espejo de Google (gcal-*)…», «rechaza bloques de gym o espejo de Google aunque lleguen de la nube») |
| Access token | Solo en memoria del servidor; **nunca** llega al navegador | ADR 0005; `google.e2e-spec.ts` («si el access token en memoria deja de valer, renueva y sigue…», «ninguna respuesta… contiene el client secret ni la clave de cifrado») |

Cómo se revoca: borrar la cuenta en StudentOS revoca el token en Google y borra la fila (gancho `google` de `registerAccountDeletionHook` en `google.service.ts`; pruebas «el gancho de borrado de cuenta ("google") esta registrado y revoca + borra» y `public.e2e-spec.ts` «borra TODO lo del usuario A…»). El usuario también puede retirar el acceso en `myaccount.google.com/permissions`. En la 009 **no hay botón de desvincular** en la app (ADR 0007).

---

## `calendar.events.owned`
> StudentOS is a weekly planner for university students: classes, assignments, gym sessions, work shifts and daily habits in one schedule. Google Calendar is the core of the product, so access to the user's own calendars is requested when they sign in.
>
> We use this scope to (1) read the events of the user's primary calendar and show them in the StudentOS weekly view, so the student sees their real schedule, the app can detect time conflicts and it can suggest free time slots (computed from those same events), and (2) create, update and delete events in the primary calendar **only when the user explicitly does so in the app**: when they schedule a gym session, publish a study block or set up their recurring work shift (including weekly recurring series and shortening a series). StudentOS never creates, changes or deletes events on its own.
>
> All calls go through our server, always to the user's primary calendar. The content of calendar events is read on demand and is **not stored** in our database; we only keep the IDs of the events StudentOS itself created, so we can update or delete them later. We store one refresh token per user, encrypted with AES-256-GCM on the server; it is never sent to the browser. The user can revoke access at any time from their Google Account permissions page, and deleting their StudentOS account revokes the token in Google and deletes all their data.
>
> We chose the narrowest scope that covers these calls (events.list/get/instances/insert/patch/delete on the user's own primary calendar) instead of calendar.events or calendar.

| Afirmación | Respaldo |
|---|---|
| Lee eventos del calendario principal y los muestra | `google.controller.ts` (`GET calendar/events`, `…/instances`, `…/:eventId`); `components/calendar/WeeklyCalendar.tsx` |
| Detecta choques de horario | `components/calendar/` (`GoogleImpactModal.tsx`, `CalendarTimelineGrid.tsx`). **Revisar en la app tras la 009** antes de enviar |
| Sugiere huecos libres a partir de los mismos eventos | `fetchGoogleEventsAndBusyForWeek` (`apps/web/src/services/googleCalendar.ts`) convierte la respuesta de `events.list` en intervalos ocupados; `apps/web/src/utils/calendarSlotFinder.ts`. **Revisar en la app tras la 009** qué pantallas lo muestran |
| Escribe solo cuando el usuario lo ordena | Las escrituras salen de acciones del usuario en `App.tsx` (programar gym, publicar bloque, turno laboral). **Revisar en la app tras la 009** que ningún flujo escribe sin acción explícita (`video-guion.md`, paso 5) |
| Series semanales y recorte con `UNTIL` | `google.controller.ts` (PATCH «también recorta series recurrentes»); `google.e2e-spec.ts` («lista, crea (con RRULE y recordatorios), lee, actualiza (UNTIL), instancias y borra») |
| Siempre el calendario `primary` | `google.controller.ts` (rutas fijas a `calendars/primary`); `google.e2e-spec.ts` (rechaza ids con `..%2F`) |
| No se guarda el contenido de los eventos; solo los ids de los que creó la app | Tabla «Qué guarda» de arriba |
| Token cifrado, nunca en el navegador; revocación y borrado | Tabla «Qué guarda» y «Cómo se revoca» de arriba |
| Es el scope más estrecho | `scopes.md`, ADR 0008 |

## `openid`, `email`, `profile`
> Used for Sign in with Google, the only way to sign in to StudentOS, to identify the user's account. The basic profile (name and profile picture) is shown in the app header so the user can see which account is signed in, and the name is used as the initial display name of a new StudentOS profile, which the user can change. The email is also used to check that the Google Calendar connection belongs to the same account the user signed in with. We do not use this information for advertising or share it with third parties.

| Afirmación | Respaldo |
|---|---|
| Único método de entrada | ADR 0007 |
| `profile`: nombre y foto en la cabecera; nombre inicial del perfil nuevo | `apps/web/src/components/auth/useAuthState.ts` (`full_name`/`avatar_url` de `user_metadata`), `apps/web/src/utils/newAccountState.ts` (`getAccountDisplayName`). Lo añade Supabase al login (comprobado en producción el 2026-11-26, `scopes.md`) |
| Se comprueba que la cuenta de Calendar es la de la sesión | `google.e2e-spec.ts` («un token de otra cuenta de Google responde 409 google_account_mismatch y no guarda nada») |
| Sin publicidad ni cesión a terceros | Política de privacidad (`apps/web/public/legal/privacidad.html`); se revisa en el paso B1 |

## Declaración de uso limitado
Se mantiene literal en la política de privacidad (C5 d):
> The use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Pendiente antes de pegar estos textos en el formulario
- Repasar en la app desplegada con la 009 las filas marcadas «Revisar en la app tras la 009».
- [x] Supabase añade `profile` (comprobado el 2026-11-26): justificado arriba junto con `openid` y `email` (decisión del humano, 2026-11-27).
- **Comprobar con una cuenta real** que `calendar.events.owned` devuelve también los eventos de invitaciones (`scopes.md`). Es el único scope de lectura: de él dependen la vista semanal, los choques y los huecos libres. Si no los devuelve, hay que pasar a un scope más amplio (nueva decisión del humano), reescribir este texto y reverificar.
