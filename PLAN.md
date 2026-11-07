# Plan Maestro UI/UX (`design-taste-frontend`) & Arquitectura Multi-Agente por Worktrees

> **Estándar visual activo:** `design-taste-frontend` (`tasteskill 2.5.1`)  
> **Kind:** `software` | **Paleta:** `blue-black-cornflower` (Dark `#0a0d14` / `#5ab9fc`) + `white-link-blue` (Light `#f7f8fa` / `#1a4be0`)  
> **Tipografía:** `Schibsted Grotesk` (`400 / 500 / 600`) + `JetBrains Mono` (`tabular-nums`)  
> **Estándar Git obligatorio:** `github-workflow-standards` + lectura previa de [memories.md](memories.md)

---

## Estructura de Fases y Git Worktrees para Agentes en Simultáneo

| Fase | Rol / Agente | Rama Git | Directorio de Trabajo (Worktree) | Alcance Exclusivo de Archivos |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 0** | **Arquitecto Base (Completada)** | `feat/ui-taste-foundation` | `C:\Users\mateo\Documents\proyects\student-os` | `index.html`, `src/index.css`, `src/types/index.ts`, `src/components/common/**` |
| **Fase 1 — WT1** | **Agente 1: Shell, Nav, QuickAdd & Dashboard** | `feat/wt1-shell-dashboard` | `C:\Users\mateo\Documents\proyects\student-os-wt1-shell` | `src/components/layout/**`, `src/components/quick-add/**`, `src/components/dashboard/**` |
| **Fase 1 — WT2** | **Agente 2: Universidad & Aprendizaje** | `feat/wt2-academic-learning` | `C:\Users\mateo\Documents\proyects\student-os-wt2-academic` | `src/components/university/**`, `src/components/learning/**` |
| **Fase 1 — WT3** | **Agente 3: Kanban & Horario Semanal** | `feat/wt3-kanban-calendar` | `C:\Users\mateo\Documents\proyects\student-os-wt3-planning` | `src/components/kanban/**`, `src/components/calendar/**` |
| **Fase 1 — WT4** | **Agente 4: Gym Tracker, Timer & 1RM** | `feat/wt4-gym-fitness` | `C:\Users\mateo\Documents\proyects\student-os-wt4-gym` | `src/components/gym/**` |
| **Fase 2** | **Integrador Central (`App.tsx`)** | `feat/ui-taste-foundation` | `C:\Users\mateo\Documents\proyects\student-os` | `src/App.tsx`, `src/data/initialData.ts` |
| **Fase 3** | **Auditoría Responsive, QA & PR** | `feat/ui-taste-foundation` | `C:\Users\mateo\Documents\proyects\student-os` | `memories.md`, `PLAN.md`, limpieza de worktrees y Pull Request |

---

## Reglas Inquebrantables para los 4 Agentes en Simultáneo (Zero-Conflict)

1. **Aislamiento absoluto de archivos:** Trabaja únicamente dentro de tu carpeta de worktree asignada y modifica solo las carpetas de tu alcance exclusivo. **PROHIBIDO modificar `src/App.tsx`, `src/index.css`, `index.html`, `src/types/index.ts` o `src/components/common/**` durante la Fase 1.**
2. **Usa el sistema de Fase 0 ya instalado:**
   - Clases globales en `src/index.css`: `.t-card`, `.t-card-lift`, `.t-row`, `.t-btn`, `.t-btn-primary`, `.t-btn-secondary`, `.t-btn-ghost`, `.t-btn-icon`, `.t-input`, `.t-label`, `.t-badge` (`.t-badge-accent`, `.t-badge-ok`, `.t-badge-warn`, `.t-badge-danger`, `.t-badge-gym`), `.t-num`, `.m-check`, `.view-enter`, `.hero-enter`.
   - Componentes compartidos en `src/components/common/`: `ModalShell`, `SegmentedControl`, `SectionHeader`, `YoutubeIcon`.
3. **Reglas `design-taste-frontend` + UX Juvenil:**
   - **Cero violeta / índigo / púrpura (`indigo-*`, `violet-*`, `purple-*`):** El 92% de la interfaz usa variables neutras (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--muted)`, `var(--line)`) y un único acento primario `var(--action)` (`#5ab9fc` en oscuro / `#1a4be0` en claro).
   - **Cero adornos "AI-Slop":** Prohibido usar `<Sparkles />`, esferas `blur-3xl`, gradientes neón en botones o puntos `animate-pulse` decorativos.
   - **Máximo 2 niveles de profundidad:** Nunca anides `card > caja > sub-caja`. Dentro de una `.t-card`, separa elementos de lista usando `.t-row` (`border-bottom: 1px solid var(--line)`).
   - **Tipografía clara (mínimo `13px`):** Prohibido usar `text-[9px]`, `text-[10px]`, `text-[11px]`, `font-black` o `uppercase tracking-wider`. Usa *sentence case* natural, pesos `400 / 500 / 600` y `.t-num` para cifras, notas, horas y pesos.
   - **Ergonomía táctil y lenguaje cercano:** Todo botón/control interactivo mide mínimo `44x44px`; habla claro y directo para jóvenes universitarios (sin tecnicismos innecesarios ni doble signo `+ +`).
4. **Props opcionales para compatibilidad con `App.tsx`:** Si agregas nuevos callbacks para persistencia limpia (ej. `onRestoreState?`, `onUpdateExercise?`), decláralos como opcionales (`?`) para que `npm run build` pase con `0` errores antes de la Fase 2.
5. **Verificación obligatoria antes del commit:**
   ```powershell
   npm run build
   npm run lint
   ```

---

## Secuencia de Integración (Fase 2 y Fase 3)

Una vez que los **4 Agentes** hayan confirmado sus commits en `WT1`, `WT2`, `WT3` y `WT4`:

```powershell
Set-Location "C:\Users\mateo\Documents\proyects\student-os"

# 1. Fusionar las 4 ramas sin conflictos
git merge --no-ff feat/wt1-shell-dashboard -m "merge(wt1): integrate redesigned shell, navbar, quick-add and overview dashboard"
git merge --no-ff feat/wt2-academic-learning -m "merge(wt2): integrate redesigned university modules and active recall learning view"
git merge --no-ff feat/wt3-kanban-calendar -m "merge(wt3): integrate redesigned kanban board and weekly calendar"
git merge --no-ff feat/wt4-gym-fitness -m "merge(wt4): integrate redesigned gym tracker, floating rest timer and 1rm modal"

# 2. Actualizar src/App.tsx:
#    - Mostrar <StatsHero /> solo en activeTab === 'overview'
#    - Envolver la vista activa en <div key={activeTab} className="view-enter">
#    - Conectar callbacks reactivos (onUpdateAssignment, onUpdateItem, onUpdateExercise, onHabitsChange, onRestoreState)

# 3. Verificar compilación, linter y limpiar worktrees de forma segura en Windows
npm run build
npm run lint

# IMPORTANTE EN WINDOWS: Desvincular primero el junction de node_modules antes de eliminar el worktree
foreach ($wt in @("student-os-wt1-shell","student-os-wt2-academic","student-os-wt3-planning","student-os-wt4-gym")) {
  if (Test-Path "C:\Users\mateo\Documents\proyects\$wt\node_modules") {
    cmd /c rmdir "C:\Users\mateo\Documents\proyects\$wt\node_modules"
  }
  git worktree remove "C:\Users\mateo\Documents\proyects\$wt"
}
git worktree prune
```
