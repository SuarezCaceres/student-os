# Plan · 012 · Quehaceres diarios con meta, motivación e historial

> Estado: **aprobado** por el humano el 2026-11-24
> Se escribe después de aprobar la spec. Dice **cómo** se implementa.
> Orden: se implementa **después** de la 011 y de que la 009 llegue a `main` (todas tocan `OverviewBento.tsx`).

## Enfoque
Un módulo nuevo, separado de «Hábitos diarios», con tres tipos de dato que viajan por el sync **dentro de la colección `calendar`**, como ya hacen `dailyHabits` y `workShift`. Así **no hay colección nueva ni migración de base de datos**.

| Tipo (`kind`) | Id del registro | Contenido |
|---|---|---|
| `chore` | id del quehacer | `{ id, name, days: DayOfWeek[], order }` (días en los que aplica) |
| `choreDay` | `chore-day-AAAA-MM-DD` | `{ date, completed: [{ choreId, name }], hard: boolean, reason? }` (un registro por día, **con el nombre copiado**, para que renombrar o borrar un quehacer no cambie el pasado: C11) |
| `choreSettings` | `chore-settings` (singleton) | `{ seeded: true, levels: [{ min, message }] }` (umbrales y mensajes; `seeded` evita volver a sembrar la lista base si el usuario la borra) |

- **Lista base:** si no existe `choreSettings`, el cliente siembra los 5 quehaceres (tender la cama, pasear al perro, ducharme, limpiar mi cuarto, avanzar en proyectos personales de IA), todos los días, y crea `choreSettings` con 5 = «¡Eres lo máximo!» y 10 = «¡Sigue así!».
- **Lógica pura y testeable** en `apps/web/src/utils/chores.ts`: quehaceres de un día, nivel alcanzado, mensaje, cierre de día, promedio por día de la semana (excluye `hard`). Sin hooks ni red.
- **Fecha local:** el «día» es la fecha local del dispositivo (reutiliza `getLocalIsoDate`). Un temporizador revisa el cambio de día y actualiza la tarjeta sin recargar (C10).
- **Solo hoy es editable;** los `choreDay` anteriores son de solo lectura (decisión 🧭 aprobada).
- **Gráfica en SVG propio** (sin librería nueva): 7 barras (lunes a domingo) con el promedio de las últimas 8 semanas, la mejor resaltada y un estado vacío si hay pocos días.
- **Alternativas descartadas:** ampliar `DailyHabitsCard` (es de cantidades y usa `localStorage` directo, ver M2); una colección nueva (exigiría revisar el servidor y la base solo para esto); guardar un único registro con todo el historial (crece sin límite y choca con los 64 KB por registro).

## Cambios por área
| Área | Archivos / módulos | Qué cambia |
|------|--------------------|------------|
| Contrato (shared) | nuevo `packages/shared/src/chores.ts`; `calendar.ts`, `appState.ts`, `sync.ts` | Esquemas `ChoreSchema`, `ChoreDaySchema`, `ChoreSettingsSchema`; tres variantes nuevas en `CalendarRecordDataSchema`; campos `chores`, `choreDays`, `choreSettings` en `AppState` y su mapeo a `calendar`. Solo aditivo. Límites: 30 quehaceres, nombre ≤ 80 caracteres. |
| Frontend · sync | `apps/web/src/sync/adapters/calendar.ts` (+ tipos) | Proyección y `apply` idempotente de los tres tipos; tombstone para quehaceres borrados; registros inválidos se ignoran. |
| Frontend · lógica | nuevo `apps/web/src/utils/chores.ts` | Funciones puras descritas arriba. |
| Frontend · UI | nuevos `components/dashboard/ChoresCard.tsx`, `ChoresChart.tsx`, `ChoresEditor.tsx`; `OverviewBento.tsx`; `App.tsx` | Tarjeta (lista de hoy, contador, mensaje, «Hoy no puedo»/deshacer, editor de quehaceres y umbrales, gráfica); handlers de estado en `App.tsx`; se monta en el resumen. |
| Backend | — | Sin cambios de código (valida con el esquema compartido). Desplegar el API antes que la web. |
| Datos | — | **Sin migración ni dependencias nuevas.** |

