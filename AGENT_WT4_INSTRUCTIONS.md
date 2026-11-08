# INSTRUCCIONES PARA AGENTE 4 (WT4): Gym Tracker, Cronómetro Flotante & Progreso 1RM

> **Rama asignada:** `feat/wt4-gym-fitness`  
> **Directorio de trabajo (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt4-gym`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/components/gym/GymTracker.tsx`  
> - `src/components/gym/RestTimerFloating.tsx`  
> - `src/components/gym/ExerciseProgressModal.tsx`  
>
> **PROHIBIDO modificar:** `src/App.tsx`, `src/index.css`, `index.html`, `src/types/index.ts`, `src/components/common/**` o cualquier otra carpeta fuera de tu alcance.

---

## 1. Contexto Obligatorio Antes de Empezar
Lee estos archivos antes de programar:
1. `PLAN.md` y `memories.md` (reglas Zero-Conflict y estándar `github-workflow-standards`).
2. `src/index.css` (paleta `blue-black-cornflower` / `white-link-blue`, clases `.t-card`, `.t-card-lift`, `.t-row`, `.t-btn`, `.t-btn-primary`, `.t-btn-secondary`, `.t-btn-ghost`, `.t-btn-icon`, `.t-input`, `.t-label`, `.t-badge`, `.t-num`).
3. `src/components/common/ModalShell.tsx`, `SegmentedControl.tsx` y `SectionHeader.tsx`.

---

## 2. Reglas de Diseño (`design-taste-frontend` + UX Juvenil)
- **Cero `indigo-*`, `violet-*`, `purple-*`:** Usa las variables del sistema (`var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--muted)`, `var(--action)`, `var(--gym)`, `var(--ok)`, `var(--line)`).
- **Cero `<Sparkles />`, cero giros perpetuos (`animate-spin-slow`) y cero rebotes innecesarios:** Cada movimiento debe ser táctil, rápido y con propósito funcional.
- **Cero texto menor a `13px` (`text-[13px]` mínimo) y cero `uppercase tracking-wider` o `font-black`:** Usa *sentence case* natural, pesos `400 / 500 / 600` y `.t-num` (`JetBrains Mono` tabular) para pesos `kg`, repeticiones, porcentajes, 1RM y el reloj `MM:SS`.
- **Máximo 2 niveles de cajas** y áreas táctiles reales `>=44x44px` pensadas para usarse con el celular en mano mientras entrenas en el gimnasio.

---

## 3. Tareas Específicas por Archivo

### A. `src/components/gym/GymTracker.tsx`
- Extiende `GymTrackerProps` añadiendo la prop opcional `onUpdateExercise?: (day: DayOfWeek, updated: GymExercise) => void` para que Fase 2 la conecte al estado central en `App.tsx` (mantén el fallback local si `onUpdateExercise` aún no se pasa para no romper nada).
- Cabecera con `<SectionHeader title="Entrenamiento y gimnasio" subtitle="Marca tus series en un toque, controla tus descansos y supera tus marcas." actions={...} />`.
- En `actions`:
  - Botón `.t-btn .t-btn-secondary` `"Cronómetro"` (`Timer`) para abrir/cerrar `RestTimerFloating`.
  - Toggle limpio `min-h-[44px] px-3.5 rounded-[12px]` para `"Descanso automático"` (sin `<Sparkles />`, usando un indicador claro de encendido/apagado).
  - Botón `.t-btn .t-btn-primary` `"Agregar ejercicio"` (`Plus`).
- Selector de días `Lunes` a `Domingo`: usa `<SegmentedControl />` o una tira limpia de 7 botones táctiles (`min-h-[44px]`) donde el día seleccionado se resalta nítidamente y el día actual lleva una marca discreta (`Hoy`).
- Tarjeta principal de la rutina del día (`.t-card p-6`):
  - Encabezado con nombre de la rutina, etiqueta `.t-badge .t-badge-gym`, progreso en `.t-num` (`{completedSets}/{totalSets} series · {progressPercent}%`) y barra de progreso fluida (`h-2 rounded-full bg-[var(--surface-2)]` con relleno `var(--action)` o `var(--ok)` al llegar a 100%).
  - Lista de ejercicios limpia (evita triple anidamiento): cada ejercicio muestra su nombre en `16px–18px font-medium`, carga y repeticiones en `.t-num` (`80 kg · 8-10 reps`), insignia de récord personal `PR {ex.personalRecordKg} kg` si existe, botón `"Ver progreso / 1RM"` (`TrendingUp`, `min-h-[40px]`) y botón eliminar accesible (`44x44px`).
  - **Burbujas de series táctiles (`S1`, `S2`, `S3`, `S4`):** Botones amplios y cómodos para el pulgar en el gym (`min-w-[48px] min-h-[48px] rounded-[12px] t-num text-[14px] font-medium`), con feedback inmediato de presión (`active:scale-95`) y estado completado nítido (`bg-[var(--ok)] text-[#0a0d14]`).
  - Pie de rutina: botón `.t-btn .t-btn-primary` `"Terminar rutina de hoy"` que dispara `triggerBigCelebration()` y `onFinishWorkout()`.
- Si `showAddForm` está activo, muéstralo con `<ModalShell />` o panel limpio con inputs `.t-input` (`48px`) y etiquetas `.t-label`.

### B. `src/components/gym/RestTimerFloating.tsx`
- **Corrección crítica en móvil:** Posiciona el componente con `fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-[340px] md:right-6 z-40` para que **jamás tape la barra inferior de navegación en pantallas móviles (`<768px`)** ni se salga de pantalla en `320px–390px`.
- Elimina `animate-spin-slow` y rebotes perpetuos. Usa `.t-card shadow-2xl border-[var(--line-strong)] p-5 modal-panel-enter` sólido y legible en Modo Claro y Modo Oscuro.
- Reloj principal en `.t-num text-4xl sm:text-5xl font-medium tracking-tight text-[var(--ink)]`, acompañado de botones `-15s` y `+15s` de **`44x44px`** reales.
- Presets rápidos (`45s`, `60s`, `90s`, `120s`) con altura táctil `min-h-[42px] t-num text-[14px]`.
- Controles claros de `44px` de alto: botón principal `"Pausar"` / `"Iniciar"` (cumpliendo la regla obligatoria de pausa de `motion.md`) y botón `"Reiniciar"`, además de botones de minimizar y cerrar de `44x44px`.
- Vista minimizada: píldora limpia en `bottom-20 md:bottom-6 right-4 md:right-6 min-h-[48px] px-4` con el tiempo vivo en `.t-num`, botón rápido de pausa/play de `36px–40px` y clic para expandir.

### C. `src/components/gym/ExerciseProgressModal.tsx`
- Refactoriza usando `<ModalShell isOpen={isOpen} onClose={onClose} badge={exercise.sets + ' series · ' + exercise.reps} title={exercise.name} subtitle="Tu récord personal, estimación de fuerza máxima (1RM) e historial de pesos" maxWidth="2xl">`.
- Resumen superior en 2 paneles limpios (`bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)]`):
  - **Récord personal (PR):** cifra grande `.t-num` (`{currentPR} kg`) y edición limpia con `.t-input` + `.t-btn`.
  - **1RM estimado:** cifra grande `.t-num` (`{estimated1RM} kg`) explicada sin tecnicismo intimidante (*"Peso máximo estimado a 1 repetición"*).
- Calculadora interactiva con 2 inputs `.t-input t-num` (Peso en `kg` y Repeticiones) y tabla limpia de zonas (`95%` a `70%`) en grilla de 2 o 3 columnas con `.t-num` sin anidar 3 bordes.
- Historial de cargas usando filas `.t-row` limpias con fecha y peso en `.t-num`, más formulario desplegable limpio para `"Registrar serie de hoy"`.

---

## 4. Verificación y Commit Obligatorio
Ejecuta en `C:\Users\mateo\Documents\proyects\student-os-wt4-gym`:
```powershell
npm run build
npm run lint
```
Cuando ambos pasen con **0 errores**, confirma únicamente tus archivos:
```powershell
git add src/components/gym/
git commit -m "feat(wt4): redesign gym tracker, mobile-safe rest timer and 1rm progress modal"
```
