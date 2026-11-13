# 🧠 MEMORIES.md — Contexto Integral de StudentOS PRO MAX

> **Documento de memoria técnica, arquitectónica y funcional**  
> **Proyecto:** `student-os`  
> **Ubicación:** `C:\Users\Sergio Suarez\Documents\student-os`  
> **Versión actual:** `v2.7.0 (Asistencia Diaria Gym: Puerta Central "Iniciemos Hoy", Detección Retroactiva de Faltas, Mensaje Empático de Aliento, Protección de Racha y Reprogramación Semanal)`  
> **Rama activa:** `feat/ui-taste-foundation`  
> **Última actualización:** Noviembre 2026

---

## 📜 Regla General Obligatoria: Estándares de Commits, Pull Requests y Lectura Previa

> [!CRITICAL]
> **OBLIGACIÓN INELUDIBLE PARA TODOS LOS AGENTES Y DESARROLLADORES:**
> Antes de crear cualquier commit o abrir un Pull Request en este repositorio, **ES OBLIGATORIO** leer y cumplir estrictamente la estructura definida en la skill `github-workflow-standards`.
>
> 1. **Lectura Previa Obligatoria:** Consultar `memories.md` para entender el contexto arquitectónico y los límites de archivos antes de tocar código.
> 2. **Formato de Commits (Conventional Commits):**
>    - Obligatorio: `<tipo>(<ámbito>): <descripción en imperativo y presente>`
>    - Tipos admitidos: `feat`, `refactor`, `fix`, `ui`, `docs`, `merge`, `ci`, `chore`.
>    - Ejemplo: `feat(learning): implement Aprendizaje tab with Active Recall`
> 3. **Formato de Pull Requests (5 Secciones Obligatorias):**
>    - Todo PR debe responder obligatoriamente a las 5 preguntas reflexivas:
>      - `## 📌 ¿Qué es este proyecto / cambio?`
>      - `## 💡 ¿Por qué se creó? (El Por Qué)`
>      - `## 🎯 ¿Para qué sirve? (El Para Qué)`
>      - `## 🛠️ ¿Cómo está construido? (El Cómo)`
>      - `## 🧪 Pruebas & Validación (Checklist)`
>
> **ESTA ES UNA REGLA GENERAL QUE SÍ O SÍ SE DEBE CUMPLIR.** No se admitirán PRs vacíos, títulos genéricos ni commits sin el prefijo semántico correspondiente.

---

## 🎯 1. Visión y Propósito del Proyecto

**StudentOS PRO MAX** es un centro de control integral (Life, Gym & College Hub) desarrollado a medida para un estudiante universitario de **Ingeniería de Software / Sistemas** y apasionado del entrenamiento físico (Mateo).

### El Problema que Resuelve
Las herramientas tradicionales de productividad (Notion, Jira, Trello, Google Calendar):
- Son excesivamente burocráticas: exigen configurar campos, propiedades y filtros complejos solo para apuntar una tarea rápida.
- Carecen del concepto real de **semanas académicas** (Semana 1 a 16, parciales y finales).
- Están completamente desconectadas de las rutinas de entrenamiento físico (Gym) y hábitos diarios.

### La Propuesta de Valor
- **Zero-Friction UX:** Creación de registros en 1 o 2 clics o directamente mediante inputs *inline* con la tecla `Enter`.
- **Estructura Académica Real:** Calendario semestral estructurado por semanas (1 a 16), calculadora de promedio ponderado (GPA en escala 0-20), rúbricas interactivas y enlaces de entrega.
- **Gym & Fitness Integrado:** Seguimiento interactivo de series (S1, S2, S3, S4), pesos en kg, repeticiones, Rest Timer para descansos, calculadora de 1RM e historial de PRs.
- **Horario Semanal Inteligente:** Grilla horaria visual (07:00 a 22:00) con detección de colisiones de horario y exportador a Google Calendar (`.ics`).
- **Arquitectura Bento Grid & Hábitos:** Dashboard visual que consolida lo que el estudiante tiene que hacer **hoy**, hábitos diarios (agua, sueño, pomodoro) y backup/restore en `.json`.
- **100% Offline & Privado:** Persistencia reactiva en `localStorage` (`student_os_state_v1`) sin depender de bases de datos lentas.

