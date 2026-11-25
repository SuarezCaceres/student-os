# Spec · 008 · Verificación de la app StudentOS en Google

> Estado: **aprobada** por el humano el 2026-11-24 (las preguntas abiertas Q1–Q10 siguen pendientes de respuesta)
> Dice **qué** y **por qué**, no **cómo**. El cómo va en `plan.md`, después de aprobar esta spec.
> Prioridad: Alto (`docs/TASKS.md` → 2). **Bloquea** que el login sea «para todos» (spec 009, C12) y tarda **semanas**, así que conviene empezar cuanto antes lo que no depende de nada.
> Depende de: 007 (dominio y producción desplegada). Se coordina con: 009 (el flujo que Google verá).

## Problema
La app pide a Google permisos de Calendar, que Google clasifica como **sensibles**. Mientras la app no esté verificada:
- Con la pantalla de consentimiento en **Testing**, solo entran usuarios de prueba (máx. 100) y el **refresh token caduca a los 7 días**: la conexión con Calendar se rompe cada semana (ver criterio 005-C3).
- En **producción sin verificar**, cada persona ve «Google no ha verificado esta app» y hay un **tope de 100 usuarios de por vida**.

Hoy la verificación solo existe como una lista de tareas (`docs/google-verification-checklist.md`) y no hay nada acordado sobre qué es «estar listo para enviar», quién hace cada cosa, qué se enseña a Google ni qué hacer si Google pide cambios. Además, hay **incoherencias en el repo** que Google detectaría y rechazaría (ver «Incoherencias detectadas»).

## Objetivo
Que Google **apruebe** la app StudentOS para los permisos `openid`, `email`, `calendar.readonly` y `calendar.events`, de modo que cualquier cuenta de Google pueda entrar sin el aviso de «app no verificada» y sin el tope de 100 usuarios (habilita 009-C12). Y que, hasta entonces, la app esté en **producción sin verificar** (no en Testing) para que los tokens no caduquen.

## Alcance
- **Incluye:**
  - Pantalla de consentimiento: nombre, logotipo, correos, dominios autorizados, enlaces a privacidad y términos, tipo de usuario y estado de publicación.
  - Dominio propio verificado en Google Search Console y asignado a la web.
  - Páginas legales sin marcadores y coherentes con lo que hace la app; enlaces visibles sin iniciar sesión.
  - Justificación escrita (en inglés) de cada permiso, con el endpoint que lo necesita.
  - Revisión de **scopes mínimos**: demostrar qué endpoint exige cada uno y retirar el que sobre.
  - Guion y grabación del vídeo de demostración que Google exige.
  - Envío del formulario, seguimiento de las rondas con Google y qué hacer si piden cambios.
  - Actualizar `docs/google-verification-checklist.md` para que refleje esta spec y la 009.
  - Una protección en pruebas para que nadie cambie los scopes sin saber que obliga a reverificar.
- **No incluye:**
  - Desplegar la web, la API o Supabase de producción (es la 007).
  - Cambiar el flujo de login o de Calendar (es la 009); aquí solo se **verifica que coincide** con lo que se enseña a Google.
  - La evaluación de seguridad anual CASA: no aplica a scopes **sensibles** (sí a los «restringidos», que la app no pide). Se confirma en la consola antes de enviar (criterio C9).
  - Publicar la app en Google Workspace Marketplace ni otros scopes (Drive, Gmail, `calendar` completo).

## Reparto: quién hace qué
| Quién | Qué |
|---|---|
| **Humano** (única compuerta; necesita credenciales y cuentas) | Comprar el dominio y apuntarlo a Vercel; verificarlo en Search Console; rellenar Branding / Audience / Data access en Google Cloud Console; subir el logotipo; publicar a *In production*; **grabar y subir el vídeo** a YouTube («No listado»); rellenar y enviar el formulario; leer y contestar el correo de Google; facilitar nombre del responsable, país y correos de contacto. |
| **Repositorio / agente** (sin credenciales) | Quitar los marcadores de las páginas legales cuando el humano dé los datos; alinear los textos legales con la 009; garantizar los enlaces visibles; fijar los scopes con una prueba; documentar la tabla endpoint→scope; redactar los textos de justificación y el guion del vídeo; mantener el checklist y el registro de rondas con Google; revisar que la app desplegada coincide con lo enseñado. |
| **Ninguno puede automatizar** | Aprobar la verificación: la decide Google (y puede tardar semanas, con varias rondas). |

