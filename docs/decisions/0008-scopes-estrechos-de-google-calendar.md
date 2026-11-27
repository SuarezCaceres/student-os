# ADR 0008 · Scopes estrechos de Google Calendar

- **Fecha:** 2026-11-25
- **Estado:** aceptada (ajusta los scopes de los ADR 0005 y 0007; decisión del humano en la pregunta Q9 de la spec 008)

## Contexto
Para verificar la app en Google (spec 008) hay que demostrar que cada scope es el mínimo necesario. La tabla endpoint → scope (`docs/specs/008-verificacion-app-google/scopes.md`, criterio C9) mostró que la referencia oficial de Calendar API v3 acepta scopes más estrechos que `calendar.readonly` y `calendar.events` para todo lo que hace el proxy, que siempre trabaja sobre el calendario `primary` del usuario. Google rechaza scopes más amplios de lo necesario, y cambiarlos después de la aprobación obliga a reverificar.

## Decisión
La app pide `openid`, `email` y tres scopes de Calendar, cada uno el más estrecho que cubre su uso:
- `calendar.events.owned`: leer, crear, modificar y borrar eventos de los calendarios de los que el usuario es propietario (`events.list/get/instances/insert/patch/delete` sobre `primary`). Es el permiso obligatorio para entrar (`REQUIRED_EVENTS_SCOPE`).
- `calendar.freebusy`: disponibilidad (`freebusy.query`).
- `calendar.calendars.readonly`: propiedades del calendario principal, como su nombre (`calendars.get`).

Se dejan de pedir `calendar.readonly` (ver y descargar **todos** los calendarios) y `calendar.events` (eventos de **todos** los calendarios). La fuente única es `GOOGLE_SCOPES` en `apps/api/src/google/google.constants.ts`; la web la repite en `GOOGLE_LOGIN_CALENDAR_SCOPES` y la prueba `scopes-verificados.spec.ts` fija la lista.

## Alternativas consideradas
- **Mantener `calendar.readonly` y `calendar.events`:** descartada; son más amplios de lo que usa la app y Google podría pedir estrecharlos durante la revisión, con vídeo y textos que rehacer.
- **Estrechar solo la lectura** (`calendar.freebusy` y quitar `calendars.get`, manteniendo `calendar.events`): descartada por el humano en favor de estrechar todo.

## Consecuencias
- **Riesgo por comprobar con una cuenta real antes de declarar los scopes en la consola (paso H2 de la 008):** que `events.list` con `calendar.events.owned` devuelve también los eventos a los que el usuario está invitado. Si no, la detección de choques quedaría incompleta y habría que volver a `calendar.events.readonly` o `calendar.events`.
- Los usuarios que ya conectaron Calendar con los scopes antiguos conservan su token (sigue valiendo para todos los endpoints; no se rota la clave de cifrado). En producción no hay usuarios todavía (007 sin desplegar).
- El servidor falso de Google de las pruebas de integración (`apps/api/test/helpers/google-fake.ts`) responde 403 si el token no tiene un scope aceptado por el endpoint, según la misma tabla oficial.
- La política de privacidad debe listar estos scopes (paso B1 de la 008), y la consola de Google debe declarar exactamente estos.

## Revisión 2026-11-26 · Solo `calendar.events.owned`
La revisión independiente del PR #19 comprobó que la app **no usa** dos de los tres scopes de Calendar elegidos arriba:
- `calendars.get` (`calendar.calendars.readonly`): la única función que lo llamaba (`fetchPrimaryCalendarMetadata`) se borró en la spec 009 (commit `bc94d96`). El campo `calendarName` de la meta local se leía en el modal de Calendar, pero nada lo rellenaba.
- `freebusy.query` (`calendar.freebusy`): `fetchGoogleBusyIntervalsForWeek` solo se llamaba desde pruebas. Los huecos libres y los choques salen de `events.list` (`fetchGoogleEventsAndBusyForWeek`), que ya cubre `calendar.events.owned`.

Google exige que cada scope declarado tenga un uso visible en el vídeo y una justificación; declarar scopes sin uso es motivo de rechazo. **Decisión (el humano la delegó, 2026-11-26): pedir solo `openid`, `email` y `https://www.googleapis.com/auth/calendar.events.owned`.** Se retiró el código muerto que dependía de los otros dos scopes (la función del web, los mapeos del proxy web, las rutas `GET /google/calendar/primary` y `POST /google/calendar/freebusy` del API y su soporte en los servidores falsos de Google).

Además, la lista de scopes de Calendar vive ahora en un único sitio: `VERIFIED_GOOGLE_CALENDAR_SCOPES` en `@student-os/shared` (`packages/shared/src/googleScopes.ts`). De ella derivan `GOOGLE_SCOPES` en el API (que añade `openid email`) y `GOOGLE_LOGIN_CALENDAR_SCOPES` en el web (la que de verdad pide el login). Cada lado tiene su prueba-candado con la lista escrita a mano y el aviso de reverificación (`apps/api/src/google/scopes-verificados.spec.ts` y `apps/web/src/services/googleLogin.test.ts`). Lo que dice la sección «Decisión» sobre la fuente única en `google.constants.ts` queda sustituido por esto.

Consecuencias que se mantienen o cambian:
- **Sigue pendiente**, y ahora pesa más porque `calendar.events.owned` es el único scope de lectura: comprobar con una cuenta real que `events.list` con este scope devuelve también los eventos de invitaciones. Si no, habría que pasar a `calendar.events.readonly` (lectura) además de `calendar.events.owned` (escritura), o a `calendar.events`, y reverificar.
- **También pendiente:** qué scopes de identidad añade Supabase por su cuenta al redirigir a Google (`openid`, `email` y probablemente `profile`). La web no los pide, pero la consola debe declarar los que el usuario ve en el consentimiento.
- Si en el futuro hace falta disponibilidad de otros calendarios o el nombre del calendario, será una funcionalidad nueva con su propio scope y una reverificación.