---

## 🛠️ 2. Stack Tecnológico

| Capa | Tecnología | Versión | Rol en el Proyecto |
| :--- | :--- | :--- | :--- |
| **Framework UI** | React | `^19.3.1` | Biblioteca base con React Hooks modernos (`useState`, `useEffect`) |
| **Lenguaje** | TypeScript | `~7.0.2` (5.x core) | Tipado estricto para todo el modelo de datos y componentes |
| **Bundler & Dev Server**| Vite | `^8.3.6` | Empaquetado instantáneo con HMR ultrarrápido (build en < 400ms) |
| **Estilos & Utility** | Tailwind CSS v4 | `^4.3.4` (`@tailwindcss/vite`) | Sistema de diseño atómico moderno y soporte Dark Mode nativo |
| **Iconografía** | Lucide React | `^1.69.0` | Iconografía vectorial consistente y accesible (sin emojis interactivos) |
| **Gamificación** | Canvas-Confetti | `^1.9.4` | Animaciones de celebración al completar metas y rutinas |
| **Utilidades CSS** | clsx & tailwind-merge | `^2.1.1` / `^3.7.0` | Fusión segura de clases dinámicas |
| **Linter** | Oxlint | `^1.90.0` | Análisis estático de código ultrarrápido |

---

## 🏗️ 3. Arquitectura del Código y Estructura de Directorios

```text
student-os/
├── public/
│   ├── favicon.png                     # Nuevo favicon generado (Logo oficial)
│   ├── logo.png                        # Logo oficial 3D Badge de StudentOS
│   └── ...
├── src/
│   ├── assets/
│   │   ├── logo.png                    # Copia del logo para importación estática
│   │   └── ...
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── CalendarTimelineGrid.tsx # Vista Grilla Horaria (07:00 a 22:00) con colisiones
│   │   │   └── WeeklyCalendar.tsx       # Horario semanal Lunes a Domingo (conmutador Lista/Grilla y export .ics)
│   │   ├── common/
│   │   │   └── YoutubeIcon.tsx          # Icono SVG de YouTube nítido para branding de fuentes
│   │   ├── dashboard/
│   │   │   ├── BackupModal.tsx          # Modal de Backup y Restauración de datos en formato .json
│   │   │   ├── DailyHabitsCard.tsx      # Widget de hábitos (Agua +250ml, Sueño 7-8h, Pomodoros)
│   │   │   └── OverviewBento.tsx        # Tablero Bento con vista unificada de prioridades de hoy y widget de Aprendizaje
│   │   ├── gym/
│   │   │   ├── ExerciseCard.tsx         # Tarjeta visual multimedia de ejercicio con thumbnail de atleta y popup de video
│   │   │   ├── ExerciseProgressModal.tsx # Historial de cargas, récord personal (PR) y calculadora 1RM (Epley)
│   │   │   ├── ExerciseVideoModal.tsx    # Reproductor de video animado de técnica y biomecánica (60fps loop, pautas)
│   │   │   ├── GymTracker.tsx           # Tracker de rutinas, series interactivas, botones de técnica y cargas
│   │   │   ├── QuickWeightModal.tsx     # Modal rápido de sobrecarga progresiva con deltas (+1, +2.5, +5kg)
│   │   │   └── RestTimerFloating.tsx    # Cronómetro flotante de descanso entre series (presets 45s-120s)
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx          # Tablero Kanban con buscador en tiempo real y filtros
│   │   │   └── KanbanCard.tsx           # Tarjeta con Drag & Drop nativo HTML5 y subtareas/checklist
│   │   ├── layout/
│   │   │   ├── Navbar.tsx               # Barra superior pulida con prevención de text-wrapping, píldora de contexto semanal interactiva, badge de Semana Libre, tabs consistentes y dark mode
│   │   │   └── StatsHero.tsx            # Hero con saludo dinámico según la hora, racha 🔥 y watermark
│   │   ├── learning/
│   │   │   ├── FreeWeekCelebrationCard.tsx # Tarjeta de celebración y sugerencias para semanas libres (0 tareas)
│   │   │   └── LearningView.tsx         # Hub de Aprendizaje, Active Recall Feynman, fuentes de YouTube y gym check-in
│   │   ├── quick-add/
│   │   │   └── QuickAddModal.tsx        # Modal global de captura rápida con 5 pestañas: Universidad, Gym, Kanban, Calendario y Aprendizaje (YouTube & Notas)
│   │   └── university/
│   │       ├── AssignmentDetailModal.tsx # Modal con Rúbrica interactiva (checklist) y link de entrega
│   │       ├── GradesCalculatorModal.tsx # Calculadora de GPA (0-20), predicción de nota mínima requerida
│   │       └── UniversityView.tsx       # Gestión de entregas por semanas (1 a 16) con semáforos y chips de notas
│   ├── data/
│   │   └── initialData.ts               # Dataset inicial realista (Mateo, Ing. Software, Semana 5)
│   ├── hooks/
│   │   └── useLocalStorage.ts           # Hook personalizado de sincronización reactiva con localStorage
│   ├── types/
│   │   └── index.ts                     # Definición de interfaces TypeScript y tipos de dominio
│   ├── utils/
│   │   ├── confetti.ts                  # Funciones helper para micro y macro celebraciones
│   │   └── icsExport.ts                 # Generador de archivo estándar iCalendar (.ics)
│   ├── App.tsx                          # Orquestador principal de estado y navegación
│   ├── index.css                        # Tokens Obsidian, scrollbars, animación flame-pulse y glass-panel
│   └── main.tsx                         # Punto de entrada de montaje React
├── AGENT_1_INSTRUCTIONS.md              # Documentación de tareas y alcance del Agente 1
├── AGENT_2_INSTRUCTIONS.md              # Documentación de tareas y alcance del Agente 2
├── memories.md                          # Memoria viva del proyecto (este archivo)
├── PLAN.md                              # Plan de fases y arquitectura de ramas
├── package.json                         # Dependencias y scripts de Vite
└── tsconfig.json                        # Configuración de compilador TypeScript
```

