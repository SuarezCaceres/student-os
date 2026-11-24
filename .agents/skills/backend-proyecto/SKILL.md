---
name: backend-proyecto
description: Úsala al crear o modificar código del backend (apps/api): endpoints, servicios, modelos, base de datos, migraciones, autenticación o integraciones con servicios externos.
---

# Trabajo en el backend

## Antes de empezar, lee
1. `docs/rules/backend.md` y `docs/rules/security.md`: reglas obligatorias. **Mandan sobre todo lo demás.**
2. `docs/stack/backend.md`: tecnologías, comandos y estructura de carpetas.
3. La spec y el plan de la funcionalidad, si existen (`docs/specs/NNN-*/`).
4. Si tienes dudas de *cómo* hacer algo: `docs/references/backend/`.

## Skills de terceros
Ninguna instalada todavía (decisión del humano, 2026-11-23: se pospone NestJS, Supabase/Postgres y Prisma). Para el backend se aplican solo `docs/rules/backend.md` y `docs/rules/security.md`, y las notas de los agentes en `docs/agent-notes/` (sync, Google, cuenta pública).

Antes de añadir una skill nueva, usa `find-skills` y pide permiso: instalar ejecuta código de terceros.

## Al trabajar
- Respeta las capas: controlador → servicio → repositorio.
- Valida la entrada con un esquema en el borde y usa el formato de error común.
- ¿Cambia el esquema de datos? **Pregunta** antes de crear la migración.
- Actualiza el contrato compartido (`packages/` u OpenAPI) en el mismo cambio.
- Escribe o actualiza las pruebas con la skill `pruebas-proyecto`: unitarias para los servicios y de integración para los endpoints.

## Para terminar
- `./scripts/check.sh --rapido` pasa.
- Prueba al menos una petición real al endpoint (con el cliente HTTP o la prueba de integración).
