# INSTRUCCIONES PARA AGENTE 2 (WT2): Universidad, Promedio GPA, Rúbricas & Aprendizaje

> **Rama asignada:** `feat/wt2-academic-learning`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt2-academic`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/components/university/UniversityView.tsx`  
> - `src/components/university/GradesCalculatorModal.tsx`  
> - `src/components/university/AssignmentDetailModal.tsx`  
> - `src/components/learning/LearningView.tsx`  
> - `src/components/learning/FreeWeekCelebrationCard.tsx`  
>
> **PROHIBIDO modificar:** `src/App.tsx`, `src/index.css`, `index.html`, `src/types/index.ts`, `src/components/common/**` o cualquier otra carpeta fuera de tu alcance.

---

## 1. Contexto Obligatorio Antes de Empezar
Lee estos archivos antes de escribir código:
1. `PLAN.md` y `memories.md` (reglas Zero-Conflict y estándar `github-workflow-standards`).
2. `src/index.css` (sistema `blue-black-cornflower` / `white-link-blue`, clases `.t-card`, `.t-card-lift`, `.t-row`, `.t-btn`, `.t-btn-primary`, `.t-btn-secondary`, `.t-btn-ghost`, `.t-btn-icon`, `.t-input`, `.t-label`, `.t-badge`, `.t-num`, `.m-check`).
3. `src/components/common/ModalShell.tsx`, `SegmentedControl.tsx` y `SectionHeader.tsx`.

---

