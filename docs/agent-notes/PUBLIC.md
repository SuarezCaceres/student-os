# Notas del agente PUBLIC (Ola 3)

Rama: `feat/be-public-ready` (parte de `integration/backend`). Alcance: `apps/api/src/{public,common/security}/**`, `prisma/rls-baseline.sql` (solo se AÑADIÓ), tests propios, `apps/web/public/legal/**`, `components/{legal,account}/**`, `docs/google-verification-checklist.md` y este archivo. Sin dependencias nuevas, sin migraciones, sin tocar `app.module.ts`, `app.setup.ts`, `App.tsx` ni `package.json`.

## Qué se entregó

### API

| Ruta | Descripción |
| :-- | :-- |
| `GET /account/export` | JSON con perfil + registros de sync **no borrados** + `extras` de otros módulos. `Content-Disposition: attachment; filename="studentos-datos-AAAA-MM-DD.json"`, `Cache-Control: no-store`. Una sola lectura consistente (transacción `RepeatableRead`). |
| `DELETE /account` | Cuerpo obligatorio `{ "confirm": "BORRAR" }` (estricto, mayúsculas). Responde 200 `{ deleted, modules[], syncRecordsDeleted, profileDeleted, authUser: "not_deleted" }`. |

Ambas: protegidas por el guard JWT global, `userId` **siempre** del JWT (hay un test que envía `?userId=<otro>` y `X-User-Id`), límite **5 peticiones / 10 min por usuario y por ruta**.

**Orden del borrado** (`AccountService.deleteAccount`):
1. Validar confirmación (400 si falta o no coincide; no se toca nada).
2. `runAccountDeletionHooks(userId)` (registro de `common/account-deletion.ts`; GOOGLE se registra solo). Se ejecutan **todos**, aunque uno falle.
3. Si algún gancho falló: **424 Failed Dependency** y no se borra nada más. El cuerpo es `{ statusCode: 424, error, message: string[] }` con una línea por módulo (`"google: fallo (Error)"`, `"calendar: ok"`). Solo el *nombre de la clase* del error (`safeErrorSummary`): nunca el mensaje de la excepción (podría llevar tokens o correos). Se eligió un 4xx porque el filtro global (`AllExceptionsFilter`, de API-CORE) sustituye el mensaje de cualquier 5xx por uno genérico y se perdería el detalle por módulo.
4. `SyncService.deleteAllForUser` (registros + cursor, una transacción propia de SYNC-API).
5. `Profile` + `user_sync_state` en **una transacción** (`PrismaAccountRepository.deleteProfileData`).

Idempotencia y reintento: cada paso es idempotente (`deleteMany`, ganchos idempotentes por contrato), así que repetir `DELETE /account` tras cualquier fallo converge; la segunda llamada devuelve 200 con `syncRecordsDeleted: 0, profileDeleted: false`. Los pasos 4 y 5 son dos transacciones distintas (no se puede abarcar el repositorio de SYNC-API sin editarlo); si falla el 5 tras el 4, se reintenta y termina.

**Registro de contribuyentes a la exportación** (`public/account-export.registry.ts`, gemelo del de borrado): un módulo puede añadir datos suyos al archivo (`registerAccountExportContributor({ name, collect })`), p. ej. GOOGLE: correo de la cuenta conectada y fecha, **nunca el token**. Si un contribuyente falla, la exportación sigue y ese bloque queda `{ unavailable: true }`. Nadie lo usa todavía: **se lo debe pedir el Integrador a GOOGLE** (hoy `extras` va vacío en producción).