## Incoherencias detectadas (hay que resolverlas antes de enviar)
Comprobadas en el repo a fecha 2026-11-24:
1. **Marcadores sin rellenar** en `apps/web/public/legal/`: `[NOMBRE DEL RESPONSABLE]`, `[CORREO DE CONTACTO]` (privacidad y términos) y `[PAÍS O JURISDICCIÓN]` (términos). Google rechaza políticas con datos de relleno.
2. **La política de privacidad habla de `profile`**, pero el servidor ya no lo pide (`apps/api/src/google/google.constants.ts`: `openid`, `email`, `calendar.readonly`, `calendar.events`). El checklist actual también lo lista. El transporte GIS del web sigue pidiendo `openid profile email` hasta que la 009 lo retire.
3. **La política dice que Calendar es «opcional» y que se puede «desconectar desde la app»**, y el checklist (paso 6 del vídeo) enseña ese botón. La 009 decide lo contrario: Calendar es **obligatorio** al entrar y **no hay botón de desvincular** (la persona revoca desde su cuenta de Google o borrando la cuenta). Lo que Google lea, vea en el vídeo y el comportamiento real deben ser **lo mismo**.
4. **La política dice «guardamos tu sesión en el almacenamiento del navegador» y otros apartados del modo local**, que la 009 elimina; hay que revisarlos tras la 009.
5. **El logotipo** `apps/web/public/logo.png` es en realidad un **JPEG de 1024×1024** con extensión `.png`. Google pide un logotipo cuadrado (el checklist dice 120×120 px, PNG/JPG, < 1 MB, sin marcas de Google); hay que comprobar el peso y preparar la versión correcta.
6. `POST /google/disconnect` sigue existiendo en la API aunque la 009 quita el botón: la respuesta a «¿cómo revoca el usuario el acceso?» debe ser exacta (ver pregunta Q8).

## Historias de usuario
- Como persona que usa StudentOS, quiero entrar con Google sin ver un aviso de «app no verificada», para fiarme de la app.
- Como responsable del producto, quiero que Google apruebe solo los permisos que la app necesita, para no tener que reverificar ni perder la aprobación por pedir de más.
- Como responsable del producto, quiero una receta clara de qué hacer yo y qué prepara el repositorio, para no bloquear la verificación por olvidar un paso.
- Como revisor de Google, quiero ver en la web pública, en las políticas y en el vídeo exactamente lo mismo que hace la app, para aprobarla.

## Criterios de aceptación
Cada criterio debe poder comprobarse. Entre paréntesis, **cómo**: *prueba* (automática, la ejecuta el agente), *evidencia* (captura o enlace guardado en `docs/qa/evidence/` o anotado en `docs/PROGRESS.md`, la aporta el humano) o *revisión* (lectura contrastada con el código). C1 y C2 **ya existían** en `docs/features.json` y se conservan tal cual; C3 en adelante los desglosan.

- **C1:** Todos los puntos de `docs/google-verification-checklist.md` están completados. *(revisión: el checklist, actualizado según esta spec, no tiene casillas sin marcar)*
- **C2:** Google aprueba la verificación y el login deja de estar limitado a 100 usuarios de prueba. *(evidencia: correo/estado «Verified» en el centro de verificación y entrada con una cuenta ajena sin aviso, que es también 009-C12)*

**Dominio y legal**
- **C3:** Dado el dominio de producción, cuando se abre `https://<dominio>/`, `/legal/privacidad.html` y `/legal/terminos.html` **sin sesión**, entonces las tres responden 200, y el dominio figura como verificado en Search Console con la cuenta propietaria del proyecto de Google Cloud. *(evidencia + comprobación HTTP)*
- **C4:** Dadas las páginas de `apps/web/public/legal/`, cuando se buscan marcadores `[NOMBRE DEL RESPONSABLE]`, `[CORREO DE CONTACTO]` y `[PAÍS O JURISDICCIÓN]`, entonces no queda ninguno. *(prueba: test que lee los HTML y falla si encuentra un marcador; se activa cuando el humano da los datos, Q2)*
- **C5:** Dada la política de privacidad, cuando se contrasta con el código y la 009, entonces (a) lista exactamente los permisos que pide la app, (b) no menciona `profile` si no se pide, (c) no dice que Calendar sea opcional ni que se desconecte desde la app, y explica cómo retirar el acceso (cuenta de Google y borrado de cuenta), (d) conserva literal la declaración de **uso limitado** de la Política de datos de usuario de las API de Google y (e) enlaza a esa política. *(revisión + prueba que comprueba (b) y (d))*
- **C6:** Dado un visitante sin sesión, cuando abre la home pública, entonces ve un enlace a la política de privacidad y otro a los términos (`LegalLinks` montado en el pie de la landing) y la home explica qué es StudentOS y para qué usa los datos de Google, con el mismo nombre que la pantalla de consentimiento. *(prueba: unitaria de `LegalLinks` + E2E de landing; revisión del texto)*

