/**
 * Avisos que se muestran cuando el acceso a Google Calendar caducó o no está activo.
 *
 * Spec 009: Calendar se vincula solo al iniciar sesión con Google y ya no existe un botón «Conectar» ni «Reconectar» en
 * Google Sync. La única forma de renovar el acceso es cerrar sesión y volver a entrar con Google, así que todos los
 * avisos remiten a esa acción (la misma que indica el modal de Google Sync).
 */
export const GOOGLE_REAUTH_MESSAGES = {
  /** Reprogramar un entreno del gym sin acceso: queda solo en local. */
  gymRescheduleSavedLocally:
    'Tu sesión de Google Calendar expiró. El entrenamiento reprogramado se guardó solo localmente hasta que cierres sesión y vuelvas a entrar con Google.',
  /** Regenerar el horario del gym sin acceso: no se pueden borrar las sesiones anteriores en Google. */
  gymPreviousSessionsNotDeleted:
    'Tu sesión de Google Calendar expiró o no está activa. Cierra sesión y vuelve a entrar con Google para borrar también las sesiones anteriores en Google Calendar.',
  /** Guardar el horario del gym y perder el acceso a mitad del proceso. */
  gymScheduleNotSaved:
    'Tu sesión de Google Calendar expiró al guardar el horario. Cierra sesión y vuelve a entrar con Google para guardar y limpiar tus sesiones en Google Calendar.',
  /** Crear un bloque de calendario marcado para Google sin acceso. */
  blockSavedLocally:
    'Tu sesión de Google Calendar expiró; este bloque se guardó solo localmente hasta que cierres sesión y vuelvas a entrar con Google.',
  /** Borrar un bloque local cuyo evento sigue en Google. */
  blockDeletedLocallyOnly:
    'Se eliminó el bloque local, pero tu sesión de Google expiró y el evento sigue en Google Calendar hasta que cierres sesión y vuelvas a entrar con Google.',
  /** Borrar un evento de Google sin acceso. */
  googleEventNotDeleted:
    'Tu sesión de Google Calendar expiró. Cierra sesión y vuelve a entrar con Google para eliminar este evento de Google Calendar.',
  /** Guardar el turno laboral sin acceso: la serie recurrente no se publica. */
  workShiftSavedLocally:
    'Tu sesión de Google Calendar expiró. El turno laboral quedó guardado localmente; cierra sesión y vuelve a entrar con Google para publicar su serie recurrente.',
  /** Reubicar un entreno que vive en Google sin acceso. */
  gymSolutionNotMoved:
    'Tu sesión de Google Calendar expiró. Cierra sesión y vuelve a entrar con Google para reubicar este entrenamiento en Google Calendar.',
  /** Fachada: borrar eventos de StudentOS en Google sin token. */
  deleteEventsMissingAccess:
    'Tu sesión de Google Calendar expiró o no está activa. Cierra sesión y vuelve a entrar con Google para borrar eventos en Google.',
  /** Fachada: Google rechazó el acceso a mitad de un borrado. */
  sessionExpired: 'Tu sesión de Google Calendar expiró. Cierra sesión y vuelve a entrar con Google.',
  /** Fachada: se pidió leer o escribir en Calendar sin acceso activo. */
  calendarNotConnected:
    'Google Calendar no está conectado. Cierra sesión y vuelve a entrar con Google aceptando el permiso de Calendar.',
} as const;

export type GoogleReauthMessageKey = keyof typeof GOOGLE_REAUTH_MESSAGES;
