# 008 · Tabla endpoint → scope (C9)

> Paso A1 del plan. Consultado en la referencia oficial de Google Calendar API v3 el **2026-11-25** (sección *Authorization* de cada método).
> Revisado el **2026-11-26** (revisión del ADR 0008): solo `calendar.events.owned`.
> Si cambia algo de los scopes pedidos, cambia la fuente única `VERIFIED_GOOGLE_CALENDAR_SCOPES` (`packages/shared/src/googleScopes.ts`) y las dos pruebas-candado que la fijan a mano: `apps/api/src/google/scopes-verificados.spec.ts` y `apps/web/src/services/googleLogin.test.ts` (C8). Eso obliga a volver a verificar la app.

## Scopes que pide la app (decisión del 2026-11-26)
- **Calendar:** solo `https://www.googleapis.com/auth/calendar.events.owned`. Fuente única: `VERIFIED_GOOGLE_CALENDAR_SCOPES` en `@student-os/shared`.
- **Login (web):** `GOOGLE_LOGIN_CALENDAR_SCOPES` (`apps/web/src/services/googleLogin.ts`) = la fuente única. Supabase añade los de identidad (ver «Otros orígenes»).
- **Reconexión (API):** `GOOGLE_SCOPES` (`apps/api/src/google/google.constants.ts`) = `openid`, `email` + la fuente única.

Historia: antes de la 008 eran `calendar.readonly` y `calendar.events`. El 2026-11-25 el humano decidió **estrechar todo** (pregunta Q9; ADR 0008) a `calendar.events.owned`, `calendar.freebusy` y `calendar.calendars.readonly`. El 2026-11-26 la revisión del PR #19 comprobó que la app no usaba `freebusy.query` ni `calendars.get` (los huecos libres salen de `events.list` y nada mostraba el nombre del calendario), así que se quitaron esos dos scopes y el código que los usaba.

## Qué endpoint usa cada scope
El proxy (`apps/api/src/google/google.controller.ts`) solo habla con los eventos del calendario `primary` del usuario.

| Ruta del proxy | Método de Google | Scopes que acepta la referencia oficial | Lo cubre |
|---|---|---|---|
| `GET /google/calendar/events` | [`events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) | `calendar.readonly`, `calendar`, `calendar.events.readonly`, `calendar.events`, `calendar.app.created`, `calendar.events.freebusy`, `calendar.events.owned`, `calendar.events.owned.readonly`, `calendar.events.public.readonly` | `calendar.events.owned` |
| `GET /google/calendar/events/:id` | [`events.get`](https://developers.google.com/workspace/calendar/api/v3/reference/events/get) | Los mismos 9 que `events.list` | `calendar.events.owned` |
| `GET /google/calendar/events/:id/instances` | [`events.instances`](https://developers.google.com/workspace/calendar/api/v3/reference/events/instances) | Los mismos 9 que `events.list` | `calendar.events.owned` |
| `POST /google/calendar/events` | [`events.insert`](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) | `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned` | `calendar.events.owned` |
| `PATCH /google/calendar/events/:id` | [`events.patch`](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch) | Los mismos 4 que `events.insert` | `calendar.events.owned` |
| `DELETE /google/calendar/events/:id` | [`events.delete`](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete) | Los mismos 4 que `events.insert` | `calendar.events.owned` |
| Callback de OAuth (cuenta conectada) | [`userinfo`](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo) | `openid` + `email` | `openid`, `email` |

## Para qué hace falta cada scope
| Scope | Endpoints que lo **necesitan** (ningún otro scope pedido los cubre) |
|---|---|
| `openid`, `email` | `userinfo` (saber qué cuenta de Google se conectó) |
| `profile` (lo añade Supabase, ver «Otros orígenes») | Nombre y foto de la cuenta: cabecera de la app (`apps/web/src/components/auth/useAuthState.ts`) y nombre inicial del perfil de una cuenta nueva (`apps/web/src/utils/newAccountState.ts`) |
| `calendar.events.owned` | `events.list` (también para calcular los huecos libres y los choques de la semana), `events.get`, `events.instances`, `events.insert`, `events.patch`, `events.delete` |

Cada scope declarado tiene al menos un endpoint que lo necesita, y cada endpoint está cubierto por un scope pedido. Las pruebas de integración lo comprueban: el servidor falso de Google (`apps/api/test/helpers/google-fake.ts`, `acceptedCalendarScopes`) responde 403 como Google si el token no tiene un scope aceptado por el endpoint, y la prueba del ciclo completo de eventos (`apps/api/test/google.e2e-spec.ts`) recorre todas las rutas del proxy.

Ya no hay rutas `GET /google/calendar/primary` (`calendars.get`) ni `POST /google/calendar/freebusy` (`freebusy.query`): una prueba de integración comprueba que responden 404 sin llamar a Google.

Los scopes anteriores eran más amplios: `calendar.readonly` deja ver y descargar **todos** los calendarios, y `calendar.events` deja ver y editar eventos de **todos** los calendarios.

## Pendiente antes de declararlos en la consola (paso H2)
- **Comprobar con una cuenta real** que `events.list` con `calendar.events.owned` sobre `primary` devuelve también los eventos a los que el usuario está **invitado** (los creó otra persona). Ahora es el único scope de lectura, así que de él dependen los huecos libres y la detección de choques. Si no los devuelve, habría que pasar a un scope más amplio (`calendar.events.readonly` para leer, además de `calendar.events.owned`, o `calendar.events`) con nueva decisión del humano y nueva verificación. El servidor falso no puede comprobarlo.
- [x] **Scopes de identidad que añade Supabase:** comprobado el 2026-11-26 con una cuenta real en producción. `google_connections.scopes` guardó `calendar.events.owned userinfo.email userinfo.profile openid`: Supabase **sí añade `profile`**. Decisión del humano (2026-11-27): **declararlo** (no sustituir el login de Supabase por un OAuth propio).
- **Clasificación** (sensible o no) de cada scope: la página de autenticación de Google no la indica. Se confirma en la consola (*Data access*) y se anota abajo.

## Otros orígenes de scopes en el repo
- **Login (009):** `apps/web/src/services/supabase.ts` pasa a Supabase Auth los scopes de Calendar de `GOOGLE_LOGIN_CALENDAR_SCOPES` (`apps/web/src/services/googleLogin.ts`, derivado de la fuente única). La E2E `02-login.spec.ts` comprueba que la web pide `calendar.events.owned` y no pide `profile` ni scopes amplios o sin uso. Supabase añade por su cuenta los scopes de identidad de su proveedor Google. Comprobado en producción (2026-11-26): añade `openid`, `userinfo.email` y `userinfo.profile`. **`profile` se declara** en la consola, se justifica en `justificaciones.md` y se menciona en la política (bloque B). La web no lo pide (la E2E sigue comprobándolo: lo pide Supabase, no nuestro código) y `GOOGLE_SCOPES` del API **no** lo lleva, porque el API no usa el nombre ni la foto.
- El transporte GIS del navegador (`googleCalendar.ts`) ya no pide scopes propios en la 009: solo habla con el proxy del API.

## Clasificación en la consola (lo rellena el humano en H2)
| Scope | Clasificación que muestra la consola | Captura |
|---|---|---|
| `openid` | pendiente | pendiente |
| `email` | pendiente | pendiente |
| `calendar.events.owned` | pendiente | pendiente |
| `profile` (lo añade Supabase; se declara) | pendiente | pendiente |