**Pantalla de consentimiento**
- **C7:** Dada la consola de Google (Branding / Audience / Data access), cuando se revisa, entonces: nombre «StudentOS»; logotipo válido; correo de asistencia y de contacto del desarrollador que el humano lee; dominio autorizado = el verificado; URLs de inicio, privacidad y términos = las de C3; tipo de usuario *External*; **estado *In production***; y los scopes declarados son exactamente los de C8. *(evidencia: capturas de cada pantalla)*
- **C8:** Dada la configuración de OAuth del servidor, cuando se compara con los scopes declarados en la consola, entonces **coinciden exactamente** (hoy: `openid`, `email`, `calendar.readonly`, `calendar.events`, o el subconjunto que acuerde C9), y una prueba falla si alguien cambia `GOOGLE_SCOPES` sin actualizar la lista «scopes verificados». El fallo debe avisar de que cambiar scopes obliga a reverificar. *(prueba unitaria en `apps/api/src/google/`)*
- **C9:** Dada la tabla «endpoint → scope mínimo aceptado», cuando se revisa, entonces cada endpoint que usa el proxy (`calendars.get`, `events.list/get/instances/insert/patch/delete`, `freebusy.query`) cita el scope que lo autoriza según la **referencia oficial** (con enlace), cada scope declarado tiene al menos un endpoint que lo necesita, y se confirma en la consola que los scopes de Calendar son **sensibles y no restringidos** (sin CASA). *(revisión + captura de la consola)*
- **C10:** Dado un cliente OAuth de producción, cuando se revisan sus URIs de redirección, entonces son solo HTTPS y exactas (sin comodines), e incluyen el callback de la API (`GOOGLE_REDIRECT_URI`) y el de Supabase Auth. *(evidencia)*

**Justificación y vídeo**
- **C11:** Dado el formulario de verificación, cuando se revisan los textos de justificación, entonces hay **uno por permiso**, en inglés, que dice qué dato se usa, para qué función concreta, que solo se escribe cuando el usuario lo ordena, qué se guarda (solo el refresh token cifrado) y cómo se revoca; y **cada afirmación tiene respaldo** (por ejemplo «no guardamos eventos de Calendar en nuestra base de datos» se contrasta con el código del proxy y la sincronización, y «token cifrado» con el ADR 0005 y las pruebas de 005-C1). *(revisión contrastada con el código)*
- **C12:** Dado el guion del vídeo (Anexo A), cuando se compara con el flujo real tras la 009, entonces cada paso corresponde a algo que existe en la app (ningún paso muestra un botón que ya no está) y cada permiso se ve usado al menos una vez. *(revisión)*
- **C13:** Dado el vídeo grabado, cuando se reproduce, entonces está en YouTube como «No listado», se graba en el **dominio de producción** (no `localhost`) con una cuenta de Google que no es la del desarrollador, muestra la barra de direcciones con el `client_id` en la pantalla de consentimiento, y dice (voz o subtítulos en inglés) qué dato se usa y para qué en cada paso. La URL queda anotada en `docs/PROGRESS.md`. *(evidencia)*

**Producción, envío y seguimiento**
- **C14:** Dada la app en *In production* y **aún sin verificar**, cuando una cuenta de Google que no es del desarrollador ni de prueba entra, entonces completa el login, ve el aviso esperable de «no verificada» y la conexión de Calendar **sigue viva pasados más de 7 días** (el refresh token ya no caduca). *(evidencia; cubre 005-C3 y 009-C5)*
- **C15:** Dado el borrado y la exportación de cuenta en producción, cuando se ejecutan con una cuenta real, entonces `GET /account/export` devuelve los datos y `DELETE /account` borra todo y **revoca el token en Google** (visible al desaparecer StudentOS de `myaccount.google.com/permissions`). *(evidencia; las pruebas automáticas ya existen en 006 y 009-C13)*
- **C16:** Dado el envío, cuando se registra, entonces `docs/PROGRESS.md` anota la fecha de envío, el dominio, las URLs y la URL del vídeo; y existe un **registro de rondas con Google** (fecha, qué pidieron, qué se respondió, quién) que se actualiza con cada correo. *(revisión del registro)*
- **C17:** Dado que Google pide cambios, cuando llega su correo, entonces se responde **en el mismo hilo** en pocos días (el humano; ver «Si Google pide cambios») y cada cambio que toque el repo pasa por un PR enlazado a esta spec. *(revisión del registro de C16)*

