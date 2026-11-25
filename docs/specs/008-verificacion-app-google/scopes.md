# 008 · Tabla endpoint → scope (C9)

> Paso A1 del plan. Consultado en la referencia oficial de Google Calendar API v3 el **2026-11-25** (sección *Authorization* de cada método).
> Si cambia algo de los scopes pedidos, cambia también `SCOPES_VERIFICADOS` en `apps/api/src/google/scopes-verificados.spec.ts` (C8), y eso obliga a volver a verificar la app.

## Scopes que pide el servidor (decisión del 2026-11-25)
`apps/api/src/google/google.constants.ts` → `GOOGLE_SCOPES`: `openid`, `email`, `calendar.events.owned`, `calendar.freebusy` y `calendar.calendars.readonly`.

Antes eran `calendar.readonly` y `calendar.events`. El humano decidió **estrechar todo** (pregunta Q9 de la spec; ADR 0008), después de que esta tabla mostrara que había scopes más estrechos que cubrían todo lo que hace el proxy.

## Qué endpoint usa cada scope
El proxy (`apps/api/src/google/google.controller.ts`) solo habla con el calendario `primary` del usuario.

| Ruta del proxy | Método de Google | Scopes que acepta la referencia oficial | Lo cubre |
|---|---|---|---|
| `GET /google/calendar/primary` | [`calendars.get`](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get) | `calendar.readonly`, `calendar`, `calendar.app.created`, `calendar.calendars`, `calendar.calendars.readonly` | `calendar.calendars.readonly` |
| `GET /google/calendar/events` | [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) | `calendar.readonly`, `calendar`, `calendar.events.readonly`, `calendar.events`, `calendar.app.created`, `calendar.events.freebusy`, `calendar.events.owned`, `calendar.events.owned.readonly`, `calendar.events.public.readonly` | `calendar.events.owned` |
| `GET /google/calendar/events/:id` | [`events.get`](https://developers.google.com/workspace/calendar/api/v3/reference/events/get) | Los mismos 9 que `events.list` | `calendar.events.owned` |
| `GET /google/calendar/events/:id/instances` | [`events.instances`](https://developers.google.com/workspace/calendar/api/v3/reference/events/instances) | Los mismos 9 que `events.list` | `calendar.events.owned` |
| `POST /google/calendar/events` | [`events.insert`](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) | `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned` | `calendar.events.owned` |
| `PATCH /google/calendar/events/:id` | [`events.patch`](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch) | Los mismos 4 que `events.insert` | `calendar.events.owned` |
| `DELETE /google/calendar/events/:id` | [`events.delete`](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete) | Los mismos 4 que `events.insert` | `calendar.events.owned` |
| `POST /google/calendar/freebusy` | [`freebusy.query`](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) | `calendar.readonly`, `calendar`, `calendar.events.freebusy`, `calendar.freebusy` | `calendar.freebusy` |
| Callback de OAuth (cuenta conectada) | [`userinfo`](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo) | `openid` + `email` | `openid`, `email` |

## Para qué hace falta cada scope
| Scope | Endpoints que lo **necesitan** (ningún otro scope pedido los cubre) |
|---|---|
| `openid`, `email` | `userinfo` (saber qué cuenta de Google se conectó) |
| `calendar.events.owned` | `events.list`, `events.get`, `events.instances`, `events.insert`, `events.patch`, `events.delete` |
| `calendar.freebusy` | `freebusy.query` |
| `calendar.calendars.readonly` | `calendars.get` (nombre del calendario principal, `fetchPrimaryCalendarMetadata`) |

Cada scope declarado tiene al menos un endpoint que lo necesita, y cada endpoint está cubierto por un scope pedido. Las pruebas de integración lo comprueban: el servidor falso de Google (`apps/api/test/helpers/google-fake.ts`, `acceptedCalendarScopes`) responde 403 como Google si el token no tiene un scope aceptado por el endpoint, y la prueba del ciclo completo de eventos (`apps/api/test/google.e2e-spec.ts`) recorre todas las rutas del proxy.

Los scopes anteriores eran más amplios: `calendar.readonly` deja ver y descargar **todos** los calendarios, y `calendar.events` deja ver y editar eventos de **todos** los calendarios.

## Pendiente antes de declararlos en la consola (paso H2)
- **Comprobar con una cuenta real** que `events.list` con `calendar.events.owned` sobre `primary` devuelve también los eventos a los que el usuario está **invitado** (los creó otra persona). Si no los devuelve, la detección de choques quedaría incompleta y habría que volver a `calendar.events.readonly` o `calendar.events` (nueva decisión del humano). El servidor falso no puede comprobarlo.
- **Clasificación** (sensible o no) de cada scope: la página de autenticación de Google no la indica. Se confirma en la consola (*Data access*) y se anota abajo.

## Otros orígenes de scopes en el repo
- **Login (009):** `apps/web/src/services/supabase.ts` pasa a Supabase Auth los scopes de Calendar de `GOOGLE_LOGIN_CALENDAR_SCOPES` (`apps/web/src/services/googleLogin.ts`). Supabase añade por su cuenta los scopes de identidad de su proveedor Google. **Hay que comprobar en la URL real de consentimiento** (paso H2, con la 007 desplegada) qué scopes de identidad añade: si incluye `profile`, hay que declararlo en la consola, justificarlo y mencionarlo en la política, o quitarlo, y decidir si `GOOGLE_SCOPES` también lo lleva.
- El transporte GIS del navegador (`googleCalendar.ts`) ya no pide scopes propios en la 009: solo habla con el proxy del API.

## Clasificación en la consola (lo rellena el humano en H2)
| Scope | Clasificación que muestra la consola | Captura |
|---|---|---|
| `openid` | pendiente | pendiente |
| `email` | pendiente | pendiente |
| `calendar.events.owned` | pendiente | pendiente |
| `calendar.freebusy` | pendiente | pendiente |
| `calendar.calendars.readonly` | pendiente | pendiente |
