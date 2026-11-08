# INSTRUCCIONES PARA AGENTE 3 (WT3): Tablero Kanban & Horario Semanal

> **Rama asignada:** `feat/wt3-kanban-calendar`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt3-planning`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/components/kanban/KanbanBoard.tsx`  
> - `src/components/kanban/KanbanCard.tsx`  
> - `src/components/calendar/WeeklyCalendar.tsx`  
> - `src/components/calendar/CalendarTimelineGrid.tsx`  
>
> **PROHIBIDO modificar:** `src/App.tsx`, `src/index.css`, `index.html`, `src/types/index.ts`, `src/components/common/**` o cualquier otra carpeta fuera de tu alcance.

---

## 1. Contexto Obligatorio Antes de Empezar
Lee estos archivos antes de programar:
1. `PLAN.md` y `memories.md` (reglas Zero-Conflict y estándar `github-workflow-standards`).
2. `src/index.css` (paleta `blue-black-cornflower` / `white-link-blue`, clases `.t-card`, `.t-card-lift`, `.t-row`, `.t-btn`, `.t-btn-primary`, `.t-btn-secondary`, `.t-btn-ghost`, `.t-btn-icon`, `.t-input`, `.t-label`, `.t-badge`, `.t-num`, `.m-check`).
3. `src/components/common/SegmentedControl.tsx` y `SectionHeader.tsx` (y `ModalShell.tsx` si deseas usar un diálogo limpio para agregar bloque horario).

---

## 2. Reglas de Diseño (`design-taste-frontend` + UX Juvenil)
- **Cero `indigo-*`, `violet-*`, `purple-*`:** Reemplaza cualquier color índigo/violeta/púrpura (por ejemplo en la columna *En Progreso* o la categoría *Personal*) por tokens limpios del sistema (`var(--action)` para universidad/en progreso, `var(--ok)` para trabajo/completado, `var(--gym)` para gym, `var(--warn)` o neutro `var(--ink)` para personal).
- **Cero `<Sparkles />`:** Para la categoría *Personal*, usa un icono claro de Lucide como `User` o `Bookmark` en lugar de `Sparkles`.
- **Cero texto menor a `13px` (`text-[13px]` mínimo) y cero `uppercase tracking-wider` o `font-black`:** Usa *sentence case* natural (`Alta`, `Media`, `Baja`), pesos `400 / 500 / 600` y `.t-num` para contadores, fechas y horarios `07:00–22:00`.
- **Máximo 2 niveles de cajas** y controles táctiles `>=44x44px` visibles también en móvil (no dependas solo de `opacity-0 group-hover:opacity-100` que en pantallas táctiles hace invisibles los botones).

---

## 3. Tareas Específicas por Archivo

### A. `src/components/kanban/KanbanBoard.tsx`
- Mantén intacta `KanbanBoardProps` (incluyendo `onUpdateItem?: (item: KanbanItem) => void`).
- Cabecera con `<SectionHeader title="Tablero de proyectos" subtitle="Mueve tus pendientes de la universidad, trabajo o proyectos personales sin complicarte." />`.
- Barra de herramientas limpia y alineada:
  - Buscador con icono `Search` e input `.t-input pl-10` (`min-h-[44px]`, placeholder `"Buscar por título, nota o etiqueta..."`).
  - Filtro de categoría usando `<SegmentedControl />` (`Todas`, `Uni`, `Trabajo`, `Gym`, `Personal`).
  - Selector de prioridad limpio con `.t-input w-auto min-h-[44px]` o píldoras táctiles.
- En móvil (`<768px`), añade un `<SegmentedControl fullWidth />` opcional o selector rápido de columna (`Por hacer · En progreso · Listo`) O apila limpiamente las 3 columnas con buen aire, de modo que nunca haya scroll horizontal roto a `390px`.
- Las 3 columnas (`Por hacer`, `En progreso`, `Completado`):
  - Contenedor limpio `rounded-[20px] bg-[var(--surface-2)]/60 border border-[var(--line)] p-4 transition-colors duration-150`, cambiando suavemente el borde a `border-[var(--action)] bg-[color-mix(in_oklab,var(--action)_6%,var(--surface-2))]` cuando `dragOverCol === col.id`.
  - Cabecera de columna con punto de estado sutil, nombre en `15px font-medium`, contador en `.t-badge .t-num` e input rápido `.t-input` (`min-h-[44px]`, `"Escribe una tarea y pulsa Enter..."`).

