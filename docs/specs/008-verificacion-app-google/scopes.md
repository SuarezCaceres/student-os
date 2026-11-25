# 008 · Tabla endpoint → scope (C9)

> Paso A1 del plan. Consultado en la referencia oficial de Google Calendar API v3 el **2026-11-25** (sección *Authorization* de cada método).
> Si cambia algo de esta tabla, cambia también `SCOPES_VERIFICADOS` en `apps/api/src/google/scopes-verificados.spec.ts` (C8), y eso obliga a volver a verificar la app.

## Scopes que pide hoy el servidor
`apps/api/src/google/google.constants.ts` → `GOOGLE_SCOPES`: `openid`, `email`, `calendar.readonly`, `calendar.events`.

## Qué endpoint usa cada scope
El proxy (`apps/api/src/google/google.controller.ts`) solo habla con el calendario `primary` del usuario.

| Ruta del proxy | Método de Google | Scopes que acepta la referencia oficial | Lo cubre hoy |
|---|---|---|---|
| `GET /google/calendar/primary` | [`calendars.get`](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get) | `calendar.readonly`, `calendar`, `calendar.app.created`, `calendar.calendars`, `calendar.calendars.readonly` | `calendar.readonly` |
| `GET /google/calendar/events` | [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) | `calendar.readonly`, `calendar`, `calendar.events.readonly`, `calendar.events`, `calendar.app.created`, `calendar.events.freebusy`, `calendar.events.owned`, `calendar.events.owned.readonly`, `calendar.events.public.readonly` | `calendar.events` (y `calendar.readonly`) |
| `GET /google/calendar/events/:id` | [`events.get`](https://developers.google.com/workspace/calendar/api/v3/reference/events/get) | Los mismos 9 que `events.list` | `calendar.events` (y `calendar.readonly`) |
| `GET /google/calendar/events/:id/instances` | [`events.instances`](https://developers.google.com/workspace/calendar/api/v3/reference/events/instances) | Los mismos 9 que `events.list` | `calendar.events` (y `calendar.readonly`) |
| `POST /google/calendar/events` | [`events.insert`](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) | `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned` | `calendar.events` |
| `PATCH /google/calendar/events/:id` | [`events.patch`](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch) | Los mismos 4 que `events.insert` | `calendar.events` |
| `DELETE /google/calendar/events/:id` | [`events.delete`](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete) | Los mismos 4 que `events.insert` | `calendar.events` |
| `POST /google/calendar/freebusy` | [`freebusy.query`](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query) | `calendar.readonly`, `calendar`, `calendar.events.freebusy`, `calendar.freebusy` | `calendar.readonly` |
| Callback de OAuth (cuenta conectada) | [`userinfo`](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo) | `openid` + `email` | `openid`, `email` |

## Para qué hace falta cada scope actual
| Scope | Endpoints que lo **necesitan** (ningún otro scope actual los cubre) | Conclusión |
|---|---|---|
| `openid`, `email` | `userinfo` (saber qué cuenta de Google se conectó) | Necesario |
| `calendar.events` | `events.insert`, `events.patch`, `events.delete` | Necesario: `calendar.readonly` no permite escribir |
| `calendar.readonly` | `calendars.get` y `freebusy.query` | Necesario **con el resto igual**: `calendar.events` no aparece en ninguno de los dos |

Resultado: con los scopes actuales no sobra ninguno. La duda de la spec sobre `calendars.get` queda cerrada: necesita `calendar.readonly` (o uno de los más estrechos de abajo).

## Hallazgo: existe un conjunto más estrecho (pregunta Q9, decide el humano)
La referencia oficial acepta scopes más estrechos que los actuales para todo lo que hace el proxy:

| Hoy | Alternativa más estrecha | Qué cubre | Qué permiso daría el usuario (texto de la página de autenticación) |
|---|---|---|---|
| `calendar.readonly` | `calendar.freebusy` | `freebusy.query` | Ver tu disponibilidad, no el contenido de los eventos |
| `calendar.readonly` | `calendar.calendars.readonly` | `calendars.get` | Ver título, zona horaria y otras propiedades del calendario, no sus eventos |
| `calendar.events` | `calendar.events.owned` | `events.list/get/instances/insert/patch/delete` | Eventos solo de calendarios **de los que es propietario** (el `primary` lo es) |

Además, `calendars.get` solo se usa para mostrar el nombre del calendario (`fetchPrimaryCalendarMetadata` en `apps/web/src/services/googleCalendar.ts`). Si se quita esa lectura, no haría falta ningún scope para ella.

Por qué importa: Google rechaza scopes más amplios de lo necesario, y cambiarlos después de la aprobación obliga a reverificar. Si se cambian, tiene que ser **antes** de declararlos en la consola (paso H2).

Lo que no se sabe todavía y hay que comprobar antes de decidir:
- Que `events.list` con `calendar.events.owned` sobre `primary` devuelve también los eventos a los que el usuario está **invitado** (los creó otra persona). Si no los devuelve, la detección de choques quedaría incompleta. Se comprueba con una cuenta real.
- La **clasificación** (sensible o no) de cada scope: la página de autenticación no la indica. Se confirma en la consola (*Data access*) antes de enviar.

Cambiar los scopes toca `GOOGLE_SCOPES`, `REQUIRED_EVENTS_SCOPE`, 009-C4 y el ADR 0005, y necesita tu aprobación expresa (plan, paso A1).

## Otros orígenes de scopes en el repo
- `apps/web/src/services/googleCalendar.ts` (transporte GIS en el navegador) pide todavía `openid profile email calendar.readonly calendar.events` con el mismo cliente de Google. La 009 lo retira. Mientras exista, Google podría ver `profile` pedido por la app: **no se envía la verificación hasta que la 009 esté en producción** (plan, bloque H2).
- El login con Supabase Auth (`apps/web/src/services/supabase.ts`) no fija scopes en `main`, así que usa los que Supabase pide por defecto. Hay que comprobar cuáles son tras la 009: deben ser un subconjunto de los declarados.

## Clasificación en la consola (lo rellena el humano en H2)
| Scope | Clasificación que muestra la consola | Captura |
|---|---|---|
| `openid` | pendiente | pendiente |
| `email` | pendiente | pendiente |
| `calendar.readonly` | pendiente | pendiente |
| `calendar.events` | pendiente | pendiente |