## 2. Reglas de Diseño (`design-taste-frontend` + UX Juvenil)
- **Cero `indigo-*`, `violet-*`, `purple-*`:** Usa estrictamente los tokens semánticos (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--muted)`, `var(--action)`, `var(--line)`, `var(--ok)`, `var(--warn)`, `var(--danger)`).
- **Cero `<Sparkles />`, cero orbes `blur-3xl`, cero exceso de emojis en encabezados.**
- **Cero texto menor a `13px` (`text-[13px]` mínimo) y cero `uppercase tracking-wider` o `font-black`:** Usa *sentence case* natural, pesos `400 / 500 / 600`, y `.t-num` para semanas, notas `0–20`, porcentajes y fechas.
- **Máximo 2 niveles de cajas:** Dentro de `.t-card` o modales, usa divisores `.t-row` limpios en vez de anidar cajas grises dentro de cajas.
- **Controles táctiles `>=44x44px`** y compatibilidad impecable con **Modo Oscuro y Modo Claro**.

---

## 3. Tareas Específicas por Archivo

### A. `src/components/university/UniversityView.tsx`
- Mantén intacta `UniversityViewProps` (incluyendo `onUpdateAssignment?: (assignment: UniversityAssignment) => void`).
- Cabecera con `<SectionHeader title="Entregas de la universidad" badge={<span className="t-badge t-badge-accent t-num">Semana {currentWeek}</span>} subtitle="Tus tareas, laboratorios y exámenes organizados semana a semana." actions={...} />`.
- En `actions`: botón `.t-btn .t-btn-primary` `"Calcular promedio"` (`Calculator`) y `<SegmentedControl />` para cambiar entre:
  - `'upcoming'` (**predeterminado inicial** para no abrumar al joven con semanas pasadas o vacías: *"Desde esta semana"*),
  - `'current'` (*"Solo semana {currentWeek}"*),
  - `'all'` (*"Ciclo 1–16"*).
- Además, en el modo `'upcoming'`, muestra únicamente las semanas que tienen entregas registradas **o** la semana actual `currentWeek` (y en `'all'` permite ver las 16 semanas con opción rápida de agregar en cualquiera), evitando una pared interminable de cajas vacías.
- Filtros de curso y estado con `.t-input` (`min-h-[44px] w-auto`).
- Cada bloque semanal es una `.t-card p-5 sm:p-6`:
  - Encabezado limpio con `Semana {w}` (`.t-num`), insignia sobria si es `Semana 8 · Parciales` o `Semana 16 · Finales` (`.t-badge .t-badge-warn`), e input inline `.t-input` + botón `.t-btn .t-btn-secondary` `"Agregar"` para crear una entrega con `Enter`.
  - Lista de entregas como filas limpias `.t-row` (en vez de sub-cajas pesadas): checkbox/botón de entrega de `44x44px`, título clicable para abrir detalles/rúbrica, curso, ponderación (`15%` en `.t-num`), estado de vencimiento claro (*"Vence hoy"*, *"En 3 días"*, *"Entregada"*) con `.t-badge`, nota obtenida (`18 / 20` en `.t-num`) y botón de detalle/eliminar accesible en móvil (`min-w-[44px] min-h-[44px]`).

### B. `src/components/university/GradesCalculatorModal.tsx`
- Refactoriza con `<ModalShell isOpen={isOpen} onClose={onClose} title="Calculadora de promedio" subtitle="Simula tus notas en escala de 0 a 20 y descubre cuánto necesitas para aprobar tranquilo" maxWidth="4xl" footer={...}>`.
- Resumen superior limpio en 2 bloques planos (`bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)]`): Promedio acumulado actual en grande con `.t-num` + estado (`.t-badge-ok` / `.t-badge-warn` / `.t-badge-danger`), e input `.t-input` para tu **Meta de promedio** (`11` a `20`).
- Desglose por curso: cada materia es una `.t-card p-5` con mensaje predictivo claro y amigable (*"Necesitas sacar al menos 14.5 / 20 en el 40% restante para llegar a tu meta de 15"*) y filas `.t-row` con inputs numéricos `.t-input t-num w-24 text-center` de `44px–48px` de altura.
- Footer con `.t-btn .t-btn-secondary` `"Cancelar"` y `.t-btn .t-btn-primary` `"Guardar notas"`.

### C. `src/components/university/AssignmentDetailModal.tsx`
- Refactoriza con `<ModalShell isOpen={isOpen} onClose={onClose} badge={course + ' · Semana ' + week} title="Detalle y rúbrica de entrega" maxWidth="2xl" footer={...}>`.
- Formulario limpio con `.t-label` + `.t-input` (título, vencimiento, estado, peso `%`, nota `0–20` en `.t-num`, enlace de entrega Drive/GitHub/Campus con botón limpio `"Abrir enlace"`).
- Sección de **Criterios de rúbrica**: barra de progreso limpia (`h-1.5 rounded-full bg-[var(--surface-2)]` con relleno `var(--ok)`), lista de criterios usando filas `.t-row` con `<input type="checkbox" className="m-check" />` envuelto en `<label>` táctil (`min-h-[44px]`), botón eliminar de `44x44px` e input `.t-input` + `.t-btn .t-btn-secondary` `"Añadir criterio"`.

### D. `src/components/learning/LearningView.tsx`
- Cabecera con `<SectionHeader title="Lo que aprendiste esta semana" subtitle="Explica con tus palabras lo más importante, guarda tus videos de estudio y cierra la semana." actions={...} />` con botón `.t-btn .t-btn-primary` `"Guardar semana {selectedWeek}"`.
- Selector horizontal limpio de semanas `1..16`: píldoras táctiles (`min-h-[42px] px-3.5 rounded-[10px] t-num text-[14px]`) donde la semana seleccionada destaca con `bg-[var(--action)] text-[var(--action-ink)]` y las semanas con apuntes muestran un punto discreto.
- Si `isFreeWeek` es verdadero, muestra `<FreeWeekCelebrationCard />`.
- Grilla principal de 2 columnas limpias (`.t-card p-6`):
  - **Izquierda (Resumen con tus palabras / Active Recall):** Textarea amplia `.t-input min-h-[160px]` con pregunta cercana, selector de ánimo semanal con 4 botones claros (`min-h-[44px]`, sin `indigo`/`violet`), y etiquetas `#concepto` como `.t-badge` legibles (`13px`) con botón de quitar cómodo.
  - **Derecha (Videos de YouTube, lecturas y balance físico):** Lista de fuentes en filas `.t-row` limpias (conservando `<YoutubeIcon />` en su color rojo real oficial según la regla de logos reales de `design-taste-frontend`), formulario desplegable limpio con `.t-input`, y bloque inferior para notas de progreso físico de la semana.

### E. `src/components/learning/FreeWeekCelebrationCard.tsx`
- Rediseña sobre `.t-card p-6 sm:p-7` adaptable a **Modo Claro y Modo Oscuro** (elimina `from-emerald-950/70`, los círculos `blur-3xl`, `<Sparkles />` y los emojis en el `h3`).
- Insignia `.t-badge .t-badge-ok` (`Semana {week} al día`), título limpio `"Semana libre de entregas"`, texto cercano invitando a descansar, entrenar o avanzar proyectos propios, y 2 botones limpios (`.t-btn .t-btn-primary` `"Ir a entrenar"` y `.t-btn .t-btn-secondary` `"Ver proyectos Kanban"`).

---

## 4. Verificación y Commit Obligatorio
Ejecuta en `C:\Users\mateo\Documents\proyects\student-os-wt2-academic`:
```powershell
npm run build
npm run lint
```
Cuando ambos pasen con **0 errores**, confirma únicamente tus archivos:
```powershell
git add src/components/university/ src/components/learning/
git commit -m "feat(wt2): redesign university views, gpa modal, rubrics and learning hub with clean taste system"
```
