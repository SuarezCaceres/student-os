# 🗺️ Plan de Implementación Modular y Worktrees para Agentes

> Este archivo sirve como directriz principal para cualquier agente o desarrollador que trabaje en las fases del proyecto.
> Antes de programar, lee [memories.md](memories.md) para conocer el contexto general del proyecto y sus principios de diseño (UI/UX Pro Max).

---

## 🌿 Estructura de Ramas y Worktrees por Fase

| Fase | Módulo / Sección | Rama Git | Directorio de Trabajo (Worktree) | Alcance Exclusivo de Archivos |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **Tipos Base** | `feat/contracts-core-types` | `C:\Users\mateo\Documents\proyects\student-os` | `src/types/index.ts` |
| **1** | **Universidad** | `feat/university-grades-rubrics` | `C:\Users\mateo\Documents\proyects\student-os-worktrees\university` | `src/components/university/` |
| **2** | **Gym Tracker** | `feat/gym-timer-prs-progression` | `C:\Users\mateo\Documents\proyects\student-os-worktrees\gym` | `src/components/gym/` |
| **3** | **Kanban** | `feat/kanban-dnd-checklists-search` | `C:\Users\mateo\Documents\proyects\student-os-worktrees\kanban` | `src/components/kanban/` |
| **4** | **Calendario** | `feat/calendar-timeline-ics-export` | `C:\Users\mateo\Documents\proyects\student-os-worktrees\calendar` | `src/components/calendar/`, `src/utils/icsExport.ts` |
| **5** | **Dashboard** | `feat/dashboard-habits-backup-analytics` | `C:\Users\mateo\Documents\proyects\student-os-worktrees\dashboard` | `src/components/dashboard/`, `src/components/layout/` |

---

## 📌 Reglas de Oro para los Agentes (Zero-Conflict)

1. **Trabaja únicamente en tu directorio de worktree asignado.**
2. **Modifica exclusivamente los archivos de tu carpeta de componentes.** No toques `App.tsx` directamente durante el desarrollo de la fase; cada componente debe exponer sus nuevas props y modales de forma limpia.
3. **Sigue las directrices de `memories.md`:**
   - Paleta Obsidian (`#0b0f19` / `#111827`) y acentos correspondientes.
   - 100% iconos vectoriales de Lucide React (sin emojis interactivos).
   - Botones táctiles de mínimo 44x44px.
   - Animaciones con Canvas-Confetti en hitos y acciones clave.
4. **Verifica siempre antes de finalizar:**
   - Ejecuta `npm run build` y comprueba que TypeScript compile con cero errores.
