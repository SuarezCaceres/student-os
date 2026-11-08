---
name: StudentOS PRO MAX
description: Life, Gym & College Hub for Engineering Students
colors:
  action-light: "#1a4be0"
  action-dark: "#5ab9fc"
  bg-light: "#f7f8fa"
  bg-dark: "#0a0d14"
  surface-light: "#ffffff"
  surface-dark: "#131824"
  surface-2-light: "#f1f3f6"
  surface-2-dark: "#192030"
  ink-light: "#111318"
  ink-dark: "#e9edf3"
  muted-light: "#5d6470"
  muted-dark: "#8891a1"
  line-light: "rgba(17, 19, 24, 0.10)"
  line-dark: "rgba(233, 237, 243, 0.09)"
  line-strong-light: "rgba(17, 19, 24, 0.20)"
  line-strong-dark: "rgba(233, 237, 243, 0.18)"
  ok: "#0f9f6e"
  ok-dark: "#34d399"
  warn: "#d97706"
  warn-dark: "#fbbf24"
  danger: "#dc2626"
  danger-dark: "#f87171"
  gym: "#e04f16"
  gym-dark: "#ff6b35"
typography:
  display:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.2
  badge:
    fontFamily: "'Schibsted Grotesk', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  btn: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-light}"
    textColor: "#ffffff"
    rounded: "{rounded.btn}"
    padding: "0 18px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.btn}"
    padding: "0 18px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.surface-2-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "48px"
  card-base:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: StudentOS PRO MAX

## Overview

- **Creative North Star:** *"The Engineering Command Hub"*
- **Aesthetic Philosophy:** Una interfaz de herramientas de ingeniería de software de alto rendimiento y precisión analítica. El sistema visual prioriza la densidad de información legible, la sobriedad instrumental y la respuesta táctil inmediata. 
- **Regla del 92% Neutro:** El 92% del espacio visual pertenece a superficies e interfaces neutras (`--bg`, `--surface`, `--ink`), dejando el color exclusivamente para propósitos de acción (`--action`) o información de estado (`--ok`, `--warn`, `--danger`, `--gym`).
- **Anti-Referencias Visuales:** 
  - Prohibidos los degradados decorativos lavanda / violeta / púrpura genéricos característicos de plantillas generadas por IA.
  - Prohibidos los patrones de tarjeta dentro de tarjeta ("box-in-box") redundantes; las divisiones internas se realizan mediante hairlines de 1px (`.t-row`).

## Colors

El sistema opera con tokens funcionales semánticos soportando tema claro (`white-link-blue`) y tema oscuro (`blue-black-cornflower`):

### Neutral Ground & Surfaces
- **Light:** Background `--bg` (`#f7f8fa`), Surface `--surface` (`#ffffff`), Muted Surface `--surface-2` (`#f1f3f6`).
- **Dark:** Background `--bg` (`#0a0d14`), Surface `--surface` (`#131824`), Muted Surface `--surface-2` (`#192030`).

### Ink & Contrast
- **Light:** Primary Ink `--ink` (`#111318`), Muted Ink `--muted` (`#5d6470`).
- **Dark:** Primary Ink `--ink` (`#e9edf3`), Muted Ink `--muted` (`#8891a1`).

### Action & Functional Accent
- **Primary Action (Link-Blue / Cornflower):** 
  - Light: `--action` (`#1a4be0`), texto `--action-ink` (`#ffffff`).
  - Dark: `--action` (`#5ab9fc`), texto `--action-ink` (`#0a0d14`).
- **Gym Accent:** `--gym` (`#e04f16` en light / `#ff6b35` en dark). Usado en marcas de series, récords personales (PR) y cronómetros de entrenamiento.
- **Status Indicators:**
  - Success: `--ok` (`#0f9f6e` / `#34d399`).
  - Warning: `--warn` (`#d97706` / `#fbbf24`).
  - Danger: `--danger` (`#dc2626` / `#f87171`).

## Typography

El emparejamiento tipográfico combina la claridad contemporánea humanista con el rigor técnico tabular:

1. **Sans-Serif Principal (`Schibsted Grotesk`):**
   - Utilizada para títulos, encabezados, párrafos y controles interactivos.
   - Tracking negativo en títulos grandes (`-0.028em` en Display y `-0.02em` en Headline) para una presencia compacta y autorizada.
2. **Monospace Tabular (`JetBrains Mono`):**
   - Utilizada para números, calificaciones (GPA 0–20), pesos (kg), cronómetro (Rest Timer), series (S1..S4) y fechas (`.t-num`).
   - Requiere `font-variant-numeric: tabular-nums` para evitar saltos de línea y desalineación horizontal durante transiciones numéricas.

## Layout

