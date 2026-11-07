# INSTRUCCIONES PARA AGENTE 1 (WT1): Shell, Navegación, Captura Rápida & Dashboard

> **Rama asignada:** `feat/wt1-shell-dashboard`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt1-shell`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/components/layout/Navbar.tsx`  
> - `src/components/layout/StatsHero.tsx`  
> - `src/components/quick-add/QuickAddModal.tsx`  
> - `src/components/dashboard/OverviewBento.tsx`  
> - `src/components/dashboard/DailyHabitsCard.tsx`  
> - `src/components/dashboard/BackupModal.tsx`  
>
> **PROHIBIDO modificar:** `src/App.tsx`, `src/index.css`, `index.html`, `src/types/index.ts`, `src/components/common/**` o cualquier otra carpeta fuera de tu alcance.

---

## 1. Contexto Obligatorio Antes de Empezar
Lee estos archivos antes de escribir una sola línea:
1. `PLAN.md` y `memories.md` (reglas Zero-Conflict y estándar de commits `github-workflow-standards`).
2. `src/index.css` (contiene toda la paleta `blue-black-cornflower` / `white-link-blue`, tokens CSS y clases `.t-card`, `.t-card-lift`, `.t-row`, `.t-btn`, `.t-btn-primary`, `.t-btn-secondary`, `.t-btn-ghost`, `.t-btn-icon`, `.t-input`, `.t-label`, `.t-badge`, `.t-num`, `.hero-enter`).
3. `src/components/common/ModalShell.tsx`, `SegmentedControl.tsx` y `SectionHeader.tsx` (primitivas listas para importar).

---

