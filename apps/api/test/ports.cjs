// Puertos FIJOS de todas las pruebas (integracion del API y E2E). UNICA fuente de verdad.
//
// Para que varias sesiones/agentes puedan correr pruebas a la vez en la misma maquina, TODOS se desplazan con una
// sola variable de entorno:
//
//   E2E_PORT_OFFSET=2000 ./scripts/check.sh          (entero >= 0; por defecto 0 = puertos de siempre)
//
// Cada sesion usa un desplazamiento distinto (p. ej. 0, 100, 200...). Con 0 los puertos son EXACTAMENTE los
// historicos. Es CommonJS a proposito: lo importan por igual Jest (TypeScript, CJS), los `.mjs` del arnes y la
// suite Playwright de apps/web (ESM). No tiene dependencias.
'use strict';

/** Puertos base (los historicos). Añadir uno nuevo aqui basta para que tambien lo desplace la variable. */
const BASE_PORTS = Object.freeze({
  // Integracion del API (apps/api/test/helpers/*-pg.ts): un Postgres embebido por suite
  syncPg: 54329,
  googlePg: 54334,
  publicPg: 54335,
  // E2E (apps/api/test/e2e-harness/stack.mjs)
  pg: 54340,
  supabase: 54341,
  google: 54342,
  control: 54343,
  api: 3100,
  web: 5293,
  webNoCloud: 5294,
});

const MAX_PORT = 65535;

/** Valida el desplazamiento: entero >= 0 (vacio o ausente = 0). Lanza si es otra cosa, para no probar en puertos raros. */
function parseOffset(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`E2E_PORT_OFFSET debe ser un entero >= 0 (recibido "${text}")`);
  }
  return Number(text);
}

/** Suma `offset` a cada puerto de `base` y comprueba que sigue siendo un puerto valido. */
function shiftPorts(base, offset) {
  const out = {};
  for (const [name, port] of Object.entries(base)) {
    const shifted = port + offset;
    if (shifted > MAX_PORT) {
      throw new Error(`E2E_PORT_OFFSET=${offset} saca el puerto "${name}" de rango (${port} + ${offset} > ${MAX_PORT})`);
    }
    out[name] = shifted;
  }
  return Object.freeze(out);
}

const PORT_OFFSET = parseOffset(process.env.E2E_PORT_OFFSET);
/** Puertos efectivos de esta ejecucion (base + E2E_PORT_OFFSET). */
const TEST_PORTS = shiftPorts(BASE_PORTS, PORT_OFFSET);

module.exports = { BASE_PORTS, PORT_OFFSET, TEST_PORTS, parseOffset, shiftPorts };