## Pruebas
| Criterio | Tipo | Dónde |
|----------|------|-------|
| C1, C2 | unit (componente) | `ChoresCard.test.tsx`: lista base, añadir, renombrar, eliminar, persistencia |
| C3, C4 | unit (lógica) | `utils/chores.test.ts`: días aplicables, marcar/desmarcar sin duplicar |
| C5, C6, C7 | unit (lógica + componente) | `utils/chores.test.ts` y `ChoresCard.test.tsx`: niveles, mensajes editables, «completaste todos los de hoy» |
| C8, C9 | unit (componente) | `ChoresCard.test.tsx`: día difícil sin fallo; deshacer conserva lo marcado |
| C10 | unit (lógica) con reloj simulado | `utils/chores.test.ts` + componente: cierre de día a medianoche |
| C11 | unit (lógica) | `utils/chores.test.ts`: renombrar/borrar no cambia el historial |
| C12, C13 | unit (lógica + componente) | `utils/chores.test.ts` (promedio, excluye difíciles) y `ChoresChart.test.tsx` (mejor día, vacío) |
| C14 | integración + E2E | `sync/adapters/__tests__/calendar.test.ts` y `apps/web/e2e/07-quehaceres.spec.ts` (otro dispositivo, Supabase simulado) |
| C15 | integración (API) | `apps/api/test/*.e2e-spec.ts`: aislamiento entre dos usuarios |

## Pasos
Cada paso deja el proyecto en verde (`./scripts/check.sh --rapido` pasa) y acaba en un commit.
1. **Contrato:** esquemas, variantes de `calendar`, campos de `AppState` y mapeo de sync, con la prueba de cobertura del mapeo.
2. **Adaptador de sync** de los tres tipos (C14, parte).
3. **Lógica pura** `utils/chores.ts` con sus pruebas (C3–C5, C7, C10–C12).
4. **Estado en `App.tsx`:** siembra de la lista base, handlers, temporizador de cambio de día.
5. **`ChoresCard`** con lista, contador, mensaje y «Hoy no puedo» (C1, C2, C4–C9).
6. **Editor** de quehaceres y de umbrales/mensajes (C2, C3, C6).
7. **`ChoresChart`** y su estado vacío (C12, C13).
8. **Aislamiento en el API** y **E2E** (C14, C15).
9. **Cierre:** `./scripts/check.sh` completo, skill `revisor`, `features.json`, `TASKS.md`, `PROGRESS.md` y PR.

## Riesgos
- **Conflictos con la 009 y la 011:** las tres editan `OverviewBento.tsx` y `App.tsx`. Hay que hacerlas en orden 009 → 011 → 012 y rebasar.
- **Orden de despliegue:** el API debe tener el `shared` nuevo antes que la web (si no, rechaza los registros nuevos).
- **Clientes antiguos abiertos:** ignoran los tipos desconocidos; la prueba del adaptador lo cubre.
- **Tamaño del historial:** un registro por día (~1–2 KB) está muy por debajo del límite de 64 KB; un año son ~365 registros de los 5000 permitidos. Si algún día se acerca, se puede archivar por mes.
- **Reloj y zona horaria:** el cambio de día depende de la hora del dispositivo; los tests usan reloj simulado y el historial ya guardado nunca se reescribe.
- **Siembra de la lista base en varios dispositivos a la vez:** dos dispositivos nuevos podrían sembrar por separado y duplicar los cinco quehaceres. Mitigación: ids fijos y deterministas para los cinco (`chore-base-1`…`5`), de modo que el sync los fusiona en lugar de duplicarlos.
