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

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
