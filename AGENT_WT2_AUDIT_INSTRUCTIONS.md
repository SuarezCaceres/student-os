# INSTRUCCIONES PARA AGENTE 2 (TERMINAL 2) — AUTH MODAL, ACCESIBILIDAD Y PULIDO DE LANDING

> **Rol:** Agente 2 (Segunda Terminal)  
> **Rama de trabajo:** `feat/audit-landing-auth-polish`  
> **Directorio asignado (Worktree):** `C:\Users\mateo\Documents\proyects\student-os-wt2-landing`  
> **Alcance EXCLUSIVO de archivos:**  
> - `src/components/auth/AuthModal.tsx`  
> - `src/components/landing/LandingPage.tsx`  
> - `src/components/landing/LandingNavbar.tsx`  
> - `src/components/landing/LandingFooter.tsx`  
>
> **PROHIBIDO MODIFICAR:** `src/index.css`, `src/App.tsx`, `src/components/common/**`, `src/components/layout/**`, `src/components/kanban/**`, `src/components/dashboard/**`, `src/components/gym/**`, `src/components/university/**`, `src/components/calendar/**`.

---

## 1. Contexto Obligatorio Antes de Comenzar
Lee detenidamente:
1. `PRODUCT.md` y `DESIGN.md` en la raíz del proyecto.
2. `memories.md` para respetar las directrices arquitectónicas.
3. Estándar de commits obligatorio (`github-workflow-standards`): commits semánticos en imperativo (ej. `fix(auth): ...`, `polish(landing): ...`).

---

## 2. Tareas Detalladas por Archivo

### A. `src/components/auth/AuthModal.tsx` — Accesibilidad en Formularios y Vinculación Semántica
1. **Vinculación de Labels con Inputs (WCAG 2.1 SC 1.3.1 y SC 4.1.2):**
   - En cada campo (`name`, `email`, `password`, `major`), asignar un `id` único y semántico:
     - `id="auth-input-name"`
     - `id="auth-input-email"`
     - `id="auth-input-password"`
     - `id="auth-input-major"`
   - Vincular cada `<label>` con su input mediante el atributo correspondiente: `<label htmlFor="auth-input-name" ...>`.
2. **Normalización de Tipografía:**
   - En la línea 265 aprox., reemplazar la clase arbitraria `text-[11px]` por una clase semántica de la rampa oficial (`text-xs font-mono` o `text-xs text-[var(--muted)]`).
3. **Sincronización de tokens:**
   - Sustituir los colores `cyan-500` fijos por los tokens del sistema (`var(--action)`, `var(--action-ink)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--muted)`).
4. **Gestión de foco:**
   - Cuando se abra el modal, enfocar automáticamente el primer input (`email` en login o `name` en registro).
   - Confinar el tabulado (`Tab` / `Shift+Tab`) dentro del modal para que no se escape al fondo.

### B. `src/components/landing/LandingPage.tsx` — Contraste de Selección y Pulido
1. En la línea 39 aprox.:
   - Corregir `selection:bg-cyan-500 selection:text-black` por una combinación con contraste impecable alineada con `DESIGN.md`: `selection:bg-[var(--action)] selection:text-white`.

### C. `src/components/landing/LandingNavbar.tsx` & `LandingFooter.tsx` — Accesibilidad en Enlaces
1. Verificar que todos los botones de la navbar de la landing tengan un área táctil mínima de 44x44px.
2. Verificar que los enlaces del footer cuenten con `rel="noopener noreferrer"` si son externos y etiquetas accesibles claras.

---

## 3. Verificación Obligatoria
Ejecutar en la terminal del worktree:
```bash
npm run build
npx oxlint
& "C:\Users\mateo\.agents\skills\impeccable\scripts\impeccable.cmd" detect src/components/auth/ src/components/landing/
```
Asegurarse de que el detector reporte **0 anti-patterns** y **0 advisories** en `src/components/auth/` y `src/components/landing/`.

---

## 4. Estándar de Commit
Crear commits atómicos siguiendo Conventional Commits:
- `fix(auth): link form labels with inputs htmlFor, focus management and token styles`
- `polish(landing): update text selection contrast and navbar touch targets`
