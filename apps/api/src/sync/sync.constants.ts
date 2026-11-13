/**
 * Limites y constantes del motor de sync. Los limites de PETICION (`MAX_PUSH_CHANGES`, `MAX_PULL_LIMIT`) viven
 * en `@student-os/shared` (contrato web <-> api); aqui van los de ALMACENAMIENTO, que solo conoce el servidor.
 */

/** Tamano maximo del JSON (`JSON.stringify`, en bytes UTF-8) de `data` de UN registro. Excederlo -> 413. */
export const MAX_RECORD_DATA_BYTES = 64 * 1024;

/**
 * Cuota de filas por usuario en `sync_records`. Los tombstones CUENTAN (siguen ocupando fila). Un push que
 * no crea filas nuevas (editar o borrar lo ya existente) nunca se rechaza por cuota. Excederla -> 422.
 */
export const MAX_RECORDS_PER_USER = 5000;

/** Un `updatedAt` / `deletedAt` del cliente posterior a `ahora + 5 min` se recorta a `ahora` (reloj adelantado). */
export const MAX_CLIENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

/** `limit` por defecto de `GET /sync/pull` cuando el cliente no lo indica (el maximo es `MAX_PULL_LIMIT`). */
export const DEFAULT_PULL_LIMIT = 500;

/** Cursor inicial: "desde el principio". */
export const INITIAL_CURSOR = '0';

/** Un cursor es el `seq` en decimal (opaco para el cliente). Hasta 18 digitos caben en un BigInt/int8. */
export const CURSOR_PATTERN = /^\d{1,18}$/;

/** Tokens de inyeccion. */
export const SYNC_REPOSITORY = Symbol('SYNC_REPOSITORY');
export const SYNC_CLOCK = Symbol('SYNC_CLOCK');