---

## 🎨 4. Identidad Visual y Sistema de Diseño (`design-taste-frontend` v2.0)

- **Logo Oficial:**
  - Emblema 3D Badge que fusiona un delta/birrete universitario con un rayo cinético de energía deportiva (`/logo.png`).
- **Paleta de Color (`blue-black-cornflower` + `white-link-blue`, 92% neutra, cero violeta/índigo):**
  - **Modo Oscuro (`blue-black-cornflower`):** Fondo `--bg: #0a0d14`, Superficie `--surface: #131824`, Superficie alterna `--surface-2: #192030`, Texto `--ink: #e9edf3`, Secundario `--muted: #8891a1`, Acento primario `--action: #5ab9fc` (`--action-ink: #0a0d14`), Bordes de `1px` `--line: rgba(233, 237, 243, 0.10)`.
  - **Modo Claro (`white-link-blue`):** Fondo `--bg: #f7f8fa`, Superficie `--surface: #ffffff`, Superficie alterna `--surface-2: #f1f3f6`, Texto `--ink: #111318`, Secundario `--muted: #5d6470`, Acento primario `--action: #1a4be0` (`--action-ink: #ffffff`).
  - **Semántica funcional discreta:** Éxito `#10b981`, Aviso `#f59e0b`, Urgente/Colisión `#ef4444`, Energía Gym `#ff5a1f`.
- **Tipografía:**
  - `Schibsted Grotesk` (`400`, `500`, `600`) para títulos y lectura clara (mínimo `13px`, *sentence case* natural).
  - `JetBrains Mono` (`.t-num`, `tabular-nums`) para promedios GPA, pesos en `kg`, series, semanas, horarios y cronómetros.
