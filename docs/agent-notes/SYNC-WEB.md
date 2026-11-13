# Notas del agente SYNC-WEB (Ola 2) — motor de sync, login con Supabase y `useSyncedAppState`

Rama: `feat/be-sync-web`. Alcance: `apps/web/src/{sync,services/api.ts,services/supabase.ts,hooks/useSyncedAppState.ts,components/auth,components/sync,utils/accountDataCleanup.ts}`,
`apps/web/vitest.config.ts`, devDependencies de `apps/web/package.json` y este archivo. **No se tocó `App.tsx`.**

## 1. Requisito critico: sin variables de entorno = app de hoy

Si falta alguna de `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`:
- `useSyncedAppState` es equivalente a `useLocalStorage` (probado contra el hook original): mismo estado, mismas escrituras, mismo `reset`, sin red, sin IndexedDB, sin motor.
- `@supabase/supabase-js` ni se descarga (import dinamico; es un chunk aparte).
- `SyncStatusBadge`, `SyncGate` y `SyncProvider` no pintan nada. `useAuthState().cloudAvailable === false`.
- `AuthModal` es identico al actual (solo se anaden props opcionales).
- El motor solo arranca con las TRES variables y sesion de Supabase iniciada. Con Supabase pero sin `VITE_API_URL` tampoco hay motor.

## 2. Arquitectura

```
services/supabase.ts   config, cliente (lazy), signInWithGoogle/signOut, token, useSupabaseSession()
services/api.ts        cliente HTTP: timeout 20 s/intento, backoff exp. + jitter, presupuesto ~90 s,
                       estados idle|waking|ok|error, 401 -> refresh 1 vez -> signOut, 429 Retry-After, ApiError tipado
sync/engine.ts         SyncEngine (local-first): diff por id, cola, push, pull, anti-eco, LWW, importador
sync/storage.ts        IndexedDB (idb-keyval) con degradacion a memoria; un documento por usuario (`doc:<userId>`)
sync/leader.ts         Web Locks: solo una pestana por cuenta ejecuta el motor
sync/syncStore.ts      store externo con el estado visible + useSyncStatus() (+ BroadcastChannel hacia pestanas seguidoras)
sync/backup.ts         descarga del respaldo JSON
sync/importMarker.ts   marca "ya importo" por usuario (localStorage, sobrevive al cierre de sesion)
hooks/useSyncedAppState.ts   [state, setState, reset] + motor + SyncProvider/useSyncStatus re-exportados
components/auth/       AuthModal (refactor), useAuthState, SyncGate
components/sync/       SyncStatusBadge, ImportDecisionModal, SyncProvider
utils/accountDataCleanup.ts  + clearSyncDataOnSignOut() (lo anterior intacto)
```

### Motor (decisiones)
- **Diff**: cada `adapter.select(state)` da `{id, data}`; el motor guarda por registro un hash (cyrb53 de JSON canonico) del ultimo estado *observado*. Altas/cambios/borrados (tombstones) se encolan; ediciones sucesivas del mismo registro se agrupan.
- **Cola persistente**: un unico documento IndexedDB por usuario (`cola + cursor + snapshot + versiones + rechazados`), escritura unica = consistente. `localStorage` siempre va por delante (el hook lo escribe de forma sincrona antes de que el motor persista), y al arrancar se hace un diff contra el snapshot, asi que un cierre brusco no pierde nada.
- **Push**: debounce 1,5 s, lotes por **numero (200) y por bytes (~500 KB)** (el servidor acepta 1 MB y 500 cambios). `applied` (ids sin coleccion) se cruza con `conflicts[].collection`. Un 400/413 divide el lote hasta aislar al registro culpable (queda en `rejected`, no bloquea la cola); un **422 (cuota)** detiene los reintentos y avisa; no se reintenta a ciegas. Un cambio que no cumple el contrato local nunca sale.
- **Pull**: al iniciar, al volver el foco/visibilidad (minimo 15 s entre pulls), con el evento `online` y tras un fallo (backoff propio 5/15/30/60 s o `Retry-After`). Paginado con cursor persistido solo despues de aplicar la pagina. Registros que no cumplen el contrato se descartan y se cuentan (`console.warn`).
- **Ultima edicion gana**: por `updatedAt`; un cambio local pendiente mas nuevo se conserva; en empate manda el servidor. Cada edicion local se estampa `max(ahora, ultimaVersionConocida+1, colaPrevia+1)` para que una edicion posterior a lo visto siempre gane aunque el reloj este desfasado. Si el servidor recorta un `updatedAt` futuro (> ahora + 5 min), el motor adopta el que devuelve el siguiente pull.
- **Anti-eco**: tras aplicar registros remotos el snapshot se reconstruye desde el estado resultante y los pulls ignoran versiones ya conocidas (incluido el eco de lo que acabamos de subir).
- **Sin perdida durante un pull en vuelo**: los registros se aplican sobre `getState()` en el momento de aplicar (no sobre el estado de cuando salio la peticion) y antes se hace `observe()`.
- **Varias pestanas**: lider por Web Locks; las demas siguen el estado por el evento `storage` y muestran el estado del lider por BroadcastChannel. Si la lider se cierra, otra toma el relevo y carga la cola de IndexedDB.
- **Proteccion**: si `localStorage` vuelve a "estado de fabrica" pero el snapshot recuerda datos, NO se interpreta como "borre todo": se repite el importador en lugar de subir borrados masivos.

