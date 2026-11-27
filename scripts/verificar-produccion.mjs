#!/usr/bin/env node
// Verificación de SOLO LECTURA de un despliegue de StudentOS (plan 007, paso A1; criterios C2 y C3).
//
// Uso:
//   node scripts/verificar-produccion.mjs --api https://api.<dominio> --web https://<dominio>
//   API_URL=https://api.<dominio> WEB_URL=https://<dominio> node scripts/verificar-produccion.mjs
//
// Solo hace peticiones GET sin credenciales: no escribe nada, no necesita tokens ni secretos y no imprime el
// cuerpo de las respuestas. Sale con 0 si todo pasa, 1 si alguna comprobación falla y 2 si faltan argumentos.
// Opcional: VERIFICAR_TIMEOUT_MS (por defecto 60000; el plan gratuito de Render tarda en despertar).

import { pathToFileURL } from 'node:url';

/** Origen que ninguna lista blanca de CORS debería contener (`.invalid` está reservado y nunca resuelve). */
export const ORIGEN_NO_PERMITIDO = 'https://origen-no-permitido.invalid';

const AYUDA = `Uso: node scripts/verificar-produccion.mjs --api <URL de la API> --web <URL de la web>
     (o las variables API_URL y WEB_URL)`;

function leerArgumentos(argv, env) {
  const valores = { api: env.API_URL, web: env.WEB_URL };
  for (let i = 0; i < argv.length; i += 1) {
    const [nombre, enLinea] = argv[i].split(/=(.*)/s, 2);
    const clave = { '--api': 'api', '--api-url': 'api', '--web': 'web', '--web-url': 'web' }[nombre];
    if (!clave) throw new Error(`Argumento desconocido: ${nombre}`);
    const valor = enLinea ?? argv[(i += 1)];
    if (!valor) throw new Error(`Falta el valor de ${nombre}`);
    valores[clave] = valor;
  }
  return { api: normalizarUrl(valores.api, 'API_URL'), web: normalizarUrl(valores.web, 'WEB_URL') };
}

function normalizarUrl(valor, nombre) {
  if (!valor) throw new Error(`Falta ${nombre}`);
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nombre} no es una URL válida`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`${nombre} debe empezar por https://`);
  if (url.username || url.password) throw new Error(`${nombre} no debe llevar credenciales`);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

async function pedir(url, { timeoutMs, headers = {} }) {
  return fetch(url, { method: 'GET', headers, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
}

async function cuerpoJson(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    return undefined;
  }
}

/** Lista de comprobaciones. Cada una devuelve `null` si pasa o un motivo breve (sin datos de la respuesta) si falla. */
function comprobaciones({ api, web }, timeoutMs) {
  return [
    {
      nombre: 'GET /health responde 200 con status ok',
      ejecutar: async () => {
        const res = await pedir(`${api}/health`, { timeoutMs });
        if (res.status !== 200) return `respondió ${res.status}`;
        const body = await cuerpoJson(res);
        return body?.status === 'ok' ? null : 'el cuerpo no trae status "ok"';
      },
    },
    {
      nombre: 'GET /health/ready responde 200 (la API llega a la base de datos)',
      ejecutar: async () => {
        const res = await pedir(`${api}/health/ready`, { timeoutMs });
        if (res.status !== 200) return `respondió ${res.status}`;
        const body = await cuerpoJson(res);
        return body?.db === 'ok' ? null : 'el cuerpo no trae db "ok"';
      },
    },
    {
      nombre: 'GET /profile sin token responde 401',
      ejecutar: async () => {
        const res = await pedir(`${api}/profile`, { timeoutMs });
        return res.status === 401 ? null : `respondió ${res.status}`;
      },
    },
    {
      nombre: 'CORS no autoriza un origen no listado',
      ejecutar: async () => {
        const res = await pedir(`${api}/health`, { timeoutMs, headers: { Origin: ORIGEN_NO_PERMITIDO } });
        const permitido = res.headers.get('access-control-allow-origin');
        return permitido === null ? null : `devolvió Access-Control-Allow-Origin: ${permitido}`;
      },
    },
    {
      nombre: 'La web responde 200',
      ejecutar: async () => {
        const res = await pedir(web, { timeoutMs });
        return res.status === 200 ? null : `respondió ${res.status}`;
      },
    },
  ];
}

function motivoDeError(error) {
  if (error?.name === 'TimeoutError') return 'no respondió a tiempo';
  const causa = error?.cause?.code ?? error?.cause?.message;
  return causa ? `no se pudo conectar (${causa})` : 'no se pudo conectar';
}

export async function verificar({ argv = [], env = {}, log = console.log } = {}) {
  let urls;
  try {
    urls = leerArgumentos(argv, env);
  } catch (error) {
    log(`✘ ${error.message}\n${AYUDA}`);
    return 2;
  }
  const timeoutMs = Number(env.VERIFICAR_TIMEOUT_MS) > 0 ? Number(env.VERIFICAR_TIMEOUT_MS) : 60_000;

  log(`Verificando (solo lectura)\n  API: ${urls.api}\n  Web: ${urls.web}\n`);
  let fallos = 0;
  for (const { nombre, ejecutar } of comprobaciones(urls, timeoutMs)) {
    let motivo;
    try {
      motivo = await ejecutar();
    } catch (error) {
      motivo = motivoDeError(error);
    }
    if (motivo === null) {
      log(`✔ ${nombre}`);
    } else {
      fallos += 1;
      log(`✘ ${nombre}: ${motivo}`);
    }
  }
  log(fallos === 0 ? '\n✔ Todo pasa.' : `\n✘ ${fallos} comprobación(es) fallaron.`);
  return fallos === 0 ? 0 : 1;
}

// Solo al ejecutarlo directamente (no al importarlo).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await verificar({ argv: process.argv.slice(2), env: process.env });
}
