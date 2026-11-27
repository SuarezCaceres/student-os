import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ejecutarVerificacion } from './helpers/verificar-produccion';

/**
 * Script `scripts/verificar-produccion.mjs` contra servidores HTTP falsos levantados en la prueba (puerto efímero).
 * La versión contra la API real con Postgres embebido está en `public.e2e-spec.ts`.
 */
jest.setTimeout(60_000);

interface Peticion {
  method: string;
  url: string;
  authorization?: string;
  cookie?: string;
}

type Manejador = (req: IncomingMessage, res: ServerResponse) => void;

interface ServidorFalso {
  url: string;
  peticiones: Peticion[];
  close: () => Promise<void>;
}

async function servidorFalso(manejar: Manejador): Promise<ServidorFalso> {
  const peticiones: Peticion[] = [];
  const server: Server = createServer((req, res) => {
    peticiones.push({
      method: req.method ?? '',
      url: req.url ?? '',
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    });
    manejar(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    peticiones,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

/** API bien configurada: salud y preparación en 200, rutas protegidas en 401 y CORS solo para su web. */
const apiSana: Manejador = (req, res) => {
  const origen = req.headers.origin;
  const cors: Record<string, string> = origen === 'https://studentos.example' ? { 'access-control-allow-origin': origen } : {};
  if (req.url === '/health') return json(res, 200, { status: 'ok', uptime: 1, version: '0.1.0' }, cors);
  if (req.url === '/health/ready') return json(res, 200, { status: 'ok', db: 'ok' }, cors);
  if (req.url === '/profile') return json(res, 401, { statusCode: 401, error: 'Unauthorized' }, cors);
  return json(res, 404, { statusCode: 404 }, cors);
};

/** API mal configurada: base caída, ruta protegida abierta y CORS que refleja cualquier origen. */
const apiRota: Manejador = (req, res) => {
  const cors = { 'access-control-allow-origin': req.headers.origin ?? '*' };
  if (req.url === '/health') return json(res, 200, { status: 'ok' }, cors);
  if (req.url === '/health/ready') return json(res, 503, { status: 'error', db: 'error' }, cors);
  if (req.url === '/profile') return json(res, 200, { id: 'filtrado' }, cors);
  return json(res, 404, {}, cors);
};

const webSana: Manejador = (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>StudentOS</title>');
};

const webCaida: Manejador = (_req, res) => {
  res.writeHead(502);
  res.end();
};

describe('scripts/verificar-produccion.mjs', () => {
  const abiertos: ServidorFalso[] = [];
  async function levantar(manejar: Manejador): Promise<ServidorFalso> {
    const servidor = await servidorFalso(manejar);
    abiertos.push(servidor);
    return servidor;
  }

  afterEach(async () => {
    await Promise.all(abiertos.splice(0).map((s) => s.close()));
  });

  it('con un despliegue sano marca las cinco comprobaciones con ✔ y sale con 0', async () => {
    const api = await levantar(apiSana);
    const web = await levantar(webSana);

    const { code, stdout } = await ejecutarVerificacion(['--api', api.url, '--web', web.url]);

    expect(code).toBe(0);
    expect(stdout.match(/^✔ /gm)).toHaveLength(6); // 5 comprobaciones + resumen
    expect(stdout).not.toContain('✘');
    expect(stdout).toContain('✔ Todo pasa.');
  });

  it('acepta las URL por las variables API_URL y WEB_URL (con barra final)', async () => {
    const api = await levantar(apiSana);
    const web = await levantar(webSana);

    const { code } = await ejecutarVerificacion([], { API_URL: `${api.url}/`, WEB_URL: `${web.url}/` });

    expect(code).toBe(0);
    expect(api.peticiones.map((p) => p.url)).toEqual(['/health', '/health/ready', '/profile', '/health']);
  });

  it('es de solo lectura: solo hace GET y nunca envía credenciales ni cookies', async () => {
    const api = await levantar(apiSana);
    const web = await levantar(webSana);

    await ejecutarVerificacion(['--api', api.url, '--web', web.url]);

    const todas = [...api.peticiones, ...web.peticiones];
    expect(todas.length).toBeGreaterThanOrEqual(5);
    expect(todas.every((p) => p.method === 'GET')).toBe(true);
    expect(todas.every((p) => p.authorization === undefined && p.cookie === undefined)).toBe(true);
  });

  it('con un despliegue mal configurado marca cada fallo con ✘ y sale con un código distinto de 0', async () => {
    const api = await levantar(apiRota);
    const web = await levantar(webCaida);

    const { code, stdout } = await ejecutarVerificacion(['--api', api.url, '--web', web.url]);

    expect(code).toBe(1);
    expect(stdout).toMatch(/^✔ GET \/health responde 200/m);
    expect(stdout).toMatch(/^✘ GET \/health\/ready .*: respondió 503$/m);
    expect(stdout).toMatch(/^✘ GET \/profile sin token responde 401: respondió 200$/m);
    expect(stdout).toMatch(/^✘ CORS no autoriza un origen no listado: devolvió Access-Control-Allow-Origin/m);
    expect(stdout).toMatch(/^✘ La web responde 200: respondió 502$/m);
    expect(stdout).toContain('✘ 4 comprobación(es) fallaron.');
    // No vuelca el cuerpo de las respuestas.
    expect(stdout).not.toContain('filtrado');
  });

  it('si la API no responde lo dice en español y falla', async () => {
    const web = await levantar(webSana);
    const apagada = await servidorFalso(apiSana);
    await apagada.close(); // puerto libre: conexión rechazada

    const { code, stdout } = await ejecutarVerificacion(['--api', apagada.url, '--web', web.url]);

    expect(code).toBe(1);
    expect(stdout).toMatch(/^✘ GET \/health responde 200 con status ok: no se pudo conectar/m);
    expect(stdout).toMatch(/^✔ La web responde 200$/m);
  });

  it('sin URL explica el uso y sale con 2', async () => {
    const { code, stdout } = await ejecutarVerificacion([]);

    expect(code).toBe(2);
    expect(stdout).toContain('Falta API_URL');
    expect(stdout).toContain('Uso:');
  });

  it('rechaza URL con credenciales incrustadas sin imprimirlas', async () => {
    const { code, stdout } = await ejecutarVerificacion([
      '--api',
      'https://usuario:SUPER-SECRETO@api.example.com',
      '--web',
      'https://studentos.example',
    ]);

    expect(code).toBe(2);
    expect(stdout).toContain('API_URL no debe llevar credenciales');
    expect(stdout).not.toContain('SUPER-SECRETO');
  });
});
