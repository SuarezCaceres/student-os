# Proyecto

> Fase 2 de la adopción (2026-11-23). Lo marcado «(confirmar)» se dedujo de `PRODUCT.md` y del código y aún no lo has validado.

## Qué es
**StudentOS** (marca: *StudentOS PRO MAX*) es un centro de control web (Life, Gym & College Hub) que reúne en un solo tablero las entregas por semanas académicas, el Kanban de proyectos, el entrenamiento de gimnasio, el horario semanal, los hábitos diarios y Google Calendar. Funciona sin cuenta, en local, y sincroniza entre dispositivos al iniciar sesión.

## Para quién
- **Objetivo declarado: producto público para estudiantes universitarios.** Nació para una sola persona (Mateo, estudiante de Ingeniería de Software que entrena fuerza), y esa visión sigue en `PRODUCT.md`.
- **Problema:** Notion, Jira, Trello y Google Calendar exigen configurar campos y filtros para apuntar una tarea; no conocen las semanas lectivas (1 a 16, parciales y finales) y están desconectados del entrenamiento y los hábitos.
- **Propuesta:** captura sin fricción (`Enter`, 1–2 clics, sin modales redundantes), vista «Hoy» tipo Bento y todo en un único lugar.

## Alcance
- **Incluye:** Resumen diario, Kanban, entregas universitarias por semanas y calculadora de notas (GPA 0–20), Gym (series, 1RM de Epley, récords, cronómetro de descanso), horario semanal con detección de choques, turno de trabajo, hábitos (agua, sueño, pomodoros), Aprendizaje, captura rápida, modo local, login con Google, sincronización PC ↔ móvil, importador del primer inicio, conexión persistente con Google Calendar, exportar y borrar cuenta, páginas legales.
- **No incluye (por ahora):**
  - App móvil nativa (solo web responsive).
  - Otros calendarios además de Google (Outlook, Apple).
  - Varias universidades o planes de estudio distintos del modelo de semanas 1 a 16.
  - Colaboración entre usuarios (compartir tableros o grupos).
  - Pagos o planes de suscripción.

## Estado actual
**Prototipo** (decisión del humano). Funciona de punta a punta en local y en la nube con servicios simulados, y la integración con el backend está en `main`. Todavía no hay producción (`student-os-prod`), ni variables de producción en Vercel y Render, ni verificación de Google. Hasta entonces el login de Google admite como máximo 100 usuarios de prueba.

> **Tensión a resolver:** el objetivo es público pero el estado es prototipo. Mientras no se despliegue `student-os-prod`, las decisiones de seguridad y privacidad deben tomarse **como si ya hubiera usuarios externos** (ver «Zonas protegidas»).

## Zonas protegidas (no tocar sin permiso explícito)
El agente pregunta antes de modificar:
- **Borrado y exportación de cuenta** (`apps/api/src/public/`, `common/account-deletion.ts`): son obligaciones de privacidad y requisito de la verificación de Google.
- **Importador y migración del primer inicio** (`apps/web/src/sync/`, componente del importador): si fallan pueden pisar datos de un usuario.

Elegiste no proteger de forma explícita el modo local ni la integración con Google; aun así, cualquier cambio en el cifrado del refresh token o en el flujo OAuth pasa por `docs/rules/security.md`.

## Glosario
| Término | Significado en este proyecto |
|---------|------------------------------|
| Modo local | Uso sin cuenta: todo el estado vive en `localStorage` (clave `student_os_state_v1`) |
| Modo nube | Uso con sesión: el estado se sincroniza con la API y Supabase |
| `AppState` | Objeto único con todo el estado de la app (esquema en `packages/shared`) |
| Colección | Tipo de registro de sync: `profile`, `kanban`, `university`, `learning`, `gym`, `calendar` |
| Slice | Porción de `AppState` que el motor de sync compara por `id` |
| Importador | Pantalla del primer inicio de sesión que decide qué hacer con los datos locales frente a los de la nube |
| Semana 1–16 | Semanas lectivas del semestre; ordenan las entregas, parciales y finales |
| GPA (0–20) | Promedio académico en escala de 0 a 20 |
| Serie / S1–S4 | Series de un ejercicio de gym |
| PR | Personal Record |
| 1RM | Repetición máxima estimada con la fórmula de Epley |
| Bento (Resumen) | Panel «Hoy» con las prioridades, hábitos y agenda del día |
| Captura rápida | Entrada de una tarea o evento en 1–2 clics (`QuickAddModal`) |
| Turno de trabajo | Horario laboral (p. ej. nocturno 22:00–06:00) que bloquea el calendario |
| Tombstone | Marca de borrado de un registro de sync |
| Harness | Estructura de `AGENTS.md`, `docs/` y skills que usan los agentes de IA |

Fuentes: `PRODUCT.md` (producto y marca), `PLAN.md` y `PLAN_BACKEND.md` (historial de planificación) y `memories.md` (historial de versiones).