**`UserThrottlerGuard`** (`common/security/user-throttler.guard.ts`, exportado por `PublicModule`):
- Extiende `ThrottlerGuard`. Tracker = `user:<sub>` leído **solo** de `request.user` (lo rellena `SupabaseJwtGuard` tras verificar la firma); sin usuario, `ip:<ip>`. Nunca lee un token sin verificar (test incluido).
- Usa su propio limitador `user` (300/min por defecto) y sus propios contadores, ignorando los `ThrottlerModule` del módulo anfitrión. Por eso **no se suma** al límite global por IP (`default`, 120/min) y las rutas `/account` no castigan a toda una red universitaria con NAT (`@Throttle({ user: ... })` solo afecta a este guard).
- 429 con mensaje en español y `Retry-After` estándar (el limitador con nombre emitiría `Retry-After-user`, que el CORS de `app.setup.ts` no expone; `Retry-After` sí está en `exposedHeaders` y el cliente web ya lo lee).
- `AccountController` lo aplica con `@UseGuards(UserThrottlerGuard)` (los guards de controlador corren **después** de los globales, ya con `request.user`), así que los límites de `/account/*` funcionan **sin** que el Integrador haga nada.

**`common/security/`**: `SecurityHeadersInterceptor` (`Permissions-Policy`, `X-Robots-Tag`, y `Cache-Control: no-store` si la ruta no definió otro; no cambia cuerpo ni comportamiento; hoy solo lo usa `AccountController`), `pii.ts` (`redactPii`, `userRef` hash de 8 hex para logs, `safeErrorSummary`, `PII_LOG_REDACT_PATHS`), `index.ts`.

**RLS** (`rls-baseline.sql`, solo añadidos): paso 2b que nombra `profiles`, `sync_records`, `user_sync_state` y **falla en alto** si alguna existe sin RLS activa y forzada; paso 2c comentado para `google_connections` / `google_oauth_states` (nombres tentativos: ajustar a lo que defina `google.prisma`). El bucle original ya cubría todas las tablas. Un test ejecuta el script real contra Postgres (schema `dev_public`, roles `anon`/`authenticated` creados en el test) y comprueba RLS forzada, 0 privilegios para ambos roles e idempotencia.

### Web

- `public/legal/privacidad.html` y `terminos.html`: estáticas, autocontenidas, claro/oscuro por `prefers-color-scheme`, sin violeta, enlaces ≥ 44 px, texto ≥ 15 px. Revisadas en navegador (390 px, claro y oscuro). Marcadores amarillos a completar: **`[CORREO DE CONTACTO]`**, **`[NOMBRE DEL RESPONSABLE]`**, **`[PAÍS O JURISDICCIÓN]`**. No se inventó razón social, dirección ni plazos.
- `components/legal/LegalLinks.tsx`: `<LegalLinks layout="inline|stacked" />` (exporta también `PRIVACY_URL`, `TERMS_URL`).
- `components/account/AccountPanel.tsx` (+ `accountApi.ts`): tarjeta "Tus datos y tu cuenta" con *Descargar mis datos* y *Borrar mi cuenta* (modal con confirmación escrita `BORRAR`). Devuelve `null` si `!isSyncConfigured()` o no hay sesión. Usa `getApiClient().request` (reintentos/backoff existentes) y mensajes en español por tipo de error (429 → "espera N minutos", 424 → nombra el servicio que falló y dice que no se borró nada). Tras borrar: `clearSyncDataOnSignOut(userId)` + `signOut()` inmediatos (para que el motor no vuelva a subir nada) y luego callbacks.

## Cambios que debe hacer el Integrador

1. **(Opcional) límite general por usuario.** En `apps/api/src/app.module.ts`, `providers`, **después** de `SupabaseJwtGuard`:
   ```ts
   import { UserThrottlerGuard } from './common/security/user-throttler.guard';
   // ...
   { provide: APP_GUARD, useClass: ThrottlerGuard },       // existente: IP, antes de autenticar
   { provide: APP_GUARD, useClass: SupabaseJwtGuard },     // existente
   { provide: APP_GUARD, useClass: UserThrottlerGuard },   // NUEVO: por usuario (300/min), ya autenticado
   ```
   Debe ir tras el guard JWT; antes de él el tracker caería siempre a la IP. Las rutas `/account/*` ya van limitadas sin esto. Si se registra también globalmente no hay doble conteo: el guard del `AccountController` (almacén de `PublicModule`) y el global (almacén de `AppModule`) llevan contadores separados, y ambos aplican el mismo `@Throttle` de la ruta.