### Importador del primer inicio de sesion (una vez por usuario)
| Local | Nube | Resultado |
| --- | --- | --- |
| sin datos / de fabrica | vacia | nada que hacer |
| sin datos / de fabrica | con datos | se aplica la nube sin preguntar |
| con datos | vacia | modal "¿Subimos tus datos?" -> respaldo JSON automatico -> sube. "Ahora no" = sync en pausa (no se toca nada) |
| con datos | iguales | silencioso |
| con datos | con datos distintos | modal "Usar la nube" / "Conservar lo de este dispositivo", ambos con paso de confirmacion; respaldo local siempre y respaldo de la nube si se reemplaza. Nunca se fusiona a ciegas |
Si el respaldo no se puede descargar, la operacion se cancela. La marca "ya importo" evita volver a preguntar al subir a una nube vacia tras cerrar y abrir sesion.

### Cierre de sesion
`useSyncedAppState` detecta el paso a `signedOut` y llama `clearSyncDataOnSignOut(userId)` (borra cola, cursor, snapshot, versiones). Los datos de la app en `localStorage` y la marca de importacion se conservan. `signOut()` de Supabase limpia su propia sesion.

## 3. CAMBIOS EXACTOS que debe hacer el Integrador

### `apps/web/src/App.tsx`
1. **Linea 4**: cambiar `import { useLocalStorage } from './hooks/useLocalStorage';` por
   `import { useSyncedAppState } from './hooks/useSyncedAppState';`
2. **Linea 109**: `const [state, setState, resetState] = useSyncedAppState(initialData);`
   (la clave por defecto es `student_os_state_v1`; tambien admite `useSyncedAppState('student_os_state_v1', initialData)`).
3. **Entrar a la app tras volver de Google (Supabase redirige la pagina)**. Anadir junto a los `useState` de sesion (~linea 185):
   ```tsx
   const auth = useAuthState(); // import { useAuthState } from './components/auth/useAuthState';
   useEffect(() => {
     if (auth.userSession && !userSession) {
       setUserSession(auth.userSession);
       try { localStorage.setItem('student_os_user_session', JSON.stringify(auth.userSession)); } catch { /* ignore */ }
       setCurrentView('app');
     }
   }, [auth.userSession, userSession]);
   ```
4. **`handleLogout` (~linea 362)**: al principio anadir `void auth.signOut();` (no hace nada sin Supabase). No hace falta limpiar IndexedDB a mano: el hook lo hace.
5. **Montar el provider** (una de las dos):
   - (preferida, sin tocar mas App) en `apps/web/src/main.tsx`: `<SyncProvider><App /></SyncProvider>` (`import { SyncProvider } from './hooks/useSyncedAppState'`); o
   - dentro de `App`, envolviendo ambos `return` (landing y app) con `<SyncProvider>…</SyncProvider>`.
   Monta el modal del importador y el aviso de "sincronizacion en pausa".
6. **Indicador**: en la vista `app`, dentro/junto al `<Navbar … />` (~linea 2330) o en la cabecera de `<main>` anadir `<SyncStatusBadge interactive />`
   (`import { SyncStatusBadge } from './components/sync/SyncStatusBadge'`). No pinta nada si la sync esta apagada.