## 2. Reglas de Diseño (`design-taste-frontend` + UX Juvenil)
- **Cero `indigo-*`, `violet-*`, `purple-*`:** Sustitúyelos por las variables del sistema (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--muted)`, `var(--action)`, `var(--line)`).
- **Cero `<Sparkles />`, cero esferas `blur-3xl`, cero `animate-pulse` decorativos.**
- **Cero texto menor a `13px` (`text-[13px]` mínimo) y cero `uppercase tracking-wider` o `font-black`:** Usa *sentence case* natural, pesos `font-normal` (`400`) y `font-medium` (`500` / `600`), y `.t-num` para cualquier número o métrica.
- **Máximo 2 niveles de cajas:** Dentro de `.t-card`, usa divisores `.t-row` en lugar de meter sub-tarjetas grises redondeadas dentro de la tarjeta.
- **Modo Claro y Modo Oscuro impecables** en todos tus componentes (incluyendo `StatsHero`).

---

## 3. Tareas Específicas por Archivo

### A. `src/components/layout/Navbar.tsx`
- Cabecera fija superior limpia (`sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--line)]`, altura `h-14 sm:h-[72px]`), sin sombras pesadas ni gradientes.
- Marca a la izquierda: logo `/logo.png` en marco limpio `rounded-[10px] border border-[var(--line)]` + nombre `StudentOS` limpio en `var(--ink)` (elimina el chip gritón `PRO MAX` en `9px` y el gradiente violeta). Mantén al lado el botón contextual discreto `Semana {currentAcademicWeek}` (mínimo `38px–44px` en desktop `xl:inline-flex`, usando `.t-badge` limpio).
- Navegación central (`hidden md:flex`): utiliza `<SegmentedControl />` de `../common/SegmentedControl` con las 6 vistas (`Resumen`, `Kanban`, `Universidad`, `Gym`, `Horario`, `Aprendizaje`), mostrando badge discreto si `isFreeWeek` (`Libre`) o `!hasReflectionThisWeek` (`Pendiente`). Así el indicador activo viaja suavemente en `240ms`.
- Acciones a la derecha: un único botón lleno `.t-btn .t-btn-primary` (`<Plus />` + `"Agregar"`), botón de tema `.t-btn .t-btn-secondary .t-btn-icon` (`Sun` / `Moon`) y botón restaurar `.t-btn .t-btn-ghost .t-btn-icon` (`RotateCcw`), todos `>=44x44px`.
- Barra inferior móvil (`md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)] border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)]`): 6 botones táctiles claros (`min-h-[56px]`, etiquetas legibles de `12px–13px` sin encoger a `10px`, indicador superior o color `var(--action)` limpio con transición suave).

### B. `src/components/layout/StatsHero.tsx`
- Extiende la prop opcional `onOpenQuickAddWithTab?: (tab: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning') => void` manteniendo compatibilidad total con `App.tsx`.
- Contenedor `.t-card .hero-enter p-6 sm:p-8 mb-8` con atributo `data-enter` (funciona tanto en Modo Claro como en Modo Oscuro usando `var(--surface)`, `var(--ink)` y `var(--muted)`, eliminando el fondo negro fijo y los círculos `blur-3xl` y el watermark gigante).
- Columna izquierda:
  - Etiqueta limpia `.t-badge .t-badge-accent` con `{state.career} · Semana {state.currentAcademicWeek}` (con `.t-num`).
  - `h1` limpio (`text-2xl sm:text-4xl font-medium tracking-[-0.03em] text-[var(--ink)]`): `{timeGreeting}, {state.studentName}` (sin `<Sparkles />`).
  - Subtítulo claro de 1 línea con el dato duro de entregas pendientes esta semana.
  - Máximo **2 botones** en fila (regla `copy.md` / `system.md`): botón primario `.t-btn .t-btn-primary` `"Agregar entrega"` (`onOpenQuickAddWithTab?.('university')`) y botón secundario `.t-btn .t-btn-secondary` `"Registrar ejercicio"` (`onOpenQuickAddWithTab?.('gym')`).
- Columna derecha: 3 bloques limpios en `bg-[var(--surface-2)] border border-[var(--line)] rounded-[14px] p-4` con cifras grandes `.t-num` (`{state.streak} días`, `{completedSets}/{totalSets}`, `{doneUni}/{totalUni}`) y etiquetas legibles de `13px`.

### C. `src/components/quick-add/QuickAddModal.tsx`
- Refactoriza usando `<ModalShell isOpen={isOpen} onClose={onClose} title="Agregar rápido" subtitle="Guarda tareas, rutinas o apuntes en segundos" maxWidth="lg">` (elimina el wrapper manual y `<Sparkles />`).
- Selector superior de las 5 pestañas (`Uni`, `Gym`, `Kanban`, `Horario`, `Aprender`) usando `<SegmentedControl fullWidth size="sm" ... />` para tener transición deslizante fluida.
- Todos los inputs, selects y textareas deben usar `.t-input` y `.t-label` (etiquetas claras visibles de `14px`, sin asteriscos ruidosos; chips de cursos con `min-h-[38px]` cómodos).
- Botón final de cada formulario con `.t-btn .t-btn-primary w-full` y verbo + objeto claro: `"Guardar entrega"`, `"Guardar ejercicio"`, `"Crear tarea"`, `"Agendar bloque"`, `"Guardar recurso"`.

### D. `src/components/dashboard/OverviewBento.tsx`
- Añade props opcionales `onHabitsChange?: (habits: DailyHabits) => void` y `onRestoreState?: (restored: AppState) => void` en `OverviewBentoProps` para que Fase 2 las conecte en `App.tsx` sin romper la compilación actual.
- Usa `<SectionHeader title="Tu día de hoy" subtitle="Lo importante de hoy en clases, entrenamiento, hábitos y proyectos." actions={...} />` con botón `.t-btn .t-btn-secondary` `"Respaldo JSON"`.
- Aplica la regla **"Two levels, never three"** en las tarjetas Bento (`.t-card p-6`):
  - **Entregas por vencer:** Filas `.t-row` limpias con curso, semana (`.t-num`), fecha y botón `.t-btn .t-btn-secondary .t-btn-icon` (`44x44px`) para marcar entregada. Botón inferior `.t-btn .t-btn-secondary w-full` `"Agregar entrega"` (sin doble `+`).
  - **Entrenamiento de hoy ({todayDay}):** Filas `.t-row` con peso `.t-num` y botones de series `S1..S4` de **mínimo `44x44px`** (`min-w-[44px] min-h-[44px] rounded-[10px] t-num text-[13px] font-medium`) con transición táctil limpia.
  - **Agenda de {todayDay}:** Filas `.t-row` con hora en `.t-num` (`09:00 – 11:00`), título y aula/lugar en `13px`, cero violeta.
  - **Hábitos diarios:** `<DailyHabitsCard initialHabits={state.dailyHabits} onHabitsChange={onHabitsChange} />`.
  - **Proyectos en foco (Kanban):** Lista limpia en 2 columnas sin triple borde, con botón `.t-btn .t-btn-secondary` `"Marcar listo"`.
  - **Aprendizaje de la semana {currentWeek}:** Diseño limpio de 2 columnas sobre `.t-card` (síntesis registrada o invitación directa a escribir con `.t-btn .t-btn-primary` `"Escribir resumen"`, y columna derecha de enlaces YouTube como filas `.t-row` limpias con `YoutubeIcon`).

### E. `src/components/dashboard/DailyHabitsCard.tsx`
- Tarjeta `.t-card p-6` sin `<Sparkles />`.
- Sustituye las 3 sub-cajas de colores pastel/violeta por 3 filas `.t-row` limpias (Agua, Sueño, Bloques de enfoque):
  - Controles táctiles reales (`min-h-[40px] sm:min-h-[44px]`, botones `+250 ml`, `+500 ml`, `- / +` de `44x44px`).
  - Cifras en `.t-num` y barras de progreso limpias de `6px` (`h-1.5 rounded-full bg-[var(--surface-2)]`) usando `var(--action)` para agua/sueño y `var(--ok)` al llegar al 100% (`transition-[width] duration-300`).

### F. `src/components/dashboard/BackupModal.tsx`
- Refactoriza usando `<ModalShell isOpen={isOpen} onClose={onClose} title="Respaldo de tus datos" subtitle="Descarga una copia en tu equipo o restaura un archivo previo" maxWidth="xl">`.
- Añade prop opcional `onRestoreState?: (restored: AppState) => void`. Al confirmar restauración: si existe `onRestoreState`, llámalo, muestra mensaje de éxito y cierra suavemente sin `window.location.reload()`; conserva el fallback actual solo si `onRestoreState` no fue provisto.
- Presenta la vista previa del JSON mediante filas `.t-row` tabulares limpias con `.t-num` en lugar de 6 cajitas grises anidadas.

---

## 4. Verificación y Commit Obligatorio
Ejecuta en `C:\Users\mateo\Documents\proyects\student-os-wt1-shell`:
```powershell
npm run build
npm run lint
```
Cuando ambos terminen con **0 errores**, haz commit únicamente de tus archivos:
```powershell
git add src/components/layout/ src/components/quick-add/ src/components/dashboard/
git commit -m "feat(wt1): redesign navbar, hero, quick-add and overview bento with blue-black-cornflower system"
```
