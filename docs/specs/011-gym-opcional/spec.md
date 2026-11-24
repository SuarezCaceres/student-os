# Spec · 011 · Gimnasio opcional («no voy al gimnasio»)

> Estado: **aprobada por delegación** el 2026-11-24 (el humano dijo «haz lo mejor que creas conveniente, tú escoge y avanza» tras revisar las preguntas abiertas; las decisiones de abajo son las recomendadas)
> Dice **qué** y **por qué**, no **cómo**. El cómo va en `plan.md`, después de aprobar esta spec.
> Prioridad: pedido por el humano el 2026-11-23 (`docs/TASKS.md` → P1).

## Problema
El gimnasio está pensado como parte obligatoria de la app: hay una pestaña «Gym», una tarjeta en el resumen, un asistente de primera vez (`GymOnboardingModal`) que pide datos (días, horario, objetivo, peso y altura) y bloques de gym que se publican en Google Calendar. Quien **no va al gimnasio** no tiene forma de decirlo: la app le sigue mostrando el módulo, le pide completar datos que no necesita y le deja avisos de «horario sin programar».

## Objetivo
Completar la información del gimnasio **no es obligatorio**. Hay una opción clara, «No voy al gimnasio», que **oculta todo el módulo de gym** y deja de pedir esos datos. El usuario puede **volver a activarlo** cuando quiera desde ajustes, y la elección se guarda con su cuenta (se conserva al cerrar sesión y al entrar desde otro dispositivo).

## Alcance
- **Incluye:**
  - Un botón «No voy al gimnasio» en el primer contacto con el gym: en el asistente de primera vez y en la tarjeta o pantalla vacía del gym.
  - Al activarlo, ocultar el gym en **todos** los lugares donde aparece: la pestaña «Gym» de la navegación, la tarjeta de gym del resumen, el acceso rápido «añadir gym», los avisos de horario de gym pendiente y los hábitos o contadores de gym.
  - No publicar ni mantener bloques de gym en Google Calendar mientras esté desactivado, y no mostrar los bloques de gym que ya hubiera en el calendario de la app.
  - Una opción para **reactivar** el gym: con el gym oculto, el resumen muestra en su lugar una línea discreta «Gym desactivado · Reactivar». No se crea una pantalla de ajustes.
  - Guardar la elección por usuario (se sincroniza con el resto del estado).
- **No incluye:**
  - Borrar los datos de gym que el usuario ya tenga (perfil, rutinas, asistencia). Se **conservan** y vuelven a aparecer si reactiva el gym.
  - Un botón diario de «hoy no voy» (el humano eligió ocultar el módulo entero).
  - Borrar de Google Calendar los eventos de gym ya publicados: no se tocan al desactivar.
  - Cambiar el contenido ni el diseño del gym cuando está activo.

## Historias de usuario
- Como estudiante que no va al gimnasio, quiero decirlo con un botón para que la app deje de pedirme datos y de mostrarme el gym.
- Como estudiante que dejó de ir al gimnasio, quiero ocultar el módulo sin perder lo que ya registré, para retomarlo si vuelvo.
- Como estudiante que cambia de dispositivo, quiero que mi elección me siga, para no tener que repetirla.

## Criterios de aceptación
Cada criterio debe poder comprobarse con una prueba. Se copian a `docs/features.json`.
- **C1:** Dado un usuario sin perfil de gym, cuando se abre el asistente de primera vez del gym, entonces hay un botón «No voy al gimnasio» visible y se puede usar sin rellenar ningún campo.
- **C2:** Dado un usuario sin perfil de gym, cuando entra a la pestaña «Gym» o ve la tarjeta de gym del resumen, entonces también encuentra la opción «No voy al gimnasio».
- **C3:** Dado un usuario que pulsa «No voy al gimnasio», cuando termina, entonces la pestaña «Gym» ya no aparece en la navegación y no se abre ningún asistente ni modal de gym.
- **C4:** Dado un usuario con el gym desactivado, cuando ve el resumen, entonces no aparece la tarjeta de gym, ni el acceso rápido «añadir gym», ni avisos de horario de gym pendiente.
- **C5:** Dado un usuario con el gym desactivado, cuando ve el calendario y los hábitos, entonces no aparecen bloques ni contadores de gym, y no se publica ningún evento de gym en Google Calendar.
- **C6:** Dado un usuario con el gym desactivado, cuando ve el resumen, entonces aparece la línea «Gym desactivado · Reactivar»; al usarla, la pestaña, la tarjeta y los bloques de gym vuelven a aparecer.
- **C7:** Dado un usuario con perfil, rutinas y asistencia de gym guardados, cuando desactiva y reactiva el gym, entonces esos datos siguen intactos.
- **C8:** Dado un usuario que desactivó el gym, cuando cierra sesión y vuelve a entrar (o entra desde otro dispositivo), entonces el gym sigue desactivado.
- **C9:** Dados dos usuarios distintos, cuando uno desactiva el gym, entonces al otro no le cambia nada.
- **C10:** Dado un usuario que ya tenía los datos de gym en la nube sin el nuevo ajuste, cuando abre la app tras la actualización, entonces el gym sigue activo, como antes.

## Casos límite y errores
- **Ya hay eventos de gym en Google Calendar:** se dejan como están; la app no los borra ni los republica mientras el gym esté desactivado. Al reactivar, el comportamiento es el de hoy.
- **Estás en la pestaña «Gym» y lo desactivas:** la app te lleva al resumen, no a una pantalla vacía.
- **Un enlace o recordatorio apunta al gym con el módulo oculto** (por ejemplo, un aviso de gym perdido): no debe abrir una pantalla oculta; se ignora o lleva al resumen.
- **Fallo al guardar la elección** (sin red o error del servidor): la elección se mantiene en la sesión y se reintenta con el sync normal, sin pérdida de datos.
- **Datos antiguos sin el ajuste:** se interpretan como «gym activo» (C10).

## Decisiones tomadas (antes preguntas abiertas)
- **Dónde se reactiva:** no existe una pantalla de ajustes; se reactiva desde la línea «Gym desactivado · Reactivar» del resumen.
- **Eventos ya publicados en Google Calendar:** no se borran ni se republican al desactivar.
- **Orden de ramas:** esta rama sale de la 009 porque ambas editan `App.tsx`; se fusiona **después** de la 009 (o se rebasa cuando la 009 llegue a `main`).

## Preguntas abiertas
- Ninguna.
