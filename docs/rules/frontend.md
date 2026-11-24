# Reglas del frontend

Generales, valen para cualquier framework. Lo específico del stack está en `docs/stack/frontend.md`.

## Componentes
- Componentes pequeños y con una sola responsabilidad. Si pasa de ~200 líneas, divídelo.
- La lógica de negocio y las llamadas a la API no van en los componentes de presentación: van en servicios, hooks o stores.
- Reutiliza los componentes de UI existentes antes de crear uno nuevo.

## Datos y API
- Todas las llamadas al backend pasan por una única capa cliente (p. ej. `src/lib/api/`). Nada de `fetch` disperso.
- Usa los tipos compartidos de `packages/` para las respuestas de la API. No los dupliques.
- Gestiona siempre los tres estados: cargando, error y vacío.

## Accesibilidad y UX
- HTML semántico, etiquetas en los formularios, `alt` en las imágenes y navegación con teclado.
- Los mensajes de error deben ser útiles para el usuario, no trazas técnicas.

## Rendimiento
- No añadas dependencias pesadas para resolver problemas pequeños (pregunta antes, ver AGENTS.md).
- Carga diferida para rutas y componentes grandes.

## Convenciones observadas en el código (pendientes de confirmar)
- (observado) **Un único `AppState`** en `App.tsx`; los módulos reciben su porción y callbacks. Excepciones actuales que acceden a `localStorage` directamente: `AuthModal`, `BackupModal`, `DailyHabitsCard` y `GymTracker` (deuda en `docs/TASKS.md`); no añadas más.
- (observado) **Sync por adaptadores:** cada colección tiene su adaptador en `src/sync/adapters/<coleccion>.ts` que cumple `adapterTypes.ts`; un módulo nuevo se registra en `adapters/index.ts` y no toca el motor.
- (observado) **Capa de servicios:** las llamadas a la API pasan por `src/services/api.ts` y la sesión por `src/services/supabase.ts`; Google Calendar, por la fachada `services/googleCalendar.ts` (nunca se expone un token de Google al componente).
- (observado) **Componentes por módulo** en `src/components/<modulo>/` (kanban, gym, university, calendar…), con `common/` para lo reutilizable.
- (observado) **Pruebas unitarias** junto al código (`*.test.ts(x)`, Vitest + Testing Library), los hooks de sync con variantes `*.enabled.test.tsx` / `*.disabled.test.tsx`.
- (observado) **Estilos con Tailwind v4** y `clsx` + `tailwind-merge` para clases condicionales; iconos de `lucide-react`.
- (observado) **Textos de interfaz en español** y terminología fija del producto (Semana 1–16, GPA 0–20, Series S1–S4, PR, 1RM).

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