## Si Google pide cambios
Regla general: responder **en el mismo hilo**, rápido (si no contestan en pocos días, la solicitud puede cerrarse) y sin cambiar nada sin que el humano lo apruebe. Qué hace cada parte según el motivo:

| Qué pide Google | Qué se hace | Consecuencia |
|---|---|---|
| Datos de política o contacto incompletos, o la política no coincide con la app | Corregir los HTML de `public/legal/`, publicar y contestar con el enlace | Solo repo + despliegue |
| La home no explica la app o no enlaza la política | Ajustar la landing/pie | Repo |
| El vídeo no muestra algo (consentimiento, `client_id`, uso de un permiso) | Regrabar solo lo que falte, o entero; actualizar la URL | Humano |
| Un permiso les parece excesivo (p. ej. `calendar.readonly`) | Mostrar el endpoint que lo exige (C9); si no se puede justificar, **retirar el scope**: cambia `GOOGLE_SCOPES`, los textos y el vídeo (los tokens ya guardados siguen valiendo; no se rota la clave de cifrado) | Toca 009-C4 y la prueba de C8; **decisión del humano** |
| Cuestionan que Calendar sea **obligatorio** para entrar (decisión de 009) | Argumentar que Calendar es el núcleo del producto; si insisten, **plan B: hacerlo opcional** (reabre 009-C9) | **Decisión del humano**, riesgo registrado en Q6 |
| Piden dominio, marca o logotipo distintos | Repetir verificación de marca/dominio | Humano |
| Rechazo definitivo | Mantener *In production* sin verificar (≤ 100 usuarios con aviso) y decidir si se reenvía o se rediseña | Decisión del humano |

Cambiar scopes **después** de ser aprobada obliga a **volver a verificar**; por eso existe C8.

## Casos límite y errores
- **El dominio no está listo** (007 sin desplegar): no se puede enviar. Lo que sí se puede avanzar sin dominio: C4 y C5 (texto legal), C8, C9 y C11 (documentos y tabla de scopes) y el guion (C12).
- **Cuenta propietaria distinta**: el dominio debe verificarse en Search Console con la **misma cuenta** que es propietaria o editora del proyecto de Cloud; si no, Google no lo acepta.
- **El flujo de la 009 cambia después de grabar el vídeo**: el vídeo queda obsoleto y Google puede detectar la diferencia. Hay que regrabarlo.
- **`*.vercel.app` o `*.onrender.com`** no sirven como dominio autorizado (son sufijos públicos).
- **Tope de 100 usuarios en producción sin verificar**: se cuenta de por vida y no se libera al desconectarse; hay que vigilar el contador en *Audience* y no hacer campañas masivas hasta que se apruebe.
- **Refresh token sin uso 6 meses o contraseña cambiada**: se ve como `invalid_grant` y la app pide reconectar (comportamiento ya existente, 009 «casos límite»); no es un fallo de verificación.
- **Cuenta con Calendar bloqueado por su administrador (Workspace)**: no afecta a la verificación, pero el vídeo no debe grabarse con una cuenta así.
- **Sin respuesta de Google durante semanas**: no se bloquea el producto; sigue en producción sin verificar con el aviso. Se anota en el registro (C16).

## Orden recomendado (sin plazos inventados: los de Google no los controlamos)
1. **Ahora, sin depender de nadie:** C4/C5 (texto legal, cuando haya datos), C8, C9 y C11 (tabla de scopes, prueba y textos), guion del vídeo (C12), logotipo, y que el humano elija y compre el dominio.
2. **Con 007 desplegada:** dominio verificado (C3), consola configurada (C7, C10), pasar a *In production* (C14).
3. **Con 009 en producción:** grabar el vídeo con el flujo definitivo (C13) y enviar (C16). Enviar antes obligaría a regrabar y a explicar a Google un flujo que va a cambiar.
4. **Después:** seguimiento (C17) hasta la aprobación (C2).

## Anexo A · Guion del vídeo (lo que debe enseñar; en inglés, 3–5 min)
Grabado en el dominio de producción con una cuenta de Google ajena al desarrollador. Cada paso indica qué permiso demuestra. Este guion sustituye al del checklist, que enseñaba un botón de desconectar que la 009 elimina.

