---
name: frontend-proyecto
description: Úsala al crear o modificar código del frontend (apps/web): componentes, páginas, estilos, estado, formularios o llamadas a la API desde el cliente.
---

# Trabajo en el frontend

## Antes de empezar, lee
1. `docs/rules/frontend.md`: reglas obligatorias. **Mandan sobre todo lo demás.**
2. `docs/stack/frontend.md`: tecnologías, comandos y estructura de carpetas.
3. La spec y el plan de la funcionalidad, si existen (`docs/specs/NNN-*/`).
4. Si tienes dudas de *cómo* hacer algo: `docs/references/frontend/`.

## Skills de terceros
- Guías de UI/UX, accesibilidad, interacción y responsive: `.agents/skills/ui-ux-pro-max/SKILL.md`
- Dirección estética y tipografía al crear o rehacer pantallas: `.agents/skills/frontend-design/SKILL.md`
- Páginas de marketing y la landing (`apps/web/src/components/landing/`) **solo**, no la app interna: `.agents/skills/design-taste-frontend/SKILL.md`
- Pruebas E2E del navegador: ver la skill `pruebas-proyecto`.

Úsalas para la técnica. Si contradicen `docs/rules/frontend.md` o la identidad de marca de `PRODUCT.md` (terminología, tono sobrio, «cero burocracia»), gana lo del proyecto.

## Al trabajar
- Antes de crear un componente, busca uno existente que puedas reutilizar.
- Consume la API solo a través de la capa cliente y de los tipos de `packages/`.
- Contempla los estados de carga, error y vacío en cada vista que pida datos.
- Escribe o actualiza las pruebas con la skill `pruebas-proyecto`.

## Para terminar
- `./scripts/check.sh --rapido` pasa.
- Si el cambio es visible, comprueba en el navegador que funciona: no basta con que compile.