- **Primitivas de Movimiento y Ergonomía (`src/components/common/` & `src/index.css`):**
  - `ModalShell.tsx`: diálogos con `createPortal` en escritorio y *Bottom Sheets* en móvil (`200ms` entrada, bloqueo de scroll y cierre con `Escape`).
  - `SegmentedControl.tsx`: indicador activo deslizante por `transform` (`240ms cubic-bezier(.65, 0, .35, 1)`) con `ResizeObserver`.
  - `SectionHeader.tsx`: encabezados consistentes por módulo; `<StatsHero />` exclusivo en `Resumen` y transición `.view-enter` (`220ms`) al cambiar entre las 6 vistas.
  - Controles táctiles `>=44x44px` y soporte completo para `@media (prefers-reduced-motion: reduce)`.

---

## 🧩 5. Módulos y Funcionalidades en Detalle

### 1. Universidad & Rendimiento Académico (`src/components/university/`)
- **Estructura Semestral 1 a 16:** Enfoque en la semana actual con alertas para Parciales (S8) y Finales (S16).
- **Calculadora GPA:** Promedio ponderado acumulado en escala 0-20.
  $$\text{Promedio} = \frac{\sum (\text{Nota}_i \times \text{Ponderación}_i)}{\sum \text{Ponderación}_i}$$
- **Predicción de Nota:** Calcula automáticamente qué nota mínima necesitas en las entregas pendientes para alcanzar tu promedio objetivo.
- **Rúbrica Interactiva:** Checklist por entrega con barra de progreso y ratio `X/Y`.
- **Links de Entrega:** Registro y apertura directa de URLs de Google Drive, GitHub, Teams o campus virtual.

### 2. Tablero Kanban de Trabajo & Proyectos (`src/components/kanban/`)
- **HTML5 Drag & Drop:** Arrastre nativo entre *Por Hacer*, *En Progreso* y *Completado*.
- **Subtareas en Tarjetas:** Mini-checklist desplegable dentro de cada tarjeta kanban con barra porcentual.
- **Buscador en Tiempo Real:** Filtro instantáneo por texto, descripción o etiquetas (`#tags`).
- **Filtros por Prioridad y Categoría:** Separación clara entre Universidad, Trabajo, Gym y Personal.

### 3. Gym & Fitness Tracker (`src/components/gym/` & `src/utils/routineGenerator.ts`)
- **Asistente Onboarding de 4 Pasos (`GymOnboardingModal.tsx`) & Motor de Rutinas (`routineGenerator.ts`):**
  - Se abre automáticamente en la primera visita si no hay perfil configurado y puede editarse en cualquier momento desde `Mi perfil gym`.
  - **Paso 1 (Sede):** Selección entre *Smart Fit*, *Gimnasio UTP / Universidad*, *Gimnasio Comercial / de Barrio*, *Casa / Calistenia* u *Otro* personalizado; adapta los ejercicios generados al equipamiento real.
  - **Paso 2 (Frecuencia y Días):** Selector de `2`, `3`, `4`, `5` o `6` días por semana con asignación automática de división muscular (*Full Body*, *Push/Pull/Legs*, *Torso/Pierna*) y selección exacta de días en la semana.
  - **Paso 3 (Objetivo y Nivel):** *Ganar músculo (Hipertrofia)*, *Fuerza máxima*, *Perder grasa / Definición* (incluye bloque Cardio Zona 2) o *Salud general*, calibrando series, repeticiones y tiempo del cronómetro (`45s`/`60s`/`90s`/`120s`).
  - **Paso 4 (Antropometría & IMC en vivo):** Registro de altura (`cm`), peso actual (`kg`) y peso meta opcional con cálculo instantáneo de IMC OMS y opción segura para reemplazar o conservar rutinas previas.
- **Tarjeta de Perfil Físico e Indicador IMC (`GymProfileCard.tsx`) + Check-In de Peso (`WeightCheckInModal.tsx`):**
  - Banda superior con divisores hairline 1px mostrando sede, objetivo, días activos, altura/peso y barra visual de rango IMC OMS con historial de peso corporal.
- **Día de Recuperación Activa (`GymRestDayBanner.tsx`):**
  - Banner limpio en días no entrenables según el split semanal, con recomendaciones de movilidad, hidratación y sueño más salto directo al próximo día de entreno.
