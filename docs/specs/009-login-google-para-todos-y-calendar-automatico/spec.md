# Spec · 009 · Login solo con Google para todos y Calendar vinculado automáticamente

> Estado: **borrador** (a la espera de tu aprobación)
> Dice **qué** y **por qué**, no **cómo**. El cómo va en `plan.md`, después de aprobar esta spec.
> Prioridad: Alto, marcada como importante (`docs/TASKS.md` → A1). Depende de la producción (007) y de la verificación de Google (008).

## Problema
Hoy la app tiene **tres caminos de entrada** y ninguno da lo que se quiere:
1. Google por GIS (login + Calendar en un clic, pero con un token de 1 hora que vive en el navegador).
2. Google por Supabase (la nube): el login y la vinculación de Calendar son **dos pasos separados**, y el segundo exige pulsar «Conectar».
3. Un registro con correo y contraseña que es una **cuenta falsa**: se guarda solo en el navegador, sin servidor, y no protege nada.

Además, la web desplegada no tiene la API ni las variables de Supabase, así que en producción el login con la nube no existe, y el acceso está limitado a 100 usuarios de prueba de Google. Una persona nueva no puede entrar con su cuenta y encontrarse su calendario ya conectado.

## Objetivo
Cualquier persona entra **únicamente con su cuenta de Google**. En ese mismo paso concede los permisos de Calendar y su calendario queda **ya vinculado, sin pulsar ningún botón**, y de forma que siga funcionando al día siguiente. Todo lo que hace la app con Calendar hoy (leer, publicar gym, turno de trabajo y bloques marcados) sigue igual.

## Alcance
- **Incluye:**
  - Login exclusivamente con Google, para cualquier cuenta de Google (en producción, tras 007 y 008).
  - Eliminar el registro y el login con correo y contraseña, el modo local sin cuenta y «Explorar demo en vivo». Sin sesión solo se ve la landing pública.
  - Pedir en el mismo consentimiento de login los permisos de hoy: `openid`, `email`, `calendar.readonly` y `calendar.events`.
  - Guardar el refresh token cifrado en el servidor al terminar el login, y vincular Calendar sin ningún paso manual.
  - Quitar de la interfaz el botón «Conectar Google Calendar» y no ofrecer ninguno para desvincular.
  - Un único modo de funcionamiento: la nube (se retira el transporte GIS con token de 1 hora).
- **No incluye:**
  - Cambiar cómo se muestra o se sincroniza el calendario: se lee todo de Google y se publican gym, turno de trabajo y los bloques que el usuario marque (decisión del humano).
  - Otros proveedores de login (Apple, correo, etc.) ni otros calendarios.
  - Producción y verificación de Google (son 007 y 008; esta spec depende de ellas).
  - Aislar y guardar los datos por usuario (es la 010).

## Historias de usuario
- Como estudiante, quiero entrar con mi cuenta de Google y ver mi calendario ya conectado, para no configurar nada.
- Como estudiante, quiero que mi conexión siga activa al día siguiente, para no volver a autorizar cada hora.
- Como persona sin cuenta, quiero ver una landing que me explique el producto y un único botón «Continuar con Google», para saber cómo entrar.
- Como responsable del producto, quiero que ningún token de Google llegue al navegador, para proteger a los usuarios.

