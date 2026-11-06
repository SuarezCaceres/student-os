# 🎓 StudentOS PRO MAX 🚀
### Life, Gym & College Hub para Universitarios

[![React](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![UI/UX Pro Max](https://img.shields.io/badge/Design_System-UI%2FUX_Pro_Max-6366F1)](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
[![License](https://img.shields.io/badge/License-MIT-emerald)](LICENSE)

> Un centro de control unificado, ágil y moderno diseñado específicamente para que los estudiantes universitarios organicen sus entregas académicas por semanas, proyectos de desarrollo, entrenamientos en el gimnasio y agenda semanal **sin complicaciones ni formularios engorrosos**.

---

## 📌 ¿Por qué StudentOS?

La mayoría de herramientas de productividad tradicionales (como Notion, Jira o Trello) no están optimizadas para la dinámica universitaria real:
- Requieren configurar docenas de propiedades y filtros para anotar un pendiente.
- No tienen noción del calendario académico por semanas (Semana 1..16, parciales y finales).
- Están desconectadas de la rutina de gimnasio y descanso.

**StudentOS PRO MAX** resuelve esto combinando un diseño **Bento Grid** juvenil, captura de datos en 2 clics y persistencia 100% offline.

---

## ✨ Módulos Principales

### ⚡ 1. Resumen General (Bento Dashboard)
- **Hero de Bienvenida Dinámico:** Saludo personalizado, status de la semana actual y contador de **Racha Diaria (🔥)**.
- **Widgets Bento:** Acceso simultáneo a las entregas académicas que vencen esta semana, rutina de gym de hoy y bloques de clase del día.

### 📋 2. Tablero Kanban de Proyectos
- Columnas ágiles: **Por Hacer**, **En Progreso** y **Completado**.
- Filtro por categoría: *Universidad*, *Trabajo / Freelance*, *Gym* y *Personal*.
- **Inserción Inmediata:** Escribe el título directamente en el encabezado de cada columna y presiona `Enter`.
- Botones de avance rápido de etapa y celebración con confeti.

### 🎓 3. Entregas Universitarias por Semanas (1 a 16)
- Estructuración por semanas del semestre académico con foco en la **Semana en Curso**.
- Distintivos automáticos para semanas de **Exámenes Parciales (Semana 8)** y **Finales (Semana 16)**.
- Semáforo de vencimiento: *"¡Vence Hoy!"*, *"En 3 días"*, *"Vencida"*, *"Entregada"*.
- Ponderación de calificaciones (ej. 15% de la nota final) y botón de entrega con 1 clic.

### 🏋️ 4. Gym & Fitness Tracker
- Planificador interactivo de **Lunes a Domingo** (detecta automáticamente el día actual).
- Rutinas preconfiguradas (*Push*, *Pull*, *Legs*, *Torso Power*, etc.).
- **Burbujas de series interactivas (S1, S2, S3, S4):** Marca cada serie con un toque.
- Registro rápido de repeticiones y peso en kilogramos.
- Botón *"Finalizar Rutina del Día"* con confeti que incrementa tu racha de constancia.

### 📅 5. Horario Semanal (Lunes a Domingo)
- Vista completa de 7 columnas organizadas cronológicamente.
- Resaltado visual para el día **HOY**.
- Distinción de colores semánticos por tipo de bloque (*Clases*, *Entrenamiento*, *Trabajo*, *Ocio*).
- Botón rápido `+ Bloque` en cada día.

### ⚡ 6. Captura Rápida (Zero-Friction UX)
- Modal flotante con atajo global accesible con el botón **"+ Agregar"**.
- Pestañas conmutables con valores predeterminados inteligentes y chips de cursos frecuentes.
- Soporte total para teclado (`Escape` para cerrar, `Enter` para enviar).

---

## 🎨 Principios de Diseño UI/UX Pro Max

- **Tipografía:** *Plus Jakarta Sans* moderna, legible y geométrica.
- **Iconografía Vectorial Pura:** Uso exclusivo de **Lucide Icons** (sin emojis como controles o botones de interfaz).
- **Dark Mode & Light Mode:** Paleta Obsidian de alto contraste con acentos vibrantes (*Electric Indigo, Sunset Orange, Sky Cyan y Emerald*).
- **Ergonomía Táctil:** Áreas de interacción con tamaño mínimo de 44x44px, adaptadas tanto para móviles como tablets y monitores.
- **Persistencia Local:** Almacenamiento instantáneo en `localStorage` con opción de restaurar datos de demostración.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- [Node.js](https://nodejs.org/) v18 o superior.
- Administrador de paquetes `npm` (o `pnpm` / `yarn`).

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/SuarezCaceres/student-os.git
   cd student-os
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. Abre en tu navegador `http://localhost:5173`.

### Compilación para Producción
```bash
npm run build
npm run preview
```

---

## 🛠️ Tecnologías

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Empaquetador:** [Vite 8](https://vite.dev/)
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Iconografía:** [Lucide React](https://lucide.dev/)
- **Gamificación:** [canvas-confetti](https://www.npmjs.com/package/canvas-confetti)

---

## 📄 Licencia

Distribuido bajo la Licencia MIT. Consulta `LICENSE` para más información.
