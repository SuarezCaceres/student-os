# Checklist de verificación de Google (StudentOS)

Objetivo: pasar la pantalla de consentimiento OAuth de **Testing** a **In production** y que Google **verifique** la app, para que los usuarios no vean el aviso de "Google no ha verificado esta app" ni choquen con el tope de usuarios.

> Esto lo hace el **usuario** en Google Cloud Console (compuerta humana, ver `PLAN_BACKEND.md` §7). Nada de esto se automatiza desde el repo. Lo que sí está listo en el repo: páginas legales, borrado/exportación de cuenta y los textos de justificación de abajo.

## 0. Por qué importa (qué pasa si NO se verifica)

| Situación | Consecuencia |
| :--- | :--- |
| Pantalla de consentimiento en **Testing** | Solo usuarios de prueba (máx. 100). **El refresh token caduca a los 7 días**: la sincronización con Calendar se rompe cada semana. |
| **In production sin verificar** | Aviso "Google no ha verificado esta app" al conectar. **Tope de 100 usuarios** en total (cuenta de por vida, no se libera al desconectarse). Los refresh tokens ya no caducan a los 7 días. |
| **In production y verificada** | Sin aviso y sin tope de 100. |

La verificación puede tardar **semanas** (suele haber varias rondas de correo con el equipo de Google). Mientras tanto el producto funciona para ≤ 100 usuarios con el aviso. Recomendación: pasar a *In production* ya (para que los tokens no caduquen) y enviar la verificación en paralelo.

## 1. Requisitos previos (hacer antes de enviar)

