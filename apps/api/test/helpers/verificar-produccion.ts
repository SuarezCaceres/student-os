import { execFile } from 'node:child_process';
import { join } from 'node:path';

/** Ruta del script de verificación de solo lectura (plan 007, paso A1). */
export const VERIFICAR_PRODUCCION = join(__dirname, '..', '..', '..', '..', 'scripts', 'verificar-produccion.mjs');

export interface ResultadoVerificacion {
  code: number;
  stdout: string;
}

/**
 * Ejecuta el script como lo haría una persona (proceso hijo de Node) y devuelve su código de salida y su salida.
 * Asíncrono a propósito: los servidores contra los que se verifica viven en este mismo proceso.
 */
export function ejecutarVerificacion(args: string[], env: Record<string, string> = {}): Promise<ResultadoVerificacion> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [VERIFICAR_PRODUCCION, ...args],
      // Entorno mínimo: el script no debe depender de variables ni secretos del proceso de pruebas.
      { env: { PATH: process.env.PATH ?? '', VERIFICAR_TIMEOUT_MS: '5000', ...env }, timeout: 60_000 },
      (error, stdout) => {
        if (error && typeof error.code !== 'number') {
          reject(error);
          return;
        }
        resolve({ code: error ? Number(error.code) : 0, stdout });
      },
    );
  });
}