### B. `src/components/kanban/KanbanCard.tsx`
- Contenedor `.t-card .t-card-lift p-4 cursor-grab active:cursor-grabbing` con feedback suave al arrastrar (`isDragging ? 'opacity-50 scale-[0.985] border-[var(--action)]' : ''`).
- Fila superior con `GripVertical`, insignia de categoría y prioridad (`.t-badge` en `13px`, sentence case) y botón eliminar `.t-btn .t-btn-ghost .t-btn-icon` (`min-w-[38px] min-h-[38px] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100` — siempre accesible en móvil, discreto en desktop).
- Título en `15px font-medium text-[var(--ink)]`, descripción breve en `14px text-[var(--muted)]` y etiquetas `#tag` en `13px`.
- **Subtareas sin caja anidada:** Al desplegar subtareas, muéstralas con borde superior limpio `border-t border-[var(--line)] pt-3 mt-3 space-y-2` usando `<input type="checkbox" className="m-check" />` dentro de un `<label>` cómodo, barra de progreso fina (`h-1.5` con `var(--action)` / `var(--ok)`) e input limpio para sumar subtareas.
- Pie de tarjeta con fecha en `.t-num text-[13px] text-[var(--muted)]` y botones táctiles claros (`min-h-[38px] px-3 rounded-[10px]`) para retroceder o avanzar etapa (`"Empezar"` / `"Terminar"`).

### C. `src/components/calendar/WeeklyCalendar.tsx`
- Cabecera con `<SectionHeader title="Horario de la semana" subtitle="Tus clases, entrenamientos y bloques de estudio de lunes a domingo." actions={...} />`.
- En `actions`:
  - `<SegmentedControl />` para alternar suavemente entre `'grid'` (`"Grilla horaria"`) y `'columns'` (`"Vista por días"`).
  - Botón `.t-btn .t-btn-secondary` `"Exportar .ics"` (`Download`).
  - Botón `.t-btn .t-btn-primary` `"Agendar bloque"` (`Plus`, sin repetir el símbolo `+` en el texto).
- Usa `<ModalShell />` para el diálogo de `"Agendar bloque"` con `.t-label` + `.t-input` (`48px`), permitiendo elegir día, hora inicio, hora fin, título, ubicación opcional y categoría.
- En la vista `'columns'` (lista por días), usa tarjetas `.t-card p-4` con encabezado claro (destacando *Hoy* con `.t-badge .t-badge-accent`), filas `.t-row` con horario en `.t-num` y botón `+ Agregar en {day}` de `44px`.

### D. `src/components/calendar/CalendarTimelineGrid.tsx`
- Extiende opcionalmente `CalendarTimelineGridProps` si deseas recibir un filtro de día móvil, o incluye arriba de la grilla un **selector de día móvil (`md:hidden`)** con los 7 días (`Lun..Dom`, preseleccionado en `todayDay`) para que en pantallas de `390px` se muestre la línea de tiempo completa y súper legible de 1 día a la vez sin obligar a hacer scroll lateral sobre `900px`, mientras que en `md+` (`>=768px`) se muestra la semana completa de 7 columnas.
- Columna de horas `07:00` a `22:00` en `.t-num text-[13px] text-[var(--muted)]`.
- Línea de hora actual limpia en `var(--action)` o `var(--danger)` sin `animate-pulse` distractor.
- Bloques posicionados con tipografía clara (`>=13px`), cero púrpura/violeta, botón eliminar accesible y aviso nítido cuando dos bloques se cruzan en horario (`hasConflict`).

---

## 4. Verificación y Commit Obligatorio
Ejecuta en `C:\Users\mateo\Documents\proyects\student-os-wt3-planning`:
```powershell
npm run build
npm run lint
```
Cuando ambos pasen con **0 errores**, confirma únicamente tus archivos:
```powershell
git add src/components/kanban/ src/components/calendar/
git commit -m "feat(wt3): redesign kanban board and weekly calendar with smooth controls and mobile day timeline"
```