- [ ] **Dominio propio**. `*.vercel.app` NO sirve: es un sufijo público y no se puede verificar como dominio autorizado. Comprar un dominio (p. ej. `studentos.app`) y asignarlo al proyecto de Vercel.
- [ ] **Verificar la propiedad del dominio** en [Google Search Console](https://search.google.com/search-console) con la misma cuenta de Google que es propietaria/editora del proyecto de Cloud.
- [ ] Páginas legales publicadas en ese dominio y accesibles **sin iniciar sesión**:
  - Política de privacidad: `https://<tu-dominio>/legal/privacidad.html`
  - Términos de uso: `https://<tu-dominio>/legal/terminos.html`
- [ ] **Completar los marcadores** de ambas páginas (`[CORREO DE CONTACTO]`, `[NOMBRE DEL RESPONSABLE]`, `[PAÍS O JURISDICCIÓN]`). Google rechaza políticas con datos de contacto vacíos o de relleno. Buscar con: `grep -rn "\[CORREO DE CONTACTO\]\|\[NOMBRE DEL RESPONSABLE\]\|\[PAÍS O JURISDICCIÓN\]" apps/web/public/legal`
- [ ] **Enlace a la política de privacidad visible en la página de inicio** (pie de la landing) y en la pantalla donde se pide el acceso: montar `components/legal/LegalLinks.tsx`. Google comprueba que el enlace de la pantalla de consentimiento coincida con uno visible en la home.
- [ ] Correo de soporte y de contacto del desarrollador que **lees de verdad** (Google escribe ahí).
- [ ] Logotipo de la app (120×120 px, PNG/JPG, < 1 MB) sin marcas de Google.
- [ ] Redirect URIs de producción en el cliente OAuth: solo **HTTPS** y exactas (sin comodines). Incluir el callback de Supabase Auth (`https://<ref>.supabase.co/auth/v1/callback`) y el callback del flujo de Calendar del agente GOOGLE.
- [ ] **Borrado de cuenta y exportación funcionando** y probados en producción (Google pregunta cómo el usuario borra sus datos y revoca el acceso): `DELETE /account` y `GET /account/export`; la revocación del token de Google la hace el gancho de borrado del módulo GOOGLE.
- [ ] Probar con una cuenta de Google que **no** sea la del desarrollador.

## 2. Pantalla de consentimiento (Google Auth Platform → Branding / Audience / Data access)

- [ ] **Nombre de la app**: igual al que ven los usuarios ("StudentOS"). No usar "Google" ni nombres engañosos.
- [ ] **Tipo de usuario**: External.
- [ ] **Dominios autorizados**: tu dominio verificado (y `supabase.co` si la consola lo pide por el redirect de Supabase).
- [ ] **URL de la página de inicio**: `https://<tu-dominio>/`
- [ ] **URL de política de privacidad** y **URL de términos**: las del punto 1.
- [ ] **Scopes** (pestaña *Data access*): declarar **solo** los que la app usa (sección 3).
- [ ] **Estado de publicación**: *Publish app* → **In production**.
- [ ] Enviar a verificación (*Verification Center*).

## 3. Scopes: mínimo necesario y justificación

Estado actual en el código (`apps/web/src/services/googleCalendar.ts`): `openid profile email`, `calendar.readonly`, `calendar.events`.

| Scope | Para qué lo usa StudentOS | Clasificación* |
| :--- | :--- | :--- |
| `openid`, `email`, `profile` | Iniciar sesión con Google (Supabase Auth) y mostrar el nombre. | No sensible |
| `https://www.googleapis.com/auth/calendar.events` | Leer los eventos del calendario principal para evitar choques y encontrar huecos; crear, modificar y eliminar **solo** los eventos de sesiones de gym que el usuario programa (incluye series con `RRULE`/`UNTIL`). | Sensible |
| `https://www.googleapis.com/auth/calendar.readonly` | Hoy se usa para leer datos del calendario principal (nombre del calendario, disponibilidad). | Sensible |

\* Los scopes de Calendar figuran como **sensibles** (no "restringidos"), por lo que **no** exigen la evaluación de seguridad anual (CASA). Confírmalo en la lista de scopes de la consola antes de enviar.

**Acción de minimización (revisar con el agente/dueño de GOOGLE antes de enviar):** Google rechaza scopes más amplios de lo necesario. Comprobar en la documentación de cada endpoint que se llama (`events.*`, `calendars.get`, `freebusy.query`) cuál es el scope **más estrecho** aceptado. Si todo se cubre con `calendar.events`, **retirar `calendar.readonly`** del flujo y de la consola. Si hace falta algo más que `calendar.events`, justificarlo con el endpoint concreto. No se declara `calendar` (acceso total) ni ningún scope de Drive/Gmail.

### Textos de justificación (para pegar en el formulario; Google los revisa en inglés)

**calendar.events**

> StudentOS is a planner for university students. The user can optionally connect Google Calendar so the app can (1) read the events of their primary calendar to show their weekly schedule and detect conflicts, (2) find free time slots, and (3) create, update and delete calendar events for the gym sessions the user explicitly schedules inside StudentOS (including weekly recurring series). The app only writes events when the user triggers the action in the UI. Calendar content is read on demand and is not stored in our database. We store only an encrypted refresh token (AES-256-GCM, server side) so the connection works across sessions; it is never exposed to the browser. The user can disconnect at any time from the app (we revoke the token and delete it) or from their Google account permissions, and can delete their whole account from within the app.

**calendar.readonly** (solo si tras la minimización sigue siendo necesario)

> Used to read the name of the user's primary calendar and the free/busy information needed to suggest conflict-free time slots. No data obtained with this scope is written, shared or stored beyond the user's session.

**openid / email / profile**

> Used only for Sign in with Google: to identify the account and show the user's name. We do not use it for advertising.

**Declaración de uso limitado** (ya incluida en la política de privacidad; no quitarla): *"The use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements."*

## 4. Vídeo de demostración (YouTube, "No listado")

Requisitos de Google: en inglés (o con subtítulos), mostrar el flujo OAuth completo y cómo se usa cada scope.

- [ ] Grabar con una cuenta de Google normal en el **dominio de producción** (no `localhost`).
- [ ] Mostrar la barra de direcciones con el **client ID** visible en la URL de la pantalla de consentimiento (`client_id=...`).
- [ ] Recorrido sugerido (≈ 3–5 min):
  1. Abrir la home → mostrar el enlace visible a la política de privacidad.
  2. Pulsar "Continuar con Google" → pantalla de consentimiento (nombre de la app, scopes solicitados). Aceptar.
  3. Conectar Google Calendar → mostrar de nuevo la pantalla con los scopes de Calendar.
  4. Mostrar la vista de horario leyendo eventos reales (`calendar.events` lectura).
  5. Programar una sesión de gym → ver el evento creado en calendar.google.com; editarlo y borrarlo desde la app (`calendar.events` escritura).
  6. Desconectar Google Calendar desde la app → ver que el permiso desaparece en `myaccount.google.com/permissions`.
  7. Mostrar "Descargar mis datos" y "Borrar mi cuenta" (con la confirmación escrita).
- [ ] Narración o subtítulos que digan **qué dato se usa y para qué** en cada paso.
- [ ] Pegar la URL del vídeo en el formulario de verificación.

## 5. Envío y seguimiento

- [ ] Rellenar el formulario de verificación: dominio, URLs, justificación de cada scope, vídeo.
- [ ] Mantener abierto el correo de contacto; responder en pocos días (si no, la solicitud se cierra).
- [ ] Si piden cambios (política, scopes, vídeo), corregir y responder en el **mismo hilo**.
- [ ] Tras la aprobación: comprobar que el aviso de "app no verificada" ya no aparece.
- [ ] Acordarse de que **cambiar los scopes** más adelante obliga a volver a verificar.

## 6. Mientras no esté verificada

- Máximo **100 usuarios** en total y aviso de app no verificada (el usuario debe pulsar "Avanzado → Ir a StudentOS").
- Con la app en *Testing*: solo usuarios de prueba y **refresh token de 7 días** (la sync de Calendar se cae). Por eso conviene pasar a *In production* aunque aún no esté verificada.
- Vigilar el contador de usuarios en la consola (*Audience*): el tope se refiere a quienes autorizan scopes sensibles (Calendar); el inicio de sesión básico por sí solo no debería consumirlo (confírmalo en la propia consola).
