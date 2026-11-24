# Proyecto

> Fase 2 de la adopción (2026-11-23). Lo marcado «(confirmar)» se dedujo de `PRODUCT.md` y del código y aún no lo has validado.

## Qué es
**StudentOS** (marca: *StudentOS PRO MAX*) es un centro de control web (Life, Gym & College Hub) que reúne en un solo tablero las entregas por semanas académicas, el Kanban de proyectos, el entrenamiento de gimnasio, el horario semanal, los hábitos diarios y Google Calendar. Se entra solo con una cuenta de Google, que deja Google Calendar vinculado, y los datos se sincronizan entre dispositivos.

## Para quién
- **Objetivo declarado: producto público para estudiantes universitarios.** Nació para una sola persona (Mateo, estudiante de Ingeniería de Software que entrena fuerza), y esa visión sigue en `PRODUCT.md`.
- **Problema:** Notion, Jira, Trello y Google Calendar exigen configurar campos y filtros para apuntar una tarea; no conocen las semanas lectivas (1 a 16, parciales y finales) y están desconectados del entrenamiento y los hábitos.
- **Propuesta:** captura sin fricción (`Enter`, 1–2 clics, sin modales redundantes), vista «Hoy» tipo Bento y todo en un único lugar.

## Alcance
- **Incluye:** Resumen diario, Kanban, entregas universitarias por semanas y calculadora de notas (GPA 0–20), Gym (series, 1RM de Epley, récords, cronómetro de descanso), horario semanal con detección de choques, turno de trabajo, hábitos (agua, sueño, pomodoros), Aprendizaje, captura rápida, login solo con Google que vincula Calendar al entrar, sincronización PC ↔ móvil, conexión persistente con Google Calendar, exportar y borrar cuenta, páginas legales.
- **No incluye (por ahora):**
  - App móvil nativa (solo web responsive).
  - Otros calendarios además de Google (Outlook, Apple).
  - Varias universidades o planes de estudio distintos del modelo de semanas 1 a 16.
  - Colaboración entre usuarios (compartir tableros o grupos).
  - Pagos o planes de suscripción.

## Estado actual
**Prototipo** (decisión del humano). Funciona de punta a punta con la nube y servicios simulados (la spec 009, que retira el modo local, está lista para revisión y sin fusionar), y la integración con el backend está en `main`. Todavía no hay producción (`student-os-prod`), ni variables de producción en Vercel y Render, ni verificación de Google. Hasta entonces el login de Google admite como máximo 100 usuarios de prueba.

> **Tensión a resolver:** el objetivo es público pero el estado es prototipo. Mientras no se despliegue `student-os-prod`, las decisiones de seguridad y privacidad deben tomarse **como si ya hubiera usuarios externos** (ver «Zonas protegidas»).

## Zonas protegidas (no tocar sin permiso explícito)
El agente pregunta antes de modificar:
- **Borrado y exportación de cuenta** (`apps/api/src/public/`, `common/account-deletion.ts`): son obligaciones de privacidad y requisito de la verificación de Google.
- **Motor de sync y su regla de descarte** (`apps/web/src/sync/`, `components/sync/SyncProvider.tsx`): si fallan pueden mezclar o pisar datos entre cuentas. El importador del primer inicio se retiró (ADR 0007).
- **Claves de Google:** `GOOGLE_CLIENT_SECRET` y `GOOGLE_TOKEN_ENC_KEY`. Rotar la clave de cifrado deja ilegibles los refresh tokens ya guardados (`apps/api/src/google/token-cipher.ts`).

No marcaste de forma explícita Supabase de producción ni los deploys de Vercel/Render; aun así, «cualquier cosa que toque producción» sigue exigiendo tu permiso (`AGENTS.md` → Autonomía).

## Glosario
| Término | Significado en este proyecto |
|---------|------------------------------|
| Cuenta nueva | Cuenta de Google que la nube aún no conoce: parte del estado de la app sin los bloques de ejemplo y con su nombre de Google |
| Vinculación de Calendar | Entrega única del refresh token de Google al servidor durante el login (`POST /google/link-login`) |
| `AppState` | Objeto único con todo el estado de la app (esquema en `packages/shared`) |
| Colección | Tipo de registro de sync: `profile`, `kanban`, `university`, `learning`, `gym`, `calendar` |
| Slice | Porción de `AppState` que el motor de sync compara por `id` |
| Datos del prototipo | Lo que quedó en `localStorage` de la versión sin cuenta: se descarta al iniciar sesión, sin subirse (ADR 0007) |
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

Fuentes: `PRODUCT.md` (producto y marca), `docs/references/historial/PLAN.md` y `PLAN_BACKEND.md` (historial de planificación) y `docs/references/historial/memories.md` (historial de versiones, archivado).
