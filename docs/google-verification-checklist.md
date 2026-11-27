# Checklist de verificación de Google (StudentOS)

> Lista de tareas de la **spec 008** (`docs/specs/008-verificacion-app-google/`). El *qué* y el *por qué* están en `spec.md`, y el orden en `plan.md`. Esta lista solo marca el avance; el detalle vive en los documentos enlazados, así que hay una sola fuente de verdad.
> Criterio C1: al terminar no queda ninguna casilla sin marcar. Cada paso indica quién lo hace (**humano** o **repo**) y el criterio que cubre.

## Por qué importa
| Situación | Consecuencia |
|---|---|
| Consentimiento en **Testing** | Solo usuarios de prueba (máx. 100) y el **refresh token caduca a los 7 días**: Calendar se desconecta cada semana. |
| **In production sin verificar** | Aviso «Google no ha verificado esta app» y **tope de 100 usuarios de por vida**. El refresh token ya no caduca a los 7 días. |
| **In production y verificada** | Sin aviso y sin tope. |

La verificación tarda **semanas** y suele tener varias rondas. Hay que pasar a *In production* cuanto antes (H3) y enviar en paralelo.

## Documentos de la 008
| Documento | Para qué |
|---|---|
| [`scopes.md`](specs/008-verificacion-app-google/scopes.md) | Tabla endpoint → scope, por qué cada scope es el mínimo, pendientes y clasificación en la consola (C9) |
| [`justificaciones.md`](specs/008-verificacion-app-google/justificaciones.md) | Textos en inglés para el formulario, con su respaldo en el código (C11) |
| [`video-guion.md`](specs/008-verificacion-app-google/video-guion.md) | Guion del vídeo y qué hay que comprobar antes de grabar (C12, C13) |
| [`rondas-google.md`](specs/008-verificacion-app-google/rondas-google.md) | Datos del envío y registro de cada correo con Google (C16, C17) |
| ADR 0008 | Por qué se piden estos scopes y no otros |

Scopes que se declaran: `openid`, `email` y `calendar.events.owned` (ADR 0008, revisado el 2026-11-26), más los de identidad que añada Supabase si se confirma alguno más (H2). Los de Calendar tienen una fuente única, `VERIFIED_GOOGLE_CALENDAR_SCOPES` en `packages/shared/src/googleScopes.ts`, de la que derivan `GOOGLE_LOGIN_CALENDAR_SCOPES` (lo que pide el login, web) y `GOOGLE_SCOPES` (API, añade `openid email`). Los fijan dos pruebas: `apps/web/src/services/googleLogin.test.ts` y `apps/api/src/google/scopes-verificados.spec.ts`. **Cambiarlos después de aprobar obliga a reverificar.**

## Bloque A · repo, sin esperar a nadie
- [x] **A1** · Tabla endpoint → scope con la referencia oficial (C9) → `scopes.md`
- [x] **A1** · Decisión sobre los scopes (Q9): estrechar todo → ADR 0008
- [x] **A1** · Revisión del PR #19 (2026-11-26): la app no usaba `freebusy.query` ni `calendars.get` → solo `calendar.events.owned` (ADR 0008, «Revisión 2026-11-26»)
- [x] **A2** · Prueba que fija los scopes y avisa de reverificar (C8) → `scopes-verificados.spec.ts` (API) y `googleLogin.test.ts` (web), sobre la fuente única de `@student-os/shared`
- [x] **A3** · Justificación en inglés de cada permiso, con respaldo (C11) → `justificaciones.md`
- [x] **A4** · Guion del vídeo (C12) y registro de rondas (C16) → `video-guion.md`, `rondas-google.md`
- [x] **A5** · Este checklist como única lista de tareas (C1)

