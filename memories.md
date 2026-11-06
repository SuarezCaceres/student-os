# 🧠 MEMORIES.md — Contexto Integral de StudentOS PRO MAX

> **Documento de memoria técnica y funcional**  
> Proyecto: `student-os`  
> Ubicación: `C:\Users\mateo\Documents\proyects\student-os`  
> Última actualización: Noviembre 2026

---

## 🎯 1. Visión y Propósito del Proyecto

**StudentOS PRO MAX** es un centro de control integral (Life, Gym & College Hub) desarrollado a medida para un estudiante universitario de **Ingeniería de Software / Sistemas** (Mateo).

### El Problema que Resuelve
Las herramientas tradicionales de productividad (Notion, Jira, Trello, Google Calendar):
- Son excesivamente burocráticas: exigen configurar campos, propiedades y filtros complejos solo para apuntar una tarea rápida.
- Carecen del concepto real de **semanas académicas** (Semana 1 a 16, parciales y finales).
- Están completamente desconectadas de las rutinas de entrenamiento físico (Gym) y hábitos diarios.

### La Propuesta de Valor
- **Zero-Friction UX:** Creación de registros en 1 o 2 clics o directamente mediante inputs *inline* con la tecla `Enter`.
- **Estructura Académica Real:** Calendario semestral estructurado por semanas (1 a 16) con cálculo de días restantes y ponderación de calificaciones.
- **Gym & Fitness Integrado:** Seguimiento interactivo de series (S1, S2, S3, S4), pesos en kg, repeticiones y gamificación con racha diaria (🔥) y confeti.
- **Arquitectura Bento Grid:** Dashboard visual que consolida lo que el estudiante tiene que hacer **hoy** en todos los ámbitos de su vida.
- **100% Offline & Privado:** Persistencia reactiva en `localStorage` sin depender de servidores externos o bases de datos lentas.

---

## 🛠️ 2. Stack Tecnológico

| Capa | Tecnología | Versión | Rol en el Proyecto |
| :--- | :--- | :--- | :--- |
| **Framework UI** | React | `^19.3.1` | Biblioteca base con React Hooks modernos (`useState`, `useEffect`) |
| **Lenguaje** | TypeScript | `~7.0.2` (5.x core) | Tipado estricto para todo el modelo de datos y componentes |
| **Bundler & Dev Server**| Vite | `^8.3.6` | Empaquetado instantáneo con HMR y build ultrarrápido |
| **Estilos & Utility** | Tailwind CSS v4 | `^4.3.4` (`@tailwindcss/vite`) | Sistema de diseño atómico moderno y soporte Dark Mode nativo |
| **Iconografía** | Lucide React | `^1.69.0` | Iconografía vectorial consistente y accesible (sin emojis interactivos) |
| **Gamificación** | Canvas-Confetti | `^1.9.4` | Animaciones de celebración al completar metas y rutinas |
| **Utilidades CSS** | clsx & tailwind-merge | `^2.1.1` / `^3.7.0` | Fusión segura de clases dinámicas |
| **Linter** | Oxlint | `^1.90.0` | Análisis estático de código ultrarrápido |

---

## 🏗️ 3. Arquitectura del Código y Estructura de Directorios

```text
student-os/
├── public/                     # Favicons y SVGs públicos
├── src/
│   ├── assets/                 # SVGs y recursos gráficos
│   ├── components/
│   │   ├── calendar/
│   │   │   └── WeeklyCalendar.tsx      # Horario semanal Lunes a Domingo por bloques de tiempo
│   │   ├── dashboard/
│   │   │   └── OverviewBento.tsx       # Tablero Bento con vista unificada de prioridades de hoy
│   │   ├── gym/
│   │   │   └── GymTracker.tsx          # Tracker de rutinas, series interactivas y pesos
│   │   ├── kanban/
│   │   │   └── KanbanBoard.tsx         # Tablero ágil con inserción inline y filtros por categoría
│   │   ├── layout/
│   │   │   ├── Navbar.tsx              # Barra de navegación fija con tabs, dark mode y acciones
│   │   │   └── StatsHero.tsx           # Hero con saludo, semana actual, racha y métricas clave
│   │   ├── quick-add/
│   │   │   └── QuickAddModal.tsx       # Modal global de captura rápida multidisciplinaria
│   │   └── university/
│   │       └── UniversityView.tsx      # Gestión de entregas por semanas (1 a 16) con semáforos
│   ├── data/
│   │   └── initialData.ts              # Dataset inicial realista (Mateo, Ing. Software, Semana 5)
│   ├── hooks/
│   │   └── useLocalStorage.ts          # Hook personalizado de sincronización con localStorage
│   ├── types/
│   │   └── index.ts                    # Definición de interfaces TypeScript y tipos de dominio
│   ├── utils/
│   │   └── confetti.ts                 # Funciones helper para micro y macro celebraciones
│   ├── App.tsx                         # Orquestador principal de estado y enrutamiento por tabs
│   ├── index.css                       # Variables CSS base, scrollbars y animaciones clave
│   └── main.tsx                        # Punto de entrada de montaje React en #root
├── package.json                        # Scripts y dependencias
├── tsconfig.json                       # Configuración de TypeScript
└── vite.config.ts                      # Configuración de Vite con plugin de React y Tailwind
```

