# Spec · 012 · Quehaceres diarios con meta, motivación e historial

> Estado: **borrador** (espera la aprobación del humano)
> Dice **qué** y **por qué**, no **cómo**. El cómo va en `plan.md`, después de aprobar esta spec.
> Prioridad: pedido por el humano el 2026-11-23 (`docs/TASKS.md` → P2).
> Las decisiones marcadas con 🧭 son **elecciones del agente** (el humano dijo «tú escoge y avanza»); revísalas, son fáciles de cambiar antes de implementar.

## Problema
La app ayuda con entregas, gym y horario, pero no con lo cotidiano que sostiene el día: tender la cama, darle de comer al perro, sacarlo a pasear, caminar 15 minutos, ir al mercado. Hoy no hay dónde marcarlo, ni una meta que motive, ni forma de ver qué días rindes más o menos. Y en los días malos no hay una salida amable: todo lo que no haces parece un fallo.

## Objetivo
En la pantalla principal hay una tarjeta **«Quehaceres»** con las tareas cotidianas de **hoy**. El usuario las marca, ve su avance contra una **meta diaria** que le da ánimo según cuántas completa, y puede decir «hoy no puedo» sin sentirse penalizado. Cada día queda guardado en un **historial**, y una gráfica semanal le muestra **en qué día de la semana hace más**.

## Alcance
- **Incluye:**
  - Tarjeta «Quehaceres» en el resumen, separada de «Hábitos diarios» (esa guarda cantidades, esta casillas de hecho / no hecho).
  - Una **lista base editable** con ejemplos (tender la cama, darle de comer al perro, sacar al perro a pasear, caminar 15 minutos, ir al mercado…); el usuario puede **añadir los suyos**, renombrar y quitar cualquiera.
  - Cada quehacer elige **qué días de la semana aplica** (por ejemplo, el mercado solo el sábado). Por defecto, todos los días.
  - Marcar un quehacer **una vez por día** (hecho / no hecho).
  - **Niveles de motivación por cantidad:** por defecto, 5 completados = «¡Eres lo máximo!» y 10 = «¡Sigue así!»; los umbrales y los mensajes son editables.
  - Botón **«Hoy no puedo»**: marca el día como **día difícil**, sin penalización. 🧭 Se puede añadir un motivo opcional (cansado, agobiado, enfermo, otro) y deshacerlo el mismo día; lo ya marcado se conserva.
  - **Historial guardado por usuario:** por cada día, qué quehaceres se completaron y si fue día difícil.
  - **Gráfica semanal** 🧭: promedio de quehaceres completados por día de la semana (lunes a domingo) en las últimas 8 semanas, resaltando tu mejor día. Los días difíciles se excluyen del promedio para no «castigar» al día en que te agobiaste.
- **No incluye:**
  - Rachas ni puntos acumulados 🧭 (no se pidieron y pueden convertirse en presión; se pueden añadir después).
  - Recordatorios o notificaciones.
  - Editar días pasados 🧭: el historial es de solo lectura; solo se marca el día de hoy.
  - Cambiar «Hábitos diarios» ni migrarlo a la nube (eso es el pendiente M2).
  - Compartir el progreso con otras personas.

## Historias de usuario
- Como estudiante, quiero marcar mis quehaceres del día en la pantalla principal para sentir que avanzo.
- Como estudiante, quiero mensajes de ánimo según cuántos complete para mantenerme motivado.
- Como estudiante agobiado, quiero decir «hoy no puedo» sin que cuente como fallo, para no sentirme mal.
- Como estudiante, quiero ver en qué día de la semana hago más, para entender mi rendimiento.
- Como estudiante, quiero que mi historial me siga a otro dispositivo, para no perderlo.