2. **(Opcional) `SecurityHeadersInterceptor` global:** `{ provide: APP_INTERCEPTOR, useClass: SecurityHeadersInterceptor }`.
3. **Montar componentes** (`App.tsx` / pie):
   - `<LegalLinks />` en `LandingFooter` y en el pie de la app (Google exige el enlace visible en la home).
   - `<AccountPanel onAccountDeleted={...} onClearLocalData={...} />` en la vista de ajustes/perfil. `onClearLocalData` debe reiniciar el estado local (p. ej. el `reset` de `useSyncedAppState`) y `onAccountDeleted` llevar a la landing. Si no se pasa `onClearLocalData`, el modal no ofrece borrar lo local.
4. **Ejecutar `rls-baseline.sql`** tras la migración (ya lo pedía API-CORE).
5. **Completar los marcadores** de `apps/web/public/legal/*.html` y desplegar en dominio propio (ver `docs/google-verification-checklist.md`).
6. **GOOGLE** debe registrar su gancho: `registerAccountDeletionHook({ name: 'google', run })` (revocar token en Google **y** borrar la fila) y, si quiere, el contribuyente de exportación. Sin eso, "borrar cuenta" **no** revoca el token de Google (el criterio de salida del plan: "borrar cuenta elimina todos los datos y revoca el token de Google" depende de ese gancho).
7. Si algún día se añade un rewrite SPA en `vercel.json`, excluir `/legal/*`.

## Decisión: el usuario de Supabase Auth NO se borra aquí

Borrar `auth.users` exige la clave `service_role` (Admin API). Regla del plan: la `service_role` no se guarda en este servicio. Consecuencias y salida:
- `DELETE /account` borra todos los datos de la app y responde `authUser: "not_deleted"`; el cliente cierra sesión.
- El registro de acceso (correo/identidad de Google) queda en Supabase Auth. La política de privacidad lo dice y ofrece borrarlo a petición por correo.
- **Paso manual** (por solicitud): Supabase Dashboard → Authentication → Users → eliminar el usuario, o desde el conector Supabase.
- **Mejora futura**: una Edge Function de Supabase (donde `service_role` ya existe como secreto del proyecto) invocada por el gancho de borrado, o una variable `SUPABASE_SERVICE_ROLE_KEY` solo en Render si el dueño decide asumirlo. No se implementó.
- Mientras el usuario de Auth exista, el mismo JWT sigue siendo válido: una petición posterior de sync recrea un `Profile` vacío (probado: tras borrar, `pull` devuelve vacío). El cliente debe cerrar sesión (lo hace `AccountPanel`).

## Revisión de seguridad (documentada; no se cambió código ajeno)

| Tema | Estado |
| :-- | :-- |
| CORS | Lista blanca `WEB_ORIGINS` (obligatoria en producción), `credentials: false`, métodos incluyen `DELETE`, cabeceras permitidas `Authorization, Content-Type, Accept, X-Request-Id`, expone `Retry-After`. `Content-Disposition` no se expone: el cliente web pone su propio nombre de archivo. OK. |
| Cookies | No se usan (auth por cabecera `Bearer`); sin CSRF aplicable. La sesión de Supabase vive en `localStorage` del navegador. |
| Cuerpo | JSON limitado a 1 MB global (`app.setup.ts`). `/account` solo necesita unos bytes. El filtro global ya mapea el 413/400 de body-parser a 4xx (la nota de SYNC-API sobre un 500 está obsoleta). |
| Cabeceras | `helmet()` activo (HSTS, nosniff, frameguard, etc.) + interceptor adicional. |
| Logging sin PII | `authorization`/`cookie`/`set-cookie` redactados; no se loguean cuerpos; `/health` no se loguea; los 5xx devuelven mensaje genérico (detalle solo en log). El borrado/exportación loguean `userRef` (hash de 8 hex), nunca id ni correo. `PII_LOG_REDACT_PATHS` lista rutas extra por si el Integrador amplía la redacción de `pino`. |
| Rate limit | En memoria por instancia (una sola instancia en Render free). Si se escala a varias, mover el *storage* de `@nestjs/throttler` a Redis. |
| Proxy | `trust proxy = 1` (Render): la IP del respaldo es la real. |

