# INSTRUCCIONES PARA AGENTE 1 (TERMINAL 1) — ACCESIBILIDAD GLOBAL, SHELL Y OPTIMIZACIÓN CORE

> **Rol:** Agente 1 (Terminal Principal)  
> **Rama de trabajo:** `feat/audit-a11y-core-opt`  
> **Directorio asignado (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt1-core`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/index.css`  
> - `src/components/common/ModalShell.tsx`  
> - `src/components/common/SectionHeader.tsx`  
> - `src/components/layout/Navbar.tsx`  
> - `src/components/kanban/KanbanCard.tsx`  
> - `src/App.tsx`  
>
> **PROHIBIDO MODIFICAR:** Toda la carpeta `src/components/landing/**`, `src/components/auth/**` o archivos de datos.

---

## 1. Contexto Obligatorio Antes de Comenzar
Lee detenidamente:
1. `PRODUCT.md` y `DESIGN.md` en la raíz del proyecto.
2. `memories.md` para respetar las directrices arquitectónicas.
3. Estándar de commits obligatorio (`github-workflow-standards`): commits semánticos en imperativo (ej. `feat(a11y): ...`, `perf(app): ...`).

---

## 2. Tareas Detalladas por Archivo

### A. `src/index.css` — Reducción de Movimiento y Accesibilidad
1. Agregar la consulta de medios oficial:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
     .view-enter, .hero-enter, .modal-backdrop-enter, .modal-panel-enter {
       animation: none !important;
       opacity: 1 !important;
       transform: none !important;
     }
   }
   ```
2. Asegurar que los contrastes de los tokens `--ok`, `--warn`, `--gym` alcancen al menos 4.5:1 cuando se utilicen como color de texto sobre superficies claras.

### B. `src/components/common/ModalShell.tsx` — Focus Trap Accesible
1. Implementar trampa de foco (Focus Trap) cuando el modal esté abierto (`isOpen === true`).
2. Atrapar el tabulado (`Tab` y `Shift+Tab`) para que permanezca en los elementos enfocables del modal (`button`, `input`, `select`, `textarea`, `a[href]`).
3. Al montarse/abrirse, enfocar automáticamente el primer elemento interactivo o el botón de cerrar (`X`).
4. Al cerrarse, devolver el foco al elemento disparador previo que tenía el foco activo (`document.activeElement`).

### C. `src/components/common/SectionHeader.tsx` — Jerarquía Semántica
1. Extender `SectionHeaderProps` con la propiedad opcional `as?: 'h1' | 'h2' | 'h3'`. Por defecto `'h2'`.
2. Renderizar dinámicamente el tag correspondiente (`const Tag = as; <Tag className="...">`).
3. Reemplazar la clase arbitraria `sm:text-[28px]` por la rampa oficial de `DESIGN.md` (`text-2xl sm:text-3xl font-medium tracking-[-0.03em]`).

### D. `src/components/layout/Navbar.tsx` — Objetivos Táctiles y Tipografía
1. En el botón de cerrar sesión (línea 220 aprox.), remover la sobreescritura `!h-8 !w-8` para cumplir con el tamaño táctil mínimo de 44x44px.
2. Reemplazar `text-[17px]` en el nombre de marca por `text-lg` (18px) o la clase de texto equivalente alineada a la rampa de `DESIGN.md`.

### E. `src/components/kanban/KanbanCard.tsx` — Erradicación de Estilos Arbitrarios
1. En los botones de eliminar tarea, mover etapa y borrar subtareas (líneas 107, 220, 274 aprox.):
   - Reemplazar `style={{ minWidth: '38px', minHeight: '38px' }}` por el área táctil mínima de 44x44px (`.t-btn-icon`).
   - Reemplazar `borderRadius: '10px'` por el token oficial del sistema `var(--r-md)` (12px).

### F. `src/App.tsx` — Optimización de Renders con `useCallback` y `useMemo`
1. Envolver todos los handlers despachadores (`handleToggleGymSet`, `handleAddAssignment`, `handleUpdateAssignment`, `handleDeleteAssignment`, `handleAddGymExercise`, `handleUpdateKanbanItem`, etc.) en `useCallback` con sus dependencias correspondientes.
2. En las vistas activas (`UniversityView`, `GymTracker`, `WeeklyCalendar`, `KanbanBoard`, `LearningView`), verificar que los títulos utilicen el `SectionHeader` configurado con `as="h1"` para que cada vista tenga un `<h1>` semántico.

---

## 3. Verificación Obligatoria
Ejecutar en la terminal del worktree:
```bash
npm run build
npx oxlint
& "C:\Users\mateo\.agents\skills\impeccable\scripts\impeccable.cmd" detect src/index.css src/components/common/ src/components/layout/Navbar.tsx src/components/kanban/KanbanCard.tsx
```

---

## 4. Estándar de Commit
Crear commits atómicos siguiendo Conventional Commits:
- `feat(a11y): add prefers-reduced-motion query and modal focus trap`
- `fix(layout): normalize touch targets and heading hierarchy in section headers`
- `perf(app): memoize root state callbacks with useCallback`