| # | Qué se ve | Permiso / requisito |
|---|---|---|
| 1 | Home pública con el nombre StudentOS, qué hace y el enlace visible a la política de privacidad | Marca, C6 |
| 2 | Pulsar «Continuar con Google»; pantalla de consentimiento **con la barra de direcciones y el `client_id` legibles**, nombre de la app y los permisos pedidos; aceptar | `openid`, `email`, `calendar.*` |
| 3 | Se entra a la app sin pulsar nada más; el calendario ya aparece conectado | Calendar integrado en el login (009) |
| 4 | Abrir el calendario: se ven los eventos reales de Google; dos eventos conflictivos y huecos libres detectados | `calendar.events` (lectura), `calendar.readonly` (disponibilidad / calendario principal) |
| 5 | Programar una sesión de gym y ver el evento en calendar.google.com; editarla y borrarla desde la app y comprobar el cambio en Google | `calendar.events` (escritura) |
| 6 | Mostrar que **solo** se escribe al ordenarlo el usuario (no hay eventos creados solos) | Uso limitado |
| 7 | Revocar el acceso en `myaccount.google.com/permissions` y volver a la app: pide reconectar | Revocación |
| 8 | «Descargar mis datos» y «Borrar mi cuenta» (confirmación escrita) y comprobar que el permiso desaparece | Control del usuario |

## Anexo B · Permisos y qué hay que justificar
| Permiso | Clasificación | Función de la app | Endpoints que lo usan (`apps/api/src/google/google.controller.ts`) |
|---|---|---|---|
| `openid`, `email` | No sensible | Identificar la cuenta de Google que entra | Inicio de sesión |
| `calendar.events` | Sensible | Leer, crear, modificar y borrar eventos del calendario **principal** (gym, turno de trabajo y bloques que el usuario marca; series con `RRULE`/`UNTIL`) | `events.list`, `events.get`, `events.instances`, `events.insert`, `events.patch`, `events.delete` |
| `calendar.readonly` | Sensible | Disponibilidad para sugerir huecos y datos del calendario principal | `freebusy.query` (la referencia oficial lo acepta; **`calendar.events` no figura** entre sus scopes) y `calendars.get` (**por confirmar** en C9) |

Hallazgo para C9: el checklist daba por posible retirar `calendar.readonly` si `calendar.events` bastaba. Según la referencia oficial de `freebusy.query` **no basta**, así que probablemente `calendar.readonly` se queda; falta confirmar `calendars.get` y valorar si existe un scope más estrecho (por ejemplo `calendar.freebusy`) que obligue a decidir con el humano, porque cambiaría 009-C4.

## Preguntas abiertas
El humano debe contestarlas; no se han rellenado con datos inventados.
- **Q1 · Dominio:** ¿cuál es el dominio propio y está ya comprado? (el checklist solo da `studentos.app` como ejemplo). ¿Quién es el propietario de la cuenta de Search Console y de Google Cloud?
- **Q2 · Datos legales:** nombre del responsable, país o jurisdicción y correo de contacto que irán publicados en las páginas legales (C4). No se prefija ninguno del repo ni de la cuenta personal.
- **Q3 · Correos de la consola:** ¿correo de asistencia y correo de contacto del desarrollador? ¿Son el mismo que el de Q2 y se leen a diario?
- **Q4 · Proyecto de Google Cloud:** ¿se usa el mismo proyecto y cliente OAuth de desarrollo para producción, o se crea uno separado con sus URIs? (recomendable separar; no es una decisión que esta spec pueda inventar).
- **Q5 · Logotipo:** ¿`apps/web/public/logo.png` (JPEG 1024×1024) es el logotipo definitivo? Hay que preparar la versión de 120×120 px sin marcas de Google y comprobar el peso.
- **Q6 · Calendar obligatorio:** ¿se acepta el plan B (hacerlo opcional, reabriendo 009-C9) si Google cuestiona que el login lo exija? Es un riesgo conocido, no una certeza.
- **Q7 · Cuándo enviar:** ¿se espera a que 009 esté en producción para grabar el vídeo y enviar (recomendado) o se envía antes con el flujo actual y se regraba después?
- **Q8 · Revocación y `POST /google/disconnect`:** como la 009 elimina el botón, ¿se deja el endpoint sin uso en la API, se retira o se mantiene para el borrado de cuenta? Hay que responder a Google con exactitud cómo revoca el usuario.
- **Q9 · Retirada de scopes:** si C9 demuestra que algún scope sobra o hay uno más estrecho, ¿se autoriza modificar 009-C4 y el ADR 0005 («Scopes mínimos»)?
- **Q10 · Texto legal:** reescribir la política y los términos es una decisión con efecto jurídico; ¿quién los revisa antes de publicarse (el humano, un tercero)?