## Pruebas (todas verdes; salida real en el informe final)

- Jest unitarias: `src/common/security/security.spec.ts` (PII, interceptor, tracker del guard), `src/public/account.service.spec.ts` (confirmación, orden gancho→sync→perfil, aislamiento A/B, idempotencia, fallo de gancho + reintento, fallo posterior, exportación, extras).
- e2e `test/public.e2e-spec.ts` con **Postgres real** (`embedded-postgres`, puerto **54335**, schema `dev_public`, `prisma db push`, sin migraciones ni Supabase), `AppModule` completo, guard JWT real con JWKS local: 401, exportación solo del propio usuario (+ tombstones fuera, userId ajeno ignorado), confirmación obligatoria, borrado completo A vs. B intacto (filas idénticas), idempotencia, fallo de gancho (424, sin datos sensibles, reintento), rate limiting por usuario (429 + `Retry-After`, otro usuario en la misma IP no afectado), `rls-baseline.sql`.
- Web (Vitest): `accountApi.test.ts`, `AccountPanel.test.tsx` (jsdom), `LegalLinks.test.tsx`.
- Helpers propios: `test/helpers/public-pg.ts` y `public-pg-server.mjs` (copia del patrón de `sync-pg*`, otro puerto).

## Variables de entorno nuevas

Ninguna.

## Qué quedó sin verificar

- Nada se probó contra Supabase real, Render ni Google reales (sin credenciales por regla). `RepeatableRead` interactivo vía pooler (`pgbouncer=true`, transaction mode) no se probó; si diera problemas en Supabase, bajar a la transacción por defecto (solo pierde la foto consistente de la exportación).
- `AccountPanel` solo se probó con jsdom y API simulada; **no** montado en `App.tsx` (prohibido) ni revisado visualmente en el navegador con la app corriendo. Las páginas legales sí se vieron en navegador (móvil, claro y oscuro).
- Los textos legales no tienen revisión jurídica; reflejan lo que la app hace según el plan (incluida la conexión de Calendar con token cifrado en servidor del agente GOOGLE, que aún no está fusionada: hoy el código web usa un token en el navegador). Re-revisar `privacidad.html` §3 cuando se fusione GOOGLE.
- Registro global de `UserThrottlerGuard` como `APP_GUARD`: no se probó (no se puede editar `app.module.ts`); solo se probó su uso por `@UseGuards`.
- Clasificación de los scopes de Calendar como "sensibles" y el scope mínimo aceptado por cada endpoint: dicho de memoria, **confirmar** en la consola/documentación de Google (el checklist lo marca).
- Cuántos usuarios cuenta Google para el tope de 100: confirmar en la consola.

## Deuda y avisos

1. **Google Fonts** (`index.html`, prohibido para PUBLIC) carga fuentes desde servidores de Google: envía la IP del visitante a un tercero. Está declarado en la política de privacidad; lo más limpio es autoalojar las fuentes (y entonces quitar esa línea del apartado 5).
2. Carrera tras borrar: si el motor de sync tenía un push en vuelo, podría recrear datos un instante después. `AccountPanel` cierra sesión nada más recibir el 200, lo que lo hace improbable pero no imposible; un borrado definitivo por la vía "borrar usuario de Auth" (ver arriba) la elimina del todo.
3. Los tombstones no se purgan (ya anotado por SYNC-API); el borrado de cuenta sí los elimina.
4. Sin cuotas por cuenta más allá de las de SYNC-API (5000 registros, 64 KB por registro) y de los límites de frecuencia; no hay tabla de cuotas (PUBLIC no tiene `.prisma` propio).
5. El e2e arranca un Postgres embebido (~15 s) además del de SYNC-API; los dos usan puertos distintos (54329 / 54335) y pueden correr en paralelo.
6. `UserThrottlerGuard` en memoria: contadores por instancia y se reinician al reiniciar el servicio.