- **Contenedor Canónico (`.t-wrap`):** Ancho máximo delimitado a `1280px` con márgenes horizontales equivalentes (32px en mobile, 48px en tablet, 64px en desktop).
- **Tablero Bento Grid:** Distribución modular en rejilla de tarjetas autónomas con gaps coherentes (16px a 24px) que agrupan las prioridades de "Hoy".
- **Grilla Horaria (Timeline):** Grilla continua de 07:00 a 22:00 con detección de colisiones de horario y bloques proporcionales a la duración del bloque académico.
- **Responsive Navigation:** Barra superior de `72px` de altura en desktop (`--nav-h`) que se contrae a `56px` (`--nav-h-mobile`) en pantallas móviles con navegación fija inferior protegida por safe-area (`--mobile-bar-h`).

## Elevation & Depth

- **Filosofía Tonal y Plana:** El sistema no depende de sombras flotantes pesadas ni falsos 3D difuminados. La jerarquía se expresa mediante contrastes tonales entre `--bg`, `--surface` y `--surface-2`.
- **Hairline Borders (1px):** Bordes nítidos de 1 píxel (`var(--line)` y `var(--line-strong)`) que definen el perímetro estructural de tarjetas y componentes.
- **Card Lift Hover:** En pantallas con cursor (`@media (hover: hover)`), las tarjetas con clase interactiva `.t-card-lift` elevan suavemente `-2px` con sombra sutil de 28px (`rgba(0, 0, 0, 0.35)`) y transición de `180ms`.
- **Top Inset Highlight:** Borde superior interno sutil de 1px (`box-shadow: inset 0 1px 0 var(--card-hi)`) en modo oscuro para sugerir iluminación física cenital.

## Shapes

- **Bordes Suaves (`data-radius="soft"`):**
  - Radio de tarjetas principales: `20px` (`--r-lg`).
  - Radio de inputs y selects: `12px` (`--r-md`).
  - Radio de botones de acción: `12px` (`--r-btn`).
  - Radio de badges y etiquetas: `999px` (Pill shape).
  - Checkboxes animados (`.m-check`): `6px`.

## Components

### 1. Botones (`.t-btn`)
- Altura mínima ergonómica de `44px` para cumplimiento táctil en cualquier dispositivo.
- **Primary (`.t-btn-primary`):** Fondo `--action`, texto `--action-ink`. Efecto hover con `color-mix` al 86%.
- **Secondary (`.t-btn-secondary`):** Superficie clara/oscura con borde `var(--line-strong)`.
- **Ghost (`.t-btn-ghost`):** Transparente en reposo, resalta a `--surface-2` al hover.
- **Focus Ring Inmediato:** Contorno nítido de 2px en `--action` con 2px de offset (`transition-duration: 0s`).

### 2. Entradas de Texto (`.t-input`)
- Altura mínima de `48px` y tipografía de `16px` para evitar el zoom automático no deseado en dispositivos móviles iOS/Android.
- Borde activo con anillo doble difuminado con `color-mix(in oklab, var(--action) 18%, transparent)`.

### 3. Tarjetas & Filas (`.t-card`, `.t-row`)
- Estructura limpia de una sola tarjeta exterior. Las subsecciones internas se dividen con `.t-row` (padding vertical de 14px y borde inferior de 1px) en vez de anidar divs grises.

### 4. Badges Semánticos (`.t-badge`)
- Tipografía en Sentence case (mínimo 13px), nunca texto gritado en mayúsculas diminutas.
- Variantes tintadas con transparencia suave del 14% de fondo y 28% en borde (`.t-badge-accent`, `.t-badge-ok`, `.t-badge-warn`, `.t-badge-danger`, `.t-badge-gym`).

## Do's and Don'ts

### Do's
- Mantener los números y métricas en fuente monospace tabular (`.t-num`).
- Respetar la altura mínima de toque de 44px en botones y 48px en campos de formulario.
- Usar el acento naranja `--gym` exclusivamente para métricas, series o temporizadores deportivos.
- Probar siempre los contrastes en ambos modos (Light y Dark).
- Usar `color-mix(in oklab, ...)` para variaciones tonales coherentes en Tailwind v4.

### Don'ts
- **No** agregar degradados púrpuras, lavandas o rosas estilo "IA genérica".
- **No** anidar tarjetas grises dentro de tarjetas grises ("box-in-box"); utiliza divisores de línea (`.t-row`).
- **No** usar textos en mayúsculas forzadas (ALL CAPS) para párrafos o badges completos.
- **No** usar emojis interactivos en lugar de iconos vectoriales SVG oficiales de Lucide React.
- **No** alterar las claves semánticas de persistencia en `localStorage` (`student_os_state_v1`).
