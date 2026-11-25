# 008 · Guion del vídeo de demostración (C12)

> Paso A4 del plan. Parte del Anexo A de la spec, con los scopes del ADR 0008.
> Se graba **solo con la 009 en producción** (Q7), en el dominio propio, con una cuenta de Google ajena al desarrollador que no sea de Workspace con Calendar bloqueado. En inglés (voz o subtítulos), 3–5 min. Se sube a YouTube como **No listado** y la URL se anota en `docs/PROGRESS.md` (C13).
> La columna «¿Existe tras la 009?» se revisa contra la app desplegada antes de grabar; ningún paso puede enseñar un botón que ya no está.

| # | Qué se ve | Qué se dice (inglés) | Permiso que demuestra | ¿Existe tras la 009? |
|---|---|---|---|---|
| 1 | Home pública en `https://<dominio>/`: nombre StudentOS, qué hace y enlaces a *Privacy* y *Terms* en el pie | "This is StudentOS, a weekly planner for university students. The privacy policy is linked from the home page." | Marca, C6 | Pie con `LegalLinks`: sí. Texto explicativo de la landing: **pendiente (B2)** |
| 2 | Pulsar «Continuar con Google». Pantalla de consentimiento con la **barra de direcciones legible** (`client_id=…`), el nombre de la app y los permisos; aceptar | "Signing in with Google. You can see the client ID in the address bar and the permissions requested: Calendar events in calendars I own, free/busy, and calendar properties." | `openid`, `email`, `calendar.events.owned`, `calendar.freebusy`, `calendar.calendars.readonly` | Sí (login de la 009, `supabase.ts`). Comprobar qué scopes de identidad añade Supabase (`scopes.md`) |
| 3 | Se entra en la app sin pulsar nada más; Calendar ya está conectado y se ve el nombre del calendario | "After consenting, Calendar is connected automatically. StudentOS shows the name of my primary calendar." | `calendar.calendars.readonly` | Sí (009-C5). **Comprobar dónde se ve el nombre** |
| 4 | Abrir la vista semanal: aparecen los eventos reales de Google, un choque entre dos eventos y huecos libres | "StudentOS reads the events of my primary calendar to show my real week and detect conflicts, and it uses free/busy to suggest free slots." | `calendar.events.owned` (lectura), `calendar.freebusy` | Vista semanal: sí. **Comprobar** que el choque y los huecos se ven claros en pantalla |
| 5 | Programar una sesión de gym; abrir `calendar.google.com` y ver el evento; editarla y borrarla desde StudentOS y ver el cambio en Google | "When I schedule a gym session, StudentOS creates the event. Editing or deleting it in StudentOS updates Google Calendar." | `calendar.events.owned` (escritura) | Sí (gym y proxy) |
| 6 | Volver a Google Calendar y mostrar que no hay eventos creados sin una acción del usuario | "StudentOS only writes to Calendar when I ask it to." | Uso limitado | **Comprobar** en la app desplegada (justificaciones, `calendar.events.owned`) |
| 7 | Retirar el acceso en `myaccount.google.com/permissions` y volver a la app: la app avisa de que hay que volver a dar permiso | "If I revoke access from my Google Account, StudentOS stops reading my calendar and asks me to sign in again." | Revocación | **Por comprobar.** Los avisos de `App.tsx` aún dicen «reconecta en Google Sync», y la 009 quitó el botón «Conectar». Hay que ver qué muestra la app de verdad y ajustar el texto o el guion |
| 8 | Abrir la cuenta: «Descargar mis datos» y «Borrar mi cuenta» con la confirmación escrita; comprobar que StudentOS desaparece de `myaccount.google.com/permissions` | "I can download my data and delete my account. Deleting it revokes the Google access and removes all my data." | Control del usuario | Sí (`AccountPanel.tsx`; pruebas de 006 y 009-C13). Se prueba en producción (C15) |

## Antes de grabar
- [ ] La 009 está en producción y la columna «¿Existe tras la 009?» no tiene nada pendiente.
- [ ] Las páginas legales ya describen estos scopes (B1) y la landing explica la app (B2).
- [ ] La cuenta de prueba tiene eventos propios, una invitación de otra persona y dos eventos que chocan.
- [ ] El navegador muestra la barra de direcciones completa (sin modo kiosco ni zoom que la corte).
