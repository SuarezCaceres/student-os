# ADR 0007 · Login solo con Google y Calendar vinculado al entrar

- **Fecha:** 2026-11-24
- **Estado:** aceptada (reemplaza al ADR 0004 y ajusta el 0005)

## Contexto
El ADR 0004 mantenía dos modos: local sin cuenta y nube con sesión, con un importador para el primer inicio. En la práctica había tres caminos de entrada (Google por Identity Services, Google por Supabase y una cuenta local falsa), Calendar se vinculaba con un botón aparte y en producción solo funcionaba el camino antiguo (token de 1 hora en el navegador). El humano pidió que cualquier persona entre con su cuenta de Google y que su Calendar quede ya vinculado, sin pulsar nada (spec 009).

## Decisión
- **Una sola entrada:** «Continuar con Google» (Supabase Auth, PKCE), con `openid`, `email`, `calendar.readonly` y `calendar.events` (desde el 2026-11-25, los más estrechos del ADR 0008), `access_type=offline` y `prompt=consent select_account`. Se retiran la cuenta local, el registro con correo, la demo y el modo local (`useLocalStorage`).
- **Calendar forma parte del login:** al volver, la web entrega **una sola vez** el `provider_refresh_token` a `POST /google/link-login`. El servidor lo valida (lo canjea en Google, exige el permiso de eventos y que el correo coincida con el de la sesión) y lo guarda cifrado como en el ADR 0005. Si falta el permiso, **no se entra**: se cierra la sesión y se explica cómo reintentarlo.
- **El navegador nunca persiste un token de Google:** Supabase no guarda los tokens del proveedor, y `supabase-js` los escribiría en `localStorage` con la sesión; un adaptador de almacenamiento (`createProviderTokenStrippingStorage`) los elimina antes de guardar y el refresh token solo vive en memoria hasta enviarlo al servidor (criterio C10 relajado a «nunca persistente»). El proveedor Google de Supabase debe usar el **mismo cliente OAuth** que el API (los refresh tokens están ligados al cliente).
- **Sin importador:** si este navegador no tiene a la cuenta ya arrancada, lo que hubiera en `localStorage` (de otra persona o del prototipo) se **descarta sin subirlo ni preguntar**. Con la nube vacía se sube el estado de una cuenta nueva (vacío en todos los módulos y con el nombre de Google; spec 010); con datos en la nube, estos reemplazan al estado local.
- **Se retiran** el transporte de Google Identity Services, el botón «Conectar», el de desvincular y la vuelta del consentimiento propio del API en la web. No hay desvincular: borrar la cuenta revoca el token en Google.

## Alternativas consideradas
- **Seguir con los dos modos (ADR 0004):** descartada por el humano: login estrictamente con Google, sin modo local ni demo.
- **Dejar el login por Identity Services:** descartada: el token dura 1 hora, vive en el navegador y no cubre a todos los dispositivos.
- **Esperar a que Supabase conserve el token del proveedor:** descartada: su documentación indica que no lo guarda y recomienda enviarlo a un servidor propio.
- **Migrar los datos locales con un importador:** descartada por el humano: se descartan; el riesgo de subir los datos de otra persona a una cuenta pesa más que conservarlos.

## Consecuencias
- Quien tenía datos locales del prototipo **los pierde al entrar** (el modal lo avisa antes). Entrar sin dar permiso de Calendar no es posible.
- **No se puede fusionar ni desplegar antes de tener producción (spec 007):** Vercel hoy no tiene variables de Supabase y, sin el login antiguo, nadie podría entrar. Mientras la verificación de Google (008) no se apruebe, el login admite 100 usuarios de prueba y muestra «app no verificada».
- Al cerrar sesión se intenta subir lo pendiente (máximo 5 s) y, si no se puede, se avisa antes de perderlo (spec 010). El cierre de sesión sin red es solo local: el token queda sin revocar en el servidor hasta que caduca.
- Las zonas protegidas siguen siendo el borrado/exportación de cuenta, el cifrado del token y el motor de sync (`apps/web/src/sync/`), cuya regla de descarte protege los datos entre cuentas.