- **Tarjetas Visuales Multimedia por Ejercicio (`ExerciseCard.tsx`):**
  - Cada ejercicio se presenta como una tarjeta visual enriquecida con thumbnail ilustrado de un atleta en ropa de gym realizando el movimiento.
  - Al presionar directamente sobre la imagen o tarjeta, se despliega el popup modal del video animado con pautas biomecánicas.
  - Catálogo inteligente de posters (`exerciseMediaCatalog.ts`) cubriendo Empuje, Pierna, Tracción y Recuperación/Cardio.
- **Rutinas Diarias (Lunes a Domingo):** Preselección automática del día de hoy (Push, Pull, Legs, etc.).
- **Burbujas de Series:** Marcado táctil de `S1`, `S2`, `S3`, `S4`.
- **Sobrecarga Progresiva & Registro Rápido de Peso (`QuickWeightModal.tsx`):**
  - Botón táctil directo `+ Cargar peso` en cada ejercicio.
  - Ajuste rápido mediante chips de delta (`+1 kg`, `+2.5 kg`, `+5 kg`, `-2.5 kg`) e input numérico.
  - Detección automática de Récord Personal (PR) y cálculo visual del incremento (`+2.5 kg vs previa`).
  - Persistencia reactiva en `history` y `localStorage`.
- **Video Animado de Biomecánica y Guía Técnica (`ExerciseVideoModal.tsx`):**
  - Popup interactivo activado al pulsar el thumbnail del ejercicio o el botón de técnica.
  - **Biblioteca de Videos con Movimiento Real a 30fps en WebM (1280x720):**
    - `bench-press-technique.webm`: Movimiento de flexión y empuje con codos a 45°, retracción y trayectoria diagonal de barra al esternón.
    - `squat-technique.webm`: Movimiento de sentadilla rompiendo la paralela (profundidad de 95°), torso neutro y empuje explosivo con barra.
    - `pullup-technique.webm`: Tracción vertical completa del cuerpo hacia la barra con activación dorsal y descenso controlado.
    - `cardio-mobility-technique.webm`: Marcha rítmica en caminadora inclinada al 12% a 132 BPM (Zona 2) y estiramiento activo.
  - Controles accesibles: Play/Pausa, reinicio, selector de velocidad (0.75x, 1x, 1.25x), silenciar y pantalla completa.
  - Pestañas técnicas: Posición inicial (retracción escapular, leg drive), trayectoria óptima, respiración con Maniobra de Valsalva y errores comunes a evitar.
- **Rest Timer Flotante:** Temporizador de descanso entre series con presets (45s, 60s, 90s, 120s) y aviso al terminar.
- **Historial de PRs & Calculadora 1RM (`ExerciseProgressModal.tsx`):**
  - Panel triple: Récord personal, 1RM estimado (Epley) y sobrecarga progresiva calculada.
  $$\text{1RM} = \text{Peso} \times \left(1 + \frac{\text{Reps}}{30}\right)$$
- **Botón "Finalizar Rutina":** Dispara macro-celebración de confeti e incrementa la racha diaria.

### 4. Horario Semanal & Agenda (`src/components/calendar/`)
- **Conmutador de Vistas:** Alterna entre vista clásica de tarjetas y **Grilla Horaria Timeline (07:00 a 22:00)**.
- **Detección de Colisiones:** Resalta en rojo si dos clases o bloques coinciden en horario.
- **Exportación iCalendar (`.ics`):** Descarga el archivo de calendario para importarlo en Google Calendar, Apple Calendar o Microsoft Outlook.

### 5. Resumen General & Hábitos (`src/components/dashboard/`)
- **Bento Dashboard:** Resumen de lo que Mateo debe hacer hoy en todas sus áreas de vida.
- **Widget de Hábitos Diarios:** Registro de agua (+250ml hacia meta de 2.5L), horas de sueño (meta 7-8h) y pomodoros completados.
- **Backup & Restore JSON:** Exportación e importación instantánea del estado completo del sistema para sincronizar entre dispositivos.
- **Bento Card de Aprendizaje & Active Recall:** Tarjeta destacada de 3 columnas que muestra la síntesis Feynman de la semana en curso, estado de Semana Libre y accesos rápidos a fuentes de YouTube.