## Criterios de aceptación
Cada criterio debe poder comprobarse con una prueba. Se copian a `docs/features.json`.
- **C1:** Dado un visitante sin sesión, cuando abre la web, entonces ve la landing con un único acceso, «Continuar con Google», y no hay formulario de correo y contraseña, ni «Crear cuenta», ni «Explorar demo».
- **C2:** Dado un visitante sin sesión, cuando intenta abrir la app (por ruta o recargando), entonces no ve ningún dato ni módulo y vuelve a la landing.
- **C3:** Dada una persona que entra por primera vez con Google, cuando termina el consentimiento, entonces su perfil se crea en el servidor y entra a la app.
- **C4:** Dada la pantalla de consentimiento de Google, cuando se muestra, entonces pide exactamente `openid`, `email`, `calendar.readonly` y `calendar.events`.
- **C5:** Dado un usuario que acaba de entrar y concedió Calendar, cuando consulta su estado de Calendar, entonces aparece conectado sin que haya pulsado ningún botón, y el servidor guarda su refresh token cifrado.
- **C6:** Dada la interfaz con sesión iniciada, cuando se revisan los controles de calendario, entonces no existe un botón «Conectar Google Calendar» ni uno para desvincular; solo un indicador de estado.
- **C7:** Dado un usuario con Calendar conectado, cuando abre el calendario de la app, entonces ve sus eventos de Google sin acción manual, y se actualizan al volver a la ventana.
- **C8:** Dado un usuario con Calendar conectado, cuando se publican su horario de gym, su turno de trabajo o un bloque marcado para Google, entonces el evento aparece en su Google Calendar real (el comportamiento actual se mantiene).
- **C9:** Dado un usuario que no concede el permiso de Calendar, cuando termina el login, entonces **[por decidir, ver Preguntas abiertas]**.
- **C10:** Dado cualquier momento de la sesión, cuando se inspecciona el almacenamiento y el tráfico del navegador, entonces no hay ningún access token ni refresh token de Google.
- **C11:** Dado un usuario que cierra sesión, cuando la app termina de cerrarla, entonces vuelve a la landing y el siguiente usuario del mismo navegador no ve ni hereda datos del anterior.
- **C12:** Dada una cuenta de Google cualquiera (no incluida en la lista de usuarios de prueba), cuando intenta entrar en producción, entonces entra sin la advertencia de «app no verificada» (requiere 007 y 008).
- **C13:** Dado un usuario que borra su cuenta, cuando termina el borrado, entonces su refresh token se revoca en Google y se elimina del servidor (se mantiene lo que ya existe).

## Casos límite y errores
- **El usuario desmarca Calendar en la pantalla de Google** (Google permite permisos granulares): ver C9 y Preguntas abiertas.
- **El usuario revoca el acceso desde su cuenta de Google:** el servidor detecta el refresh inválido (`needsReauth`, hoy respuesta 409) y la app debe pedir un nuevo consentimiento al volver a entrar, sin dejar al usuario en un bucle.
- **Google no entrega refresh token** (por ejemplo, una cuenta que ya había autorizado la app): el flujo debe forzar el consentimiento (`prompt=consent`, `access_type=offline`, como hoy).
- **Cuenta de Google Workspace con Calendar deshabilitado o bloqueado por el administrador:** debe poder entrar o recibir un mensaje claro, sin error técnico.
- **Sin conexión, ventana emergente o redirección bloqueada, o cierre de pestaña a mitad del consentimiento:** mensaje útil y posibilidad de reintentar.
- **Cambio de cuenta en el mismo navegador:** los datos de una persona nunca deben aparecer ni subirse a la cuenta de otra (comparte riesgo con 010).
- **Personas que ya usan el prototipo en local:** ver Preguntas abiertas.
- **BUG-01 (cerrar sesión no vuelve a la landing)** afecta directamente a C11 y debe corregirse dentro o antes de esta funcionalidad.

## Zonas protegidas que toca
Esta funcionalidad toca el **importador del primer inicio**, el **cifrado del token de Google** y el **borrado de cuenta**. Según `AGENTS.md`, hay que preguntar antes de modificar cualquiera de ellos. Rotar `GOOGLE_TOKEN_ENC_KEY` no forma parte del alcance.

## Cosas que esta spec deja obsoletas (requieren tu aprobación)
- **Funcionalidad 001 (modo local sin cuenta, `hecho`):** deja de ser un objetivo del producto.
- **ADR 0004 (modo local y modo nube):** se reemplazaría por un ADR nuevo.
- **`docs/project/PROJECT.md` y `AGENTS.md`:** dicen «funciona sin cuenta, en local».
- **Pruebas E2E:** `01-nocloud.spec.ts`, el flujo de registro local y el importador deben reescribirse.

## Preguntas abiertas
1. **¿Calendar es obligatorio para entrar o opcional (C9)?** Recomendado: opcional. Quien no concede Calendar entra igual, ve un aviso fijo y se le vuelve a pedir el permiso en el siguiente inicio de sesión. Si es obligatorio, quien lo desmarque no puede usar la app.
2. **¿Qué pasa con los datos locales que ya existen** (el prototipo guarda todo en `localStorage`)? Opciones: ofrecer subirlos una sola vez en el primer login con Google (reutilizando el importador, que es zona protegida) o descartarlos.
3. **¿La landing pública se mantiene?** Se asume que sí, como única pantalla sin sesión.
4. **¿Basta con no ofrecer botón de desvincular?** El usuario podría revocar desde su cuenta de Google o borrando la cuenta. Hay que confirmar con `docs/google-verification-checklist.md` si Google lo acepta para la verificación (008).
5. **¿Se aprueba dejar obsoleta la funcionalidad 001 y el ADR 0004?**
