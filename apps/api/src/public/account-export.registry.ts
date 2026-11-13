/**
 * Registro estatico de "contribuyentes a la exportacion de cuenta" (gemelo de `common/account-deletion.ts`).
 *
 * Un modulo con datos propios del usuario (p. ej. GOOGLE: correo de la cuenta conectada y fecha de conexion)
 * puede anadirlos al archivo de `GET /account/export` sin editar PUBLIC:
 *
 *   onModuleInit() {
 *     registerAccountExportContributor({ name: 'google', collect: (userId) => this.describeConnection(userId) });
 *   }
 *
 * REGLA: `collect` jamas debe devolver secretos (refresh tokens, claves de cifrado). Solo datos que el usuario
 * pueda ver y llevarse. Si un contribuyente falla, la exportacion NO falla: ese bloque se marca como no
 * disponible y se registra el nombre del modulo.
 */
export interface AccountExportContributor {
  /** Nombre corto y unico del modulo; es la clave dentro de `extras`. */
  name: string;
  collect(userId: string): Promise<unknown>;
}

const contributors = new Map<string, AccountExportContributor>();

export function registerAccountExportContributor(contributor: AccountExportContributor): void {
  contributors.set(contributor.name, contributor);
}

export function listAccountExportContributors(): AccountExportContributor[] {
  return [...contributors.values()];
}

/** Solo para pruebas. */
export function clearAccountExportContributorsForTests(): void {
  contributors.clear();
}