## Criterios de aceptación
Cada criterio debe poder comprobarse con una prueba. Se copian a `docs/features.json`.
- **C1:** Dado un usuario nuevo, cuando ve el resumen, entonces aparece la tarjeta «Quehaceres» con la lista base de ejemplos, cada uno sin marcar.
- **C2:** Dado un usuario, cuando añade, renombra o elimina un quehacer, entonces la lista refleja el cambio y se conserva al recargar.
- **C3:** Dado un quehacer con días de la semana elegidos, cuando es un día que no le corresponde, entonces no aparece en la tarjeta de hoy ni cuenta para la meta; y cuando sí le corresponde, aparece.
- **C4:** Dado un quehacer de hoy, cuando se marca y se desmarca, entonces el contador de completados sube y baja en consecuencia, y no se puede marcar dos veces el mismo en el día.
- **C5:** Dados los umbrales por defecto, cuando el usuario completa 5 quehaceres, entonces ve «¡Eres lo máximo!»; con 10 ve «¡Sigue así!»; con menos de 5 ve su progreso hacia la primera meta.
- **C6:** Dado un usuario que cambia los umbrales o los mensajes, cuando completa la cantidad nueva, entonces ve los mensajes nuevos, y el cambio se conserva.
- **C7:** Dado que no se completaron todos los quehaceres posibles de hoy por tener menos de 5 aplicables, cuando completa todos los de hoy, entonces ve un mensaje de «completaste todos los de hoy» en vez de quedarse «lejos de la meta».
- **C8:** Dado un usuario, cuando pulsa «Hoy no puedo», entonces el día queda marcado como día difícil con un mensaje amable, sin contar como fallo ni mostrar la meta como incumplida.
- **C9:** Dado un día marcado como difícil con quehaceres ya completados, cuando se marca y luego se deshace, entonces los quehaceres completados se conservan y el día deja de ser difícil.
- **C10:** Dado el paso de un día al siguiente (medianoche local), cuando el usuario vuelve a abrir la app, entonces el día anterior queda guardado en el historial tal como estaba y hoy empieza sin nada marcado.
- **C11:** Dado el historial guardado, cuando renombra o elimina un quehacer, entonces los días pasados siguen mostrando el nombre con el que se completó.
- **C12:** Dado un historial con varios días, cuando ve la gráfica, entonces muestra el promedio de completados por día de la semana de las últimas 8 semanas, resalta el mejor día y no cuenta los días difíciles en el promedio.
- **C13:** Dado un usuario sin historial suficiente, cuando ve la gráfica, entonces ve un estado vacío claro en vez de una gráfica en cero.
- **C14:** Dado un usuario con quehaceres, historial y días difíciles, cuando cierra sesión y entra en otro dispositivo, entonces lo encuentra todo igual.
- **C15:** Dados dos usuarios distintos, cuando uno marca quehaceres, entonces al otro no le cambia nada.

## Casos límite y errores
- **Cambio de día con la app abierta:** la tarjeta se actualiza sola a medianoche (hora local) sin recargar.
- **Cambio de zona horaria o de hora del dispositivo:** el «día» es el de la fecha local del dispositivo; no se reescribe el historial ya guardado.
- **Todos los quehaceres de hoy quitados o ninguno aplicable:** la tarjeta lo dice y ofrece añadir uno, sin errores ni división entre cero.
- **Un quehacer eliminado a mitad del día tras marcarlo:** ese día conserva lo completado (C11).
- **Nombres vacíos o repetidos:** no se aceptan vacíos; los repetidos se permiten con aviso, o se evitan.
- **Muchos quehaceres:** hay un máximo razonable (🧭 30) para que la tarjeta siga siendo usable y el registro de cada día quepa en el límite por registro (64 KB).
- **Sin red:** todo funciona localmente y se sincroniza después; no se pierde ninguna marca.
- **Dato dañado o de una versión futura:** se ignora sin romper el resumen.

## Preguntas abiertas
- Confirmar las elecciones 🧭: sin rachas, solo hoy editable, promedio de 8 semanas, motivo opcional del día difícil y máximo de 30 quehaceres.
- ¿La lista base debe incluir exactamente los cinco ejemplos que mencionaste, o prefieres otros? 🧭 Se propone: tender la cama, darle de comer al perro, sacar al perro a pasear, caminar 15 minutos e ir al mercado (sábado).