## Bloque H1 · humano, con la 007 desplegada
- [ ] **H1** · Comprar el dominio propio (Q1) y asignarlo en Vercel. `*.vercel.app` y `*.onrender.com` no sirven como dominio autorizado.
- [ ] **H1** · Verificar el dominio en [Search Console](https://search.google.com/search-console) con la **misma cuenta** que es propietaria o editora del proyecto de Google Cloud (C3).
- [ ] **H1** · Comprobar sin sesión que la home, `/legal/privacidad.html` y `/legal/terminos.html` responden 200 (C3; el agente lo comprueba con `curl -I`).
- [ ] **H2** · Comprobar con una cuenta real que `calendar.events.owned` devuelve los eventos a los que el usuario está invitado (es el único scope de lectura: si no los devuelve, hay que pasar a uno más amplio), y qué scopes de identidad añade Supabase en la URL de consentimiento (¿`profile`?) (`scopes.md`, «Pendiente»). **Antes** de declarar nada en la consola.
- [ ] **H2** · Branding: nombre «StudentOS», logotipo de 120×120 sin marcas de Google y de menos de 1 MB (Q5), correo de asistencia y de contacto del desarrollador que se lean a diario (Q3), URLs de inicio, privacidad y términos, y dominio autorizado = el verificado (C7). Capturas en `docs/qa/evidence/`.
- [ ] **H2** · Audience: tipo *External* (C7).
- [ ] **H2** · Data access: declarar **exactamente** los scopes de arriba y anotar su clasificación en `scopes.md` (C7, C9). Confirmar que ninguno es «restringido» (sin evaluación CASA).
- [ ] **H2** · Cliente OAuth de producción (Q4): URIs de redirección solo HTTPS y exactas, con el callback de Supabase Auth (`https://<ref>.supabase.co/auth/v1/callback`) y el del API (`GOOGLE_REDIRECT_URI`) (C10). Captura.
- [ ] **H3** · Publicar a **In production** sin verificar y entrar con una cuenta ajena. Comprobar que la conexión sigue viva pasados más de 7 días (C14).

## Bloque B · repo, cuando haya datos y la 009 esté lista
- [ ] **B1** · Páginas legales (Q2, Q10): rellenar `[NOMBRE DEL RESPONSABLE]`, `[CORREO DE CONTACTO]` y `[PAÍS O JURISDICCIÓN]`; listar exactamente los scopes de arriba sin `profile`; Calendar como parte del acceso, sin «desconectar desde la app»; cómo retirar el acceso; conservar la declaración de uso limitado y el enlace a la política de Google. Prueba `legalPages.test.ts` (C4, C5). **Se despliega a la vez que la 009.**
- [ ] **B2** · Landing: texto que explica StudentOS y para qué usa los datos de Google, con el mismo nombre que la consola; E2E de los enlaces legales (C6).

## Bloque H2 · humano, con la 009 en producción
- [ ] **H4** · En producción, con una cuenta real: «Descargar mis datos» y «Borrar mi cuenta», y comprobar que StudentOS desaparece de `myaccount.google.com/permissions` (C15).
- [ ] **H5** · Revisar que la columna «¿Existe tras la 009?» de `video-guion.md` no tiene nada pendiente, grabar el vídeo y subirlo como **No listado**. Anotar la URL en `docs/PROGRESS.md` (C12, C13).
- [ ] **H6** · Rellenar y enviar el formulario con el dominio, las URLs, los textos de `justificaciones.md` y el vídeo. Anotar el envío en `rondas-google.md` y `docs/PROGRESS.md` (C16).

## Seguimiento
- [ ] **S** · Registrar cada correo de Google en `rondas-google.md` y responder en el mismo hilo en pocos días. Los cambios en el repo van en un PR enlazado a la spec 008 (C17).
- [ ] **S** · Cuando Google apruebe: comprobar con una cuenta ajena que el aviso de «app no verificada» desapareció (C2, 009-C12).

## Mientras no esté verificada
- Máximo **100 usuarios** en total, con el aviso (el usuario pulsa «Avanzado → Ir a StudentOS»). Vigila el contador en *Audience* y no hagas campañas hasta que se apruebe.
- Un refresh token sin uso durante 6 meses, o con la contraseña de Google cambiada, se ve como `invalid_grant` y la app pide volver a entrar. No es un fallo de verificación.
