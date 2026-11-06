# 🏋️ INSTRUCCIONES PARA AGENTE 2: Especialista Lifestyle & Métricas

> **Rama asignada:** `feat/agent-2-gym-calendar-dashboard`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-agent-2`  
> **Alcance exclusivo de archivos:**  
> - `src/components/gym/**`  
> - `src/components/calendar/**`  
> - `src/components/dashboard/**`  
> - `src/utils/icsExport.ts`  
> *(No modificar `App.tsx` para evitar colisiones con el Agente 1).*

---

## 📖 Contexto Previo Obligatorio
Antes de iniciar, lee detenidamente:
1. `memories.md`: Para entender el propósito de StudentOS PRO MAX, la identidad del usuario (Mateo) y los principios de UI/UX Pro Max (paleta Obsidian `#0b0f19`, 100% Lucide Icons, áreas táctiles mínimo 44x44px).
2. `src/types/index.ts`: Ya contiene los tipos ampliados (`DailyHabits`, `ExerciseHistoryEntry`, etc.).

---

## 🎯 Tareas a Desarrollar

### MÓDULO A: Gym Tracker (`src/components/gym/`)
1. **Rest Timer (Cronómetro de descanso entre series):**
   - Crear `RestTimerFloating.tsx` (minimizable / flotante).
   - Presets de descanso rápido: `45s`, `60s`, `90s`, `120s`.
   - Barra o círculo de progreso animado y aviso sonoro/visual al finalizar.
   - Opción para activarlo al marcar una serie (`completedSets`).
2. **Historial de PRs & Calculadora 1RM:**
   - Crear `ExerciseProgressModal.tsx` con historial de cargas y récord personal (`personalRecordKg`).
   - Calculadora estimada de 1RM con fórmula de Epley: $\text{1RM} = \text{Peso} \times (1 + \text{Reps}/30)$.
3. **Actualizar `GymTracker.tsx`:**
   - Botón de acceso al Rest Timer y badge de PR en cada ejercicio.

### MÓDULO B: Horario Semanal (`src/components/calendar/`)
1. **Vista Timeline / Grilla Horaria (07:00 a 22:00):**
   - Crear `CalendarTimelineGrid.tsx` que posicione los bloques visualmente según `startTime` y `endTime`.
   - Detección de solapamiento/colisiones de horario con alerta visual.
2. **Exportador iCalendar (.ics):**
   - Crear `src/utils/icsExport.ts` para descargar los bloques en archivo `.ics` compatible con Google Calendar / Apple Calendar.
3. **Actualizar `WeeklyCalendar.tsx`:**
   - Conmutador entre Vista Lista y Vista Grilla.
   - Botón *"Exportar a Calendario (.ics)"*.

### MÓDULO C: Dashboard & Hábitos (`src/components/dashboard/`)
1. **Widget de Hábitos Diarios (`DailyHabitsCard.tsx`):**
   - Contador de agua (+250ml hacia meta de 2.5L), horas de sueño (meta 7-8h) y pomodoros completados.
2. **Modal de Backup / Restore JSON (`BackupModal.tsx`):**
   - Botón para exportar el estado completo en archivo `.json`.
   - Botón para importar y restaurar un archivo `.json` validado.
3. **Actualizar `OverviewBento.tsx`:**
   - Integrar el widget de hábitos y el botón de backup en la cabecera.

---

## 🧪 Verificación Final
Al terminar, ejecuta en tu terminal:
```powershell
npm run build
```
Asegúrate de que no haya ningún error de TypeScript y confirma tus cambios con:
```powershell
git add src/components/gym/ src/components/calendar/ src/components/dashboard/ src/utils/icsExport.ts
git commit -m "feat(agent-2): add rest timer, 1rm calculator, timeline grid, ics export and habits backup"
```