7. `AuthModal` no necesita cambios en `LandingPage`/`App`: detecta Supabase solo. En la Ola 3 se puede pasar `cloudAuth={false}` si se quisiera forzar el modo antiguo.

### Otros
- `.env.example` (raiz, lo edita el Integrador): anadir `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`.
- Vercel: definir las tres variables (el despliegue actual sin ellas sigue funcionando igual).
- Lockfile: `npm install` en la raiz (se anadieron devDependencies; el lockfile NO se commitea desde esta rama).

## 4. Variables de entorno nuevas
| Variable | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (publica) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave publishable/anon (publica). Nunca `service_role` |
| `VITE_API_URL` | URL base de la API en Render, sin barra final (p. ej. `https://studentos-api.onrender.com`) |

## 5. Configuracion requerida en Supabase Auth
- Authentication -> Providers -> **Google**: activar con el Client ID y Client Secret de Google Cloud (el secret solo se pega en Supabase, nunca en el repo).
- En Google Cloud, el cliente OAuth debe tener como *URI de redireccion autorizada* `https://<ref>.supabase.co/auth/v1/callback`.
- Authentication -> URL Configuration: **Site URL** = URL de produccion (Vercel); **Redirect URLs** = produccion, previews (`https://*-<equipo>.vercel.app/**`) y `http://localhost:5173/**` (y el puerto que uses). El cliente usa `redirectTo = window.location.origin`.
- Flujo PKCE (`flowType: 'pkce'`, sesion persistente en localStorage).
- Alcances: solo los basicos (`openid email profile`). El acceso a Google Calendar sigue siendo el de GIS (`services/googleCalendar.ts`) hasta la Ola 3.

## 6. Pruebas (Vitest, `fake-indexeddb`, jsdom en las de componentes)
`npm test -w apps/web`: 57 pruebas.
- `sync/__tests__/engine.test.ts`: offline->online, cola que sobrevive a un reinicio, diff al arrancar, dos dispositivos, conflicto (gana la edicion mas nueva), cambio local mas nuevo que el remoto, eco, edicion durante pull, updatedAt recortado, lotes por numero/bytes, 400 aislado, 422 sin reintento, cold start (503/red caida y luego OK), servidor caido con backoff propio, 401 con refresh, 401 persistente, importador (nube vacia, ambas con datos, usar nube, conservar local, respaldo que falla, "Ahora no", marca previa, iguales, estado reiniciado), adaptadores stub.
- `services/api.test.ts`: backoff/jitter exacto, timeout, presupuesto, 401, 429 `Retry-After`, 4xx sin reintento, offline, sin `VITE_API_URL`, pull que descarta registros invalidos.
- `hooks/useSyncedAppState.disabled.test.tsx`: **modo sin variables = identico a `useLocalStorage`**, sin red ni IndexedDB, `AuthModal` sin cambios.
- `hooks/useSyncedAppState.enabled.test.tsx`: integracion hook + motor + API simulada; limpieza al cerrar sesion.
- `sync/__tests__/leaderAndBadge.test.ts`: relevo de lider, textos del indicador, relevo con cola persistida.
Los adaptadores usados son falsos (`sync/__tests__/helpers.ts`); los reales de `sync/adapters/*` siguen siendo stubs de la Ola 3 (no emiten ni aplican nada, por lo que hoy el motor no sincroniza datos aunque haya sesion).

## 7. Deuda / pendiente
- Sin pull periodico (solo inicio, foco, `online` y reintentos): evita mantener despierta la API gratuita. Facil de anadir.
- Los cambios `rejected` (400/413 aislados) se muestran en el contador pero no hay UI para reintentarlos.
- `applied` sin coleccion: si dos colecciones usaran el mismo id en el mismo lote, se asume aplicado salvo que aparezca en `conflicts`.
- Los singletons (perfil, work-shift…) hacen LWW sobre el objeto entero (limitacion del contrato).
- Verificado solo con API simulada y jsdom; no se probo contra Supabase real, Render ni el servidor de SYNC-API, ni el redirect OAuth en navegador.
- `Navbar`/`App` no muestran aun el boton de cerrar sesion de la nube mas alla de lo que ya hace `handleLogout`.