### 6. Aprendizaje & Active Recall Semanal (`src/components/learning/`)
- **Arquitectura Bloc de Notas Semanal (Distraction-Free Notepad):**
  - Lienzo central amplio dedicado a redactar apuntes y reflexiones técnicas libres de formularios invasivos.
  - Prompts guiados Feynman en la cabecera (*💡 Explicación simple*, *🛠️ Desafío superado*, *⚡ Analogía del mundo real*, *🎯 Pregunta típica de examen*) con inserción fluida y auto-expansión.
  - Contador tabular de palabras en tiempo real (`.t-num`) y botón rápido de copiado.
  - Barra inferior sutil con chips interactivos de metadatos (estado de ánimo, conteo de conceptos `#tags` y fuentes guardadas).
- **Pop-Up Modal de Consolidación y Guardado (`ModalShell`):**
  - Se activa con el botón *"Guardar semana X"* o mediante el atajo de teclado nativo **`Ctrl + S` / `Cmd + S`**.
  - Permite clasificar en un solo lugar:
    1. **Estado Cognitivo / Energía (`mood`):** 4 opciones ergonómicas (*Con energía*, *Enfocado*, *En calma*, *Cansado*).
    2. **Conceptos Clave (`#tags`):** Input rápido que agrega chips de conceptos al pulsar `Enter`.
    3. **Bóveda de Fuentes & Videos (YouTube + TikTok + Instagram Reels + Categorías IA):**
       - Soporte nativo para **Instagram Reels** (`InstagramIcon.tsx`), **TikTok** (`TiktokIcon.tsx`) y **YouTube** (`YoutubeIcon.tsx`).
       - Detección automática de URLs de Instagram (`instagram.com/reel/`, etc.), TikTok y YouTube.
       - **7 Categorías Temáticas de Especialidad:**
         - 🤖 `IA en Claude` (Claude Code, Artifacts, prompts)
         - 💎 `IA en Gemini` (Gemini 2.0/3.0, Antigravity CLI, Google AI Studio)
         - ⚡ `Skills & Agentes` (Agent Skills, MCP, automatización)
         - 🎬 `Generación de Videos` (Sora, Runway Gen-3, Kling, Luma)
         - 📱 `Reels de Instagram` (Micro-tutoriales y tips en formato vertical)
         - 🎓 `Cursos` (Asignaturas universitarias, certificaciones)
         - 🎙️ `Conferencias & Talks` (Tech talks, papers, keynotes)
         - 📚 `General / Software` (Base para retrocompatibilidad)
       - Barra de filtros interactivos por categoría con conteo en tiempo real.
       - Auto-sugerencia inteligente de categorías según el título o enlace pegado.
- **Timeline Semestral Compacto (Semanas 1 a 16):**
  - Track horizontal con hitos destacados: **S8 (Parciales)**, **S16 (Finales)**, **Hoy (Semana actual)** y puntos en semanas con notas.
- **Sincronización Global:**
  - `QuickAddModal.tsx` adaptado con selector de Instagram Reel, TikTok y Categorías temáticas en la pestaña *Aprender*.
  - `OverviewBento.tsx` con soporte de iconos de Instagram, TikTok y badges de categoría.

### 7. Sistema de Navegación & Captura Rápida (`src/components/layout/Navbar.tsx` & `src/components/quick-add/`)
- **Navbar Obsidian Glassmorphism:**
  - Contenedor con `backdrop-blur-2xl bg-white/85 dark:bg-[#080c14]/90` y borde sutil `dark:border-white/[0.08]`.
  - Pestañas con prevención estricta de saltos de línea (`whitespace-nowrap`) y nombres punchy (`Overview`, `Kanban`, `Universidad`, `Gym`, `Calendario`, `Aprendizaje`).
  - **Insignias dinámicas:** La pestaña `Aprendizaje` exhibe en vivo badges como `🌴 Libre` o `Recall` (si falta registrar la síntesis semanal).
  - **Píldora interactiva de contexto académico:** Chip `[ ⚡ Semana 5 • 🌴 Libre ]` que al pulsarse transporta al usuario directamente a su bitácora de aprendizaje.
