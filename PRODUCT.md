# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mateo, estudiante universitario de Ingeniería de Software / Sistemas y deportista enfocado en entrenamiento de fuerza e hipertrofia. Necesita alternar sin fricción entre la gestión académica de alta exigencia y la disciplina del entrenamiento físico diario.

## Product Purpose

StudentOS PRO MAX es un centro de control integral (Life, Gym & College Hub) diseñado para erradicar la sobrecarga burocrática de aplicaciones tradicionales (Notion, Jira, Google Calendar). Centraliza en una sola interfaz reactiva el seguimiento de cursos, calendario por semanas académicas (1 a 16), calculadora de GPA (escala 0-20), entregas, rutina de fuerza (series S1-S4, pesos kg, repeticiones, 1RM, cronómetro de descanso) y hábitos diarios. El éxito significa gestionar la jornada completa en segundos, sin configurar bases de datos ni formularios innecesarios.

## Positioning

La única plataforma personalizada que unifica la estructura semestral académica real con un tracker de entrenamiento de gimnasio y hábitos en un tablero Bento "Hoy", ejecutándose al 100% en local y offline mediante `localStorage`, con velocidad instantánea y sin suscripciones ni dependencias de nube.

## Operating Context

- **Jornada de estudio y clases:** Consulta rápida del horario semanal en grilla (07:00 a 22:00 con detección de colisiones), seguimiento de semanas lectivas (Semana 1 a 16), fechas de exámenes parciales/finales y cálculo automático del promedio ponderado.
- **Entrenamiento en gimnasio:** Registro ágil de cargas y repeticiones por serie, activación del cronómetro flotante de descanso (45s–120s), cálculo de 1RM con fórmula de Epley y registro de récords personales (PR).
- **Ritual diario:** Revisión de prioridades en el Bento Grid, seguimiento de hábitos (agua, sueño, pomodoros) y copias de seguridad periódicas mediante exportación e importación directa en archivo `.json`.

## Capabilities and Constraints

- **Tecnología base:** React 19, TypeScript estricto, Tailwind CSS v4 (`@tailwindcss/vite`), Bundler Vite, Iconografía Lucide React.
- **Persistencia de datos:** 100% offline y privada en `localStorage` con la clave `student_os_state_v1`.
- **Cero Burocracia:** Entradas *inline* activadas con la tecla `Enter`, creación y edición en 1–2 clics sin modales redundantes.
- **Dark Mode Nativo:** Alternancia fluida entre tema claro y tema oscuro persistente.
- **Terminología obligatoria:** Semanas 1 a 16, GPA (0–20), Series (S1, S2, S3, S4), PR (Personal Record), 1RM (Epley), Bento Grid, Rest Timer.

## Brand Commitments

- **Nombre del producto:** StudentOS PRO MAX
- **Voz y tono:** Directo, sobrio, enfocado en el rendimiento y la eficiencia ("Zero-Friction UX"). Sin adornos superfluos ni textos de relleno.
- **Identidad visual:**
  - Logotipo oficial 3D Badge presente en `public/logo.png` y `public/favicon.png`.
  - Paleta gobernada por la regla 92% neutros con 1 acento de acción (`#1a4be0` en claro / `#5ab9fc` en oscuro) y acento de estado Gym (`#e04f16` / `#ff6b35`).
  - Prohibición estricta de degradados violeta/lavanda genéricos ("AI slop").

## Evidence on Hand

- Código fuente modular y funcional implementado en `src/components/` (calendar, gym, kanban, dashboard, layout, landing).
- Memoria técnica integral y registro de decisiones en `memories.md`.
- Activos gráficos de marca consolidados en `public/logo.png`, `public/favicon.png` y `src/assets/logo.png`.

## Product Principles

1. **Zero-Friction UX:** Toda acción recurrente (apuntar tarea, marcar serie o registrar nota) debe resolverse con atajos rápidos o en menos de 2 clics.
2. **Real Academic Cadence:** La organización del tiempo refleja el calendario académico universitario por semanas (1 a 16), eliminando fechas abstractas sin contexto lectivo.
3. **Dual Focus (Brain & Muscle):** La disciplina intelectual y el rendimiento físico tienen el mismo nivel de prioridad en el día a día.
4. **Data Sovereignty & Offline-First:** Todos los datos pertenecen al usuario, viven en su navegador y se respaldan en formato `.json` sin depender de servidores externos.

## Accessibility & Inclusion

- Navegación accesible por teclado en formularios y tableros.
- Ratios de contraste WCAG AA validados para fondos y textos en ambos temas (claro y oscuro).
- Iconografía asistida por texto semántico o etiquetas accesibles (ARIA labels en botones de control y cronómetro).
