# Reglas del frontend

Generales, valen para cualquier framework. Lo específico del stack está en `docs/stack/frontend.md`.

## Componentes
- Componentes pequeños y con una sola responsabilidad. Si pasa de ~200 líneas, divídelo.
- La lógica de negocio y las llamadas a la API no van en los componentes de presentación: van en servicios, hooks o stores.
- Reutiliza los componentes de UI existentes antes de crear uno nuevo.

## Datos y API
- Todas las llamadas al backend pasan por una única capa cliente (p. ej. `src/lib/api/`). Nada de `fetch` disperso.
- Usa los tipos compartidos de `packages/` para las respuestas de la API. No los dupliques.
- Gestiona siempre los tres estados: cargando, error y vacío.

## Accesibilidad y UX
- HTML semántico, etiquetas en los formularios, `alt` en las imágenes y navegación con teclado.
- Los mensajes de error deben ser útiles para el usuario, no trazas técnicas.

## Rendimiento
- No añadas dependencias pesadas para resolver problemas pequeños (pregunta antes, ver AGENTS.md).
- Carga diferida para rutas y componentes grandes.

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