---

## 📊 4. Modelo de Datos (`src/types/index.ts`)

### Tipos Principales
- **`DayOfWeek`**: `'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'`
- **`Category`**: `'universidad' | 'trabajo' | 'gym' | 'personal'`
- **`Priority`**: `'baja' | 'media' | 'alta'`
- **`KanbanStatus`**: `'todo' | 'in_progress' | 'done'`
- **`AssignmentStatus`**: `'pendiente' | 'en_progreso' | 'entregado'`
- **`AssignmentType`**: `'tarea' | 'proyecto' | 'examen' | 'laboratorio'`

### Interfaces de Entidades
1. **`KanbanItem`**: Representa tareas ágiles con título, descripción opcional, categoría, prioridad y fecha límite.
2. **`GymExercise`**: Ejercicio con número de series (`sets`), rango de repeticiones (`reps`), peso en kilogramos (`weightKg`), arreglo booleano de series completadas (`completedSets: boolean[]`) y notas.
3. **`GymRoutine`**: Agrupación diaria por `DayOfWeek`, nombre de rutina (e.g. *Push*, *Pull*, *Legs*), etiqueta y lista de `GymExercise`.
4. **`CalendarBlock`**: Bloque horario semanal con hora inicio/fin (`HH:mm`), título, categoría y ubicación.
5. **`UniversityAssignment`**: Entrega académica vinculada a una asignatura (`course`), número de semana (`week: 1..16`), fecha de entrega (`dueDate`), porcentaje de ponderación (`weightPercentage`), estado y notas.
6. **`AppState`**: Estado raíz persistido:
   ```typescript
   {
     studentName: string;
     career: string;
     currentAcademicWeek: number;
     streak: number;
     theme: 'dark' | 'light';
     kanbanItems: KanbanItem[];
     gymRoutines: GymRoutine[];
     calendarBlocks: CalendarBlock[];
     universityAssignments: UniversityAssignment[];
   }
   ```
   - Clave de almacenamiento: `'student_os_state_v1'`.

---

## 🧩 5. Módulos y Funcionalidades Detalladas

### 1. Hero & Métricas (`StatsHero.tsx`)
- Saluda al usuario (`¡Hola, Mateo! 🚀`).
- Indica la semana académica en curso (ej. **Semana 5**) y avisa el total de tareas urgentes que vencen en ella.
- **Acciones rápidas:** Botones directos `+ Tarea Uni`, `+ Ejercicio Gym`, `+ Trabajo Kanban`.
- **Métricas visuales:**
  - **Racha Diaria (🔥):** Contador con animación de pulso ardiente (`flame-pulse`).
  - **Gym Hoy:** Indicador dinámico de series completadas vs total del día actual.
  - **Entregas Uni:** Porcentaje y ratio de avance de entregas académicas completadas.

### 2. Resumen General (`OverviewBento.tsx`)
- Detecta automáticamente el día de la semana (`new Date().getDay()`).
- Widget de entregas prioritarias con botón de entrega inmediata y disparador de confeti.
- Widget de rutina de entrenamiento del día con chips de series marcables directamente desde el dashboard.
- Widget de bloques del horario de clases para el día de hoy.
- Widget de tareas Kanban actualmente en progreso con atajo para avanzar de estado.

