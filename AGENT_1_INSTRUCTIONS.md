# 🎓 INSTRUCCIONES PARA AGENTE 1: Especialista Académico & Kanban

> **Rama asignada:** `feat/agent-1-university-kanban`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-agent-1`  
> **Alcance exclusivo de archivos:**  
> - `src/components/university/**`  
> - `src/components/kanban/**`  
> *(No modificar `App.tsx` para evitar colisiones con el Agente 2).*

---

## 📖 Contexto Previo Obligatorio
Antes de iniciar, lee detenidamente:
1. `memories.md`: Para entender el propósito de StudentOS PRO MAX, la identidad del usuario (Mateo) y los principios de UI/UX Pro Max (paleta Obsidian `#0b0f19`, 100% Lucide Icons, áreas táctiles mínimo 44x44px).
2. `src/types/index.ts`: Ya contiene los tipos ampliados (`RubricCriterion`, `KanbanChecklistItem`, etc.).

---

## 🎯 Tareas a Desarrollar

### MÓDULO A: Universidad (`src/components/university/`)
1. **Calculadora de Promedio Ponderado Semestral (GPA):**
   - Crear `GradesCalculatorModal.tsx`.
   - Permitir registrar notas obtenidas en escala vigesimal (0 a 20) y calcular el promedio ponderado semestral acumulado en base al `weightPercentage` de cada entrega.
   - Mostrar estado de aprobación (ej. Verde si >= 14, Ámbar si < 14) y alerta predictiva de nota mínima requerida en pendientes.
2. **Modal de Detalle de Entrega con Rúbrica & Links:**
   - Crear `AssignmentDetailModal.tsx`.
   - Incluir checklist interactivo de criterios de rúbrica (`rubricCriteria`).
   - Campo para ingresar y abrir la URL de entrega (Google Drive, GitHub repo, Campus).
3. **Actualizar `UniversityView.tsx`:**
   - Añadir botón en cabecera para abrir la Calculadora de Promedio.
   - Mostrar chip de nota obtenida en tarjetas de entregas completadas.
   - Conectar los nuevos modales.

### MÓDULO B: Tablero Kanban (`src/components/kanban/`)
1. **Drag & Drop Nativo (HTML5):**
   - Permitir arrastrar tarjetas entre las columnas *Por Hacer*, *En Progreso* y *Completado*.
   - Disparar confeti al soltar una tarjeta en la columna *Completado*.
2. **Subtareas & Checklist en Tarjetas:**
   - Permitir que cada tarjeta kanban tenga subtareas con checkbox (`checklist`).
   - Mostrar barra de progreso y ratio visual `X/Y` de subtareas cumplidas.
3. **Buscador & Filtros en `KanbanBoard.tsx`:**
   - Barra de búsqueda de texto en tiempo real por título y descripción.
   - Filtros de prioridad coloreados y visualización de tags.

---

## 🧪 Verificación Final
Al terminar, ejecuta en tu terminal:
```powershell
npm run build
```
Asegúrate de que no haya ningún error de TypeScript y confirma tus cambios con:
```powershell
git add src/components/university/ src/components/kanban/
git commit -m "feat(agent-1): add gpa calculator, assignment rubrics, kanban dnd and checklists"
```
