# Arquitectura

<!-- RELLENAR. Mantenlo como un mapa: qué piezas hay y cómo se hablan, no el detalle del código. -->

## Vista general
```
[Navegador] → apps/web → (HTTP/JSON) → apps/api → [Base de datos]
                                            ↘ [Servicios externos]
```

## Piezas
| Pieza       | Ubicación    | Responsabilidad |
|-------------|--------------|-----------------|
| Frontend    | `apps/web/`  |                 |
| Backend/API | `apps/api/`  |                 |
| Compartido  | `packages/`  | Tipos y contratos compartidos entre web y api |

## Contratos
Dónde se define la API (OpenAPI, tipos compartidos, etc.) y cómo se mantiene sincronizada.

## Datos
Base de datos, modelo principal y dónde viven las migraciones.

## Decisiones relevantes
Enlaza los ADRs de `docs/decisions/` que expliquen esta arquitectura.
