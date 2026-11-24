# Spec · 010 · Entorno de trabajo por usuario

> Estado: **aprobada** por el humano el 2026-11-24
> Depende de la spec 009 (login solo con Google). La parte «dos cuentas reales» (C1) además necesita producción (007).

## Problema
El objetivo del humano es que **cada persona tenga su propio espacio**: que sus tareas, entregas, gym, calendario y hábitos se guarden por usuario y la acompañen a cualquier dispositivo. La base ya existe (cada registro se guarda con `(userId, colección, id)`, el `userId` sale del JWT, hay RLS y el motor de sync descarta datos ajenos al cambiar de cuenta), pero faltan cuatro cosas que un producto público necesita:

1. **Una cuenta nueva no empieza limpia:** recibe los datos de ejemplo de la app (Kanban, entregas, rutinas de gym y reflexiones de «Mateo», el creador). Eso confunde y mezcla datos ficticios con los reales.
2. **Se pierde trabajo al cerrar sesión:** la cola de sync se limpia al cerrar sesión, así que lo que aún no se había subido desaparece.
3. **Los límites por cuenta no se explican:** hoy 5000 registros y 64 KB por registro. Al superarlos, la API responde con un error (422 o 413) y el motor lo cuenta como «rechazado», pero la persona no sabe qué pasó.
4. **Nada está verificado con cuentas reales:** solo hay pruebas con servicios simulados, porque producción no existe aún.

## Objetivo
Cuando esto esté hecho, quien entra por primera vez ve un espacio **vacío y guiado**, no pierde lo que escribió aunque cierre sesión, entiende qué pasa si llega al límite de su cuenta y, en producción, dos personas distintas no ven nunca los datos de la otra.

## Alcance
- **Incluye:**
  - Estado de una cuenta nueva **vacío** en todos los módulos (Kanban, entregas, gym, aprendizaje, hábitos y horario), con una guía en cada módulo que explique qué hacer primero.
  - Subir los cambios pendientes antes de cerrar sesión (con tiempo máximo) y, si no hay red, avisar de lo que se perdería y dejar elegir.
  - Aviso claro en el indicador de sync cuando se llega al límite de registros o al tamaño máximo de un registro, sin perder lo ya guardado.
  - Verificación manual con dos cuentas reales de Google en producción (necesita 007 y 008).
- **No incluye:**
  - Subir los límites por cuenta (se conservan 5000 registros y 64 KB).
  - Botón «cargar datos de ejemplo» ni plantillas.
  - Cambiar el motor de sync, el protocolo ni el cifrado del token (zonas protegidas; la regla de descarte de datos ajenos ya existe y no se modifica).
  - Compartir datos entre usuarios ni equipos.
  - Cuentas existentes: sus datos no se tocan (si alguien ya tiene los datos de ejemplo guardados en su cuenta, los conserva).

## Historias de usuario
- Como estudiante que entra por primera vez, quiero ver un espacio vacío con indicaciones para no confundir datos de ejemplo con los míos.
- Como estudiante que cierra sesión, quiero que lo último que escribí se guarde antes de salir para no perderlo.
- Como estudiante con mucho contenido, quiero que me avisen al llegar al límite de mi cuenta para saber qué hacer.
- Como dueño del producto, quiero comprobar con dos cuentas reales que cada una ve solo lo suyo.

## Criterios de aceptación
Cada criterio debe poder comprobarse con una prueba. Se copian a `docs/features.json`.
- **C1:** Dado un entorno de producción con dos cuentas reales de Google distintas, cuando cada una guarda tareas, entregas, gym, hábitos y eventos, entonces cada una ve solo lo suyo desde cualquier dispositivo. *(Manual: necesita 007 y 008.)*
- **C2:** Dado un usuario que edita y cierra sesión con conexión, cuando vuelve a entrar (en el mismo u otro dispositivo), entonces ve esa última edición.
- **C3:** Dado un navegador usado por dos cuentas, cuando cambia de una a otra, entonces los datos locales de la primera nunca se suben a la segunda. *(Ya cubierto por la spec 009, E2E `03-primer-acceso` 3b y pruebas del motor.)*
- **C4:** Dados los componentes que antes escribían en `localStorage` por su cuenta (modal de acceso, respaldo, hábitos y gym), cuando se usan con sesión, entonces sus datos pasan por el estado de la cuenta y se sincronizan. *(Ya cubierto por la spec 009, paso 5e.)*
- **C5:** Dada una cuenta nueva (la nube no tiene datos suyos), cuando entra por primera vez, entonces Kanban, entregas, gym, aprendizaje y hábitos están vacíos, no aparece ningún dato de ejemplo («Mateo») y cada módulo vacío muestra una guía de qué hacer primero.
- **C6:** Dada una cuenta nueva con dos dispositivos que entran a la vez, cuando ambos terminan de sincronizar, entonces ambos muestran el mismo estado vacío y no se crean registros duplicados.
- **C7:** Dado un usuario con cambios sin sincronizar, cuando pulsa «Cerrar sesión» con conexión, entonces se suben (con un máximo de unos 5 segundos) antes de salir y la sesión se cierra.
- **C8:** Dado un usuario con cambios sin sincronizar y sin conexión, cuando pulsa «Cerrar sesión», entonces se le avisa de que se perderán esos cambios y puede cancelar o cerrar igualmente.
- **C9:** Dada una cuenta que alcanza los 5000 registros o un registro de más de 64 KB, cuando la app intenta sincronizar, entonces el indicador muestra un mensaje claro («Llegaste al límite de tu cuenta…»), lo ya guardado se conserva y el resto de la app sigue funcionando.
- **C10:** Dadas dos cuentas en la API, cuando una consulta o escribe, entonces nunca lee ni modifica registros de la otra. *(Ya existe en las pruebas de integración del API; se mantienen.)*

## Casos límite y errores
- **Cuenta que ya tiene datos de ejemplo guardados** (de pruebas): no se borran; solo cambia el estado de partida de cuentas nuevas.
- **Primer acceso sin red:** no es posible (el login exige red). Si la red cae justo después de entrar, la cuenta nueva parte vacía y sube su estado al volver la conexión.
- **Dos dispositivos nuevos a la vez:** ambos parten del mismo estado vacío; no debe haber duplicados ni conflictos (C6).
- **Cerrar sesión sin red con pendientes:** se avisa y se deja elegir (C8); nunca se descartan cambios sin que la persona lo sepa.
- **Cerrar sesión con la API dormida (Render gratuito):** el tiempo máximo de espera evita que el botón se quede colgado; si se agota, se trata como falta de conexión (C8).
- **Límite alcanzado con varios dispositivos:** el mensaje aparece en el dispositivo que intenta guardar y no borra nada de los otros.
- **Cuenta de Google sin nombre:** la cuenta nueva usa el nombre por defecto de la app (ya existe esa regla).

## Preguntas abiertas
- Texto y diseño de las guías de cada módulo vacío (el agente las propone en el plan; el humano las aprueba).
- ¿Cinco segundos es un tiempo adecuado para subir antes de cerrar sesión, sabiendo que la API gratuita de Render puede tardar en despertar?

## Decisiones del humano (2026-11-24)
1. **Cuenta nueva:** vacía con guía (sin datos de ejemplo).
2. **Cerrar sesión:** subir antes de cerrar, con tiempo máximo y aviso si no hay red.
3. **Límites:** se conservan (5000 registros, 64 KB) y se avisa con claridad al llegar a ellos.