### 3. Tablero Kanban (`KanbanBoard.tsx`)
- Columnas: **Por Hacer**, **En Progreso** y **Completado**.
- Inserción instantánea: un input integrado en el encabezado de cada columna permite escribir el título y añadir la tarea al pulsar `Enter`.
- Filtro por categoría mediante chips visuales con iconos vectoriales.
- Botones de transición de etapa con 1 clic (avanzar/retroceder) y eliminación.

### 4. Módulo Académico por Semanas (`UniversityView.tsx`)
- Navegación y agrupación de la **Semana 1 a la 16**.
- Destacado automático de semanas clave:
  - **Semana 8:** Exámenes Parciales.
  - **Semana 16:** Exámenes Finales.
- Semáforo de cuenta regresiva: *"¡Vence Hoy!"*, *"En X días"*, *"Vencida"*, *"Entregada"*.
- Filtros por curso y estado de entrega.
- Input rápido por semana para añadir entregas en segundos.

### 5. Tracker de Gimnasio (`GymTracker.tsx`)
- Selector de días (Lunes a Domingo) con preselección del día actual.
- Rutinas predefinidas: Push, Pull, Legs, Recuperación y Torso Power.
- **Series Interactivas:** Cada ejercicio tiene botones redondos por serie (`S1`, `S2`, `S3`, `S4`) que alternan su estado con un toque.
- Formulario rápido para añadir nuevos ejercicios con peso y repeticiones.
- Botón **"Finalizar Rutina del Día"**: dispara una macro-celebración con confeti continuo y suma automáticamente +1 a la racha de constancia.

### 6. Horario Semanal (`WeeklyCalendar.tsx`)
- Columnas para los 7 días de la semana con resaltado del día **HOY**.
- Bloques coloreados por categoría (Universidad en Indigo, Gym en Naranja, Trabajo en Esmeralda, Personal en Slate).
- Creación ágil mediante formulario inline `+ Bloque` en el encabezado de cada columna.

### 7. Modal Global de Captura Rápida (`QuickAddModal.tsx`)
- Accesible en cualquier momento con el botón **"+ Agregar"** del Navbar o desde los accesos rápidos del Hero.
- Pestañas conmutables entre Universidad, Gym, Kanban y Calendario.
- Chips de cursos habituales (*Ingeniería de Software*, *Bases de Datos*, *IA*, *Sistemas Operativos*) para evitar escribir el nombre completo.
- Control total por teclado (`Escape` para cerrar, `Enter` para guardar).

---

## 🎨 6. Principios de Diseño y UI/UX (Basados en UI/UX Pro Max)

- **Estilo Visual:** Dark Obsidian Bento Grid (`#0b0f19` y `#111827`) con tema claro complementario (`#f8fafc`).
- **Paleta de Acentos:**
  - Indigo / Violeta (`#6366f1`): Tareas académicas e identidad de marca.
  - Sunset Orange (`#f97316`): Gimnasio, fuerza y racha.
  - Emerald (`#10b981`): Estados completados y trabajo.
  - Sky Cyan (`#0ea5e9`): Métricas de tiempo y progreso.
- **Tipografía:** Sistema de fuentes limpia y legible (`system-ui`, `Segoe UI`, `Plus Jakarta Sans`).
- **Ergonomía Táctil:** Altura mínima de interacción de botones entre 36px y 44px (`min-h-[44px]` en botones principales) aptos para pantallas táctiles y móviles.
- **Iconografía Exclusiva:** 100% iconos vectoriales de Lucide React, sin emojis en controles interactivos.
- **Micro-feedback:** Recompensas visuales instantáneas con confeti de partículas al completar tareas y entrenamientos.

---

## 🚀 7. Roadmap y Oportunidades de Evolución

1. **Calculadora de Promedio Académico Ponderado:**
   - Permitir registrar la nota obtenida (ej. 18/20) y calcular automáticamente el promedio acumulado del semestre según el peso porcentual de cada entrega.
2. **Temporizador de Descanso para Gym (Rest Timer):**
   - Cronómetro de descanso (ej. 60s, 90s, 120s) al completar una serie.
3. **Backup y Restauración:**
   - Botón para exportar e importar los datos en formato `.json` para sincronizar entre computadora y laptop.
4. **Modo PWA / Offline Installable:**
   - Añadir `manifest.json` y Service Worker para instalar como aplicación de escritorio nativa en Windows.
