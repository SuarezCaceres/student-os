# Spec · 009 · Login solo con Google para todos y Calendar vinculado automáticamente

> Estado: **aprobada** por el humano el 2026-11-24 (incluye retirar la funcionalidad 003, el importador, y dejar obsoletos la 001 y el ADR 0004)
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
  - Pedir en el mismo consentimiento de login los permisos de hoy: `openid`, `email`, `calendar.readonly` y `calendar.events`. **Calendar forma parte del login** (decisión del humano): entrar con Google implica conceder Calendar, no es un permiso aparte ni opcional.
  - Descartar, sin subirlos, los datos locales que el prototipo haya guardado en el navegador (decisión del humano), y retirar el importador del primer inicio, que deja de tener sentido.
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
- **C9:** Dado un usuario que, en la pantalla de Google, desmarca el permiso de Calendar, cuando vuelve a la app, entonces **no entra**: ve un mensaje claro («StudentOS necesita acceso a tu Google Calendar para funcionar») y un botón para volver a intentarlo, y no se guarda ninguna sesión ni dato suyo.
- **C10:** Dado cualquier momento de la sesión, cuando se inspecciona el almacenamiento y el tráfico del navegador, entonces no hay ningún access token ni refresh token de Google.
- **C11:** Dado un usuario que cierra sesión, cuando la app termina de cerrarla, entonces vuelve a la landing y el siguiente usuario del mismo navegador no ve ni hereda datos del anterior.
- **C12:** Dada una cuenta de Google cualquiera (no incluida en la lista de usuarios de prueba), cuando intenta entrar en producción, entonces entra sin la advertencia de «app no verificada» (requiere 007 y 008).
- **C13:** Dado un usuario que borra su cuenta, cuando termina el borrado, entonces su refresh token se revoca en Google y se elimina del servidor (se mantiene lo que ya existe).
- **C14:** Dado un navegador que tenía datos locales del prototipo, cuando alguien inicia sesión con Google, entonces esos datos locales no se suben a ninguna cuenta y se eliminan del navegador.

## Casos límite y errores
- **El usuario desmarca Calendar en la pantalla de Google:** Google permite permisos granulares y la app **no puede forzarlos**; lo que sí hace es detectar que falta el permiso y no dejar entrar (C9).
- **El usuario revoca el acceso desde su cuenta de Google:** el servidor detecta el refresh inválido (`needsReauth`, hoy respuesta 409) y la app debe pedir un nuevo consentimiento al volver a entrar, sin dejar al usuario en un bucle.
- **Google no entrega refresh token** (por ejemplo, una cuenta que ya había autorizado la app): el flujo debe forzar el consentimiento (`prompt=consent`, `access_type=offline`, como hoy).
- **Cuenta de Google Workspace con Calendar deshabilitado o bloqueado por el administrador:** debe poder entrar o recibir un mensaje claro, sin error técnico.
- **Sin conexión, ventana emergente o redirección bloqueada, o cierre de pestaña a mitad del consentimiento:** mensaje útil y posibilidad de reintentar.
- **Cambio de cuenta en el mismo navegador:** los datos de una persona nunca deben aparecer ni subirse a la cuenta de otra (comparte riesgo con 010).
- **Personas que ya usan el prototipo en local:** sus datos locales se descartan sin subirse (C14). **Se pierden**; el único respaldo que queda es el que haga la propia persona antes de entrar (hoy, «Exportar» a `.json`), así que conviene avisarlo antes del primer login.
- **BUG-01 (cerrar sesión no vuelve a la landing)** afecta directamente a C11 y debe corregirse dentro o antes de esta funcionalidad.

## Zonas protegidas que toca
Esta funcionalidad toca el **importador del primer inicio** (se retira por completo, porque los datos locales se descartan), el **cifrado del token de Google** (solo se reutiliza, sin cambiarlo) y el **borrado de cuenta** (se mantiene tal cual). Según `AGENTS.md`, hay que preguntar antes de modificar cualquiera de ellos: **al aprobar esta spec apruebas retirar el importador**. Rotar `GOOGLE_TOKEN_ENC_KEY` no forma parte del alcance.

## Cosas que esta spec deja obsoletas (requieren tu aprobación)
- **Funcionalidad 001 (modo local sin cuenta, `hecho`):** deja de ser un objetivo del producto.
- **ADR 0004 (modo local y modo nube):** se reemplazaría por un ADR nuevo.
- **`docs/project/PROJECT.md` y `AGENTS.md`:** dicen «funciona sin cuenta, en local».
- **Pruebas E2E:** `01-nocloud.spec.ts`, `03-importer.spec.ts` y el flujo de registro local se reescriben o se eliminan.
- **Funcionalidad 003 (importador del primer inicio, `hecho`):** se retira.
- **Componentes que usan `localStorage` directo** (`AuthModal`, `BackupModal`, `DailyHabitsCard`, `GymTracker`, ver TASKS M2): sin modo local, hay que decidir su destino en el plan.

## Decisiones ya tomadas (sin pregunta pendiente)
- Login estrictamente con Google; sin registro, sin modo local, sin demo.
- Permisos de Calendar: los de hoy. Calendar forma parte del login y es **obligatorio** (C9).
- Sin botón de desvincular.
- Datos locales del prototipo: se descartan (C14).
- El calendario se comporta como hoy.

## Preguntas resueltas (2026-11-24)
1. **La landing pública se mantiene** como única pantalla sin sesión. ✔
2. **Sin botón de desvincular:** el usuario puede revocar desde su cuenta de Google o borrando la cuenta. Queda como **punto a comprobar con `docs/google-verification-checklist.md`** dentro de la 008, por si Google lo exigiera. ✔
3. **Se aprueba** dejar obsoletos la funcionalidad 001 y el ADR 0004, y retirar la 003 (importador). ✔

## Preguntas abiertas
Ninguna de producto. La única decisión pendiente es técnica y está en `plan.md` (D1).