- **Captura Rápida Multidisciplinaria (5 Pestañas):**
  - Modal accesible globalmente con selector: Universidad, Gym, Kanban, Agenda y **Aprender** (guardado directo de enlaces de YouTube o notas a la semana deseada con confeti).

### 8. Landing Page, Pixel Art Interactivo & Mockups de Producto Real Impeccable (`src/components/landing/`)
- **Ilustración Pixel Art Interactiva Hero (`InteractivePixelStudents.tsx`):**
  - Arte pixel de 2 estudiantes universitarios con laptops generado y renderizado con pixelación nativa `[image-rendering:pixelated]`.
  - **Partículas de Tipeo Flotantes:** Emisión periódica de fragmentos de código y métricas que suben con animación `@keyframes floatUp` simulando escritura en tiempo real (`{ code }`, `npm run dev`, `1RM +5kg`, `GPA 19.0`, `✓ 200 OK`, `Semana 8`, `Push Day`, etc.).
  - **Hotspots Clickeables e Interactividad Directa:**
    - Estudiante izquierdo (Programación / Sistemas): Diálogos contextuales de compilación rápida, tests locales y modo offline.
    - Estudiante derecho (Ingeniería / Gym): Diálogos de récords personales (PR), GPA ponderado y series completadas.
  - **Efectos Audiovisuales al Hacer Clic:**
    - Generador de audio retro 8-bit sintetizado en tiempo real vía Web Audio API (`AudioContext` con onda triangular de 560Hz / 680Hz y rampa exponencial, 0 dependencias externas).
    - Globo de diálogo pixelado direccional con iconos semánticos y temporizador de auto-ocultamiento.
    - Estallido de micro-confeti focalizado en las coordenadas del estudiante presionado (`canvas-confetti`).
- **Eliminación Total de Ilustraciones Cartoon / Slop SVG:**
  - Sustitución de `StudentLaptopDuoVisual`, `LabFlaskNucleusVisual` y `StudentSoloFocusVisual` por componentes de producto real.
- **Componentes de Producto Real (`src/components/landing/visuals/`):**
  - `WorkspaceInteractiveMockup`: Ventana interactiva viva de `workspace/student-os.dev` con pestañas reales (`Hoy`, `Universidad`, `Gym`), marcado interactivo de entregas con confeti, botones táctiles de series (S1..S4) y campo rápido de notas con `Enter`.
  - `AcademicCadenceHubVisual`: Visualizador semestral interactivo de las semanas 1 a 16 con alerta de parciales (S8) y finales (S16), cálculo en vivo de GPA ponderado (0..20) y cálculo de 1RM de Epley.
  - `DiagnosticComparisonVisual`: Comparativa técnica de arquitectura de flujo (5 aplicaciones tradicionales fragmentadas vs el centro reactivo y offline de StudentOS).
- **Cumplimiento Estricto del Craft Floor de `impeccable`:**
  - Erradicación de gradientes de texto artificiales (`bg-clip-text text-transparent`).
  - Erradicación de kickers/eyebrows prohibidos encima de encabezados principales en Hero y StatsHero.
  - Erradicación de patrones box-in-box en `StatsHero` a favor de telemetría dividida por hairlines continuos de 1px.
  - Erradicación de numeraciones redundantes (`01 / 02 / 03`) en píldoras de valor y tarjetas.
  - Rampa tipográfica 100% alineada con `DESIGN.md` (eliminación de clases arbitrarias `text-[11px]` y `text-[10px]`).

---

## 🌿 6. Registro de Git y Ramas

