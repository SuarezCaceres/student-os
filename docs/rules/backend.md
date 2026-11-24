# Reglas del backend

Generales, valen para cualquier lenguaje. Lo específico del stack está en `docs/stack/backend.md`.

## Capas
- Separa transporte (rutas/controladores), lógica (servicios) y acceso a datos (repositorios).
- Los controladores no contienen lógica de negocio. Los servicios no conocen HTTP.

## Validación y errores
- Valida toda entrada en el borde (body, query, params) con un esquema. Nunca confíes en el cliente.
- Usa un formato de error uniforme, p. ej. `{ "error": { "code": "...", "message": "..." } }`, con códigos HTTP correctos.
- No expongas trazas, SQL ni detalles internos en las respuestas.

## Datos
- Todo cambio de esquema se hace con una migración versionada. **Pregunta antes de crearla.**
- Las migraciones nunca se editan después de aplicarse: crea una nueva.
- Consultas paginadas por defecto en los listados.

## API
- Mantén el contrato (tipos compartidos u OpenAPI) sincronizado en el mismo PR que cambia un endpoint.
- No rompas endpoints existentes sin versionar o sin acordarlo.

## Observabilidad
- Registra en los logs los errores con contexto (id de petición), nunca datos sensibles.

## Convenciones observadas en el código (pendientes de confirmar)
- (observado) **Autenticación por defecto:** el `SupabaseJwtGuard` es global; una ruta pública se marca con `@Public()`. El `userId` sale de `@CurrentUser()`, nunca del body ni de la query.
- (observado) **Validación con zod:** los esquemas del contrato viven en `packages/shared`; el entorno se valida en `apps/api/src/config/env.schema.ts`. Los errores de payload devuelven 400 con líneas `ruta: mensaje`, sin eco del valor recibido.
- (observado) **Repositorios con interfaz e implementación en memoria:** cada servicio con datos depende de una interfaz (`SyncRepository`, `GoogleRepository`, repositorio de cuenta) con una versión Prisma y otra `InMemory*` para las pruebas unitarias.
- (observado) **Reloj inyectable** (`SYNC_CLOCK`) para probar lógica dependiente del tiempo.
- (observado) **Ganchos de cuenta:** un módulo con datos de usuario registra su borrado y exportación (`registerAccountDeletionHook`, `registerAccountExportContributor`); ver `docs/rules/security.md`.
- (observado) **Constantes de límites** en un archivo propio por módulo (`sync.constants.ts`, `google.constants.ts`), no dispersas.
- (observado) **Las pruebas unitarias** son `*.spec.ts` junto al código; las de integración están en `apps/api/test/*.e2e-spec.ts`.

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