| Rama | Estado | Commits Clave | Contenido |
| :--- | :--- | :--- | :--- |
| **`feat/ui-taste-foundation`** | **ACTIVA (v2.7.0)** | — | Fase 1 Asistencia Gym: `GymStartGateCard`, `GymMissFlowCard`, `GymMissedSummaryCard`, `gymAttendance.ts`, detección retroactiva de días pasados y reprogramación semanal |
| `feat/ui-taste-foundation` | v2.6.0 | `fc1ddae`, `044ffad`, `a296254` | Onboarding Gym 4 pasos, generador adaptativo 2–6 días, `GymProfileCard`, medidor IMC OMS, `WeightCheckInModal` y `GymRestDayBanner` |
| `feat/ui-taste-foundation` | v2.5.3 | `d5c6371` | Biblioteca completa de videos animados de movimiento por ejercicio (Press de banca, Sentadillas, Dominadas, Cardio a 30fps) |
| `feat/ui-taste-foundation` | v2.5.1 | `10aff7a` | Tarjetas visuales multimedia por ejercicio con atleta entrenando, catálogo de posters biomecánicos y popup de video |
| `feat/ui-taste-foundation` | v2.4.1 | `20e2c85` | Sobrecarga progresiva de cargas, modal rápido de peso (+1, +2.5, +5kg), video animado de técnica y guía biomecánica |
| `feat/ui-taste-foundation` | v2.3.1 | `2d709e3`, `373e555`, `5fef05f` | Pixel art interactivo en Hero, tipeo en vivo con partículas, sonido 8-bit Web Audio, diálogos y confeti |
| `feat/ui-taste-foundation` | v2.3.0 | `9268ae7`, `95efa37`, `1c561fb`, `3723f3b` | Auditoría Impeccable 20/20: Focus Trap WAI-ARIA, prefers-reduced-motion, SectionHeader h1, memoización React |
| `feat/audit-a11y-core-opt` | Fusionada | `9268ae7` | Trabajo del Agente 1 (Focus Trap, prefers-reduced-motion, SectionHeader h1, useCallback/useMemo) |
| `feat/audit-landing-auth-polish` | Fusionada | `95efa37`, `1c561fb` | Trabajo del Agente 2 (AuthModal labels htmlFor, selección contrast, táctil 44px) |
| `feat/wt1-shell-dashboard` | Fusionada | `a30c298` | Navbar, StatsHero, QuickAdd, OverviewBento, Hábitos y Backup |
| `feat/wt2-academic-learning` | Fusionada | `d4f8ff0` | Universidad, GPA, Rúbricas, Aprendizaje y Semana libre |
| `feat/wt3-kanban-calendar` | Fusionada | `4bd4451` | Kanban y Horario semanal con selector de día móvil |
| `feat/wt4-gym-fitness` | Fusionada | `9477508` | Gym Tracker, cronómetro mobile-safe y modal 1RM |
| `feat/student-os-core-hub` | Base previa | `037e9fb` | Rediseño de Navbar sin wrapping, badges en vivo y Aprendizaje en QuickAdd |
| `feat/agent-1-university-kanban` | Fusionada | `b81580a` | Trabajo del Agente 1 (Universidad + Kanban) |
| `feat/agent-2-gym-calendar-dashboard` | Fusionada | `f93f1a7` | Trabajo del Agente 2 (Gym + Calendario + Dashboard) |
| `main` | Base | `06e040f` | Versión inicial del repositorio |

---

## 🚀 7. Verificación del Sistema (v2.6.0)
- **Compilación de Producción:** `npm run build` (`tsc -b && vite build`) con 0 errores en ~450ms.
- **Linter Estático:** `npx oxlint` con 0 errores en los módulos integrados (`GymTracker`, `GymOnboardingModal`, `GymProfileCard`, `WeightCheckInModal`, `GymRestDayBanner`, `routineGenerator`, `App`).
- **Prueba E2E Playwright (Chromium):** Flujo completo validado (Paso 1→4 Wizard, cálculo IMC 23.8→24.0, registro de peso, vista Rest Day, 0 errores en consola y 0 errores de página).
- **Videos WebM Nativos a 30fps:** 4 videos cinemáticos generados en `public/videos/`:
  - `bench-press-technique.webm` (1.12 MB)
  - `squat-technique.webm` (1.16 MB)
  - `pullup-technique.webm` (1.15 MB)
  - `cardio-mobility-technique.webm` (1.10 MB)
