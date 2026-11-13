/**
 * Registro estatico de "ganchos de borrado de cuenta".
 *
 * Por que existe: el borrado de cuenta (agente PUBLIC) debe limpiar datos que pertenecen a otros
 * modulos (p. ej. el token de Google del agente GOOGLE) SIN que PUBLIC importe esos modulos ni que
 * nadie edite `app.module.ts`. Cada modulo se registra a si mismo en `onModuleInit`:
 *
 *   onModuleInit() {
 *     registerAccountDeletionHook({ name: 'google', run: (userId) => this.disconnectAndForget(userId) });
 *   }
 *
 * PUBLIC ejecuta `runAccountDeletionHooks(userId)` ANTES de borrar el perfil y los registros de sync.
 * Un gancho debe ser idempotente. Si un gancho falla, el borrado de cuenta NO debe continuar en silencio:
 * `runAccountDeletionHooks` devuelve el detalle para que el llamador decida.
 */
export interface AccountDeletionHook {
  /** Nombre corto y unico del modulo (se usa en logs y en el informe de borrado). */
  name: string;
  /** Debe borrar/revocar todo lo que el modulo guarde del usuario. Idempotente. */
  run(userId: string): Promise<void>;
}

export interface AccountDeletionHookResult {
  name: string;
  ok: boolean;
  /** Mensaje generico, nunca datos sensibles. */
  error?: string;
}

const hooks = new Map<string, AccountDeletionHook>();

/** Registra (o reemplaza por nombre) un gancho. Idempotente: seguro de llamar en cada arranque. */
export function registerAccountDeletionHook(hook: AccountDeletionHook): void {
  hooks.set(hook.name, hook);
}

export function listAccountDeletionHooks(): string[] {
  return [...hooks.keys()];
}

/** Ejecuta todos los ganchos registrados; nunca lanza, devuelve el resultado de cada uno. */
export async function runAccountDeletionHooks(userId: string): Promise<AccountDeletionHookResult[]> {
  const results: AccountDeletionHookResult[] = [];
  for (const hook of hooks.values()) {
    try {
      await hook.run(userId);
      results.push({ name: hook.name, ok: true });
    } catch (error) {
      results.push({ name: hook.name, ok: false, error: error instanceof Error ? error.name : 'Error' });
    }
  }
  return results;
}

/** Solo para pruebas. */
export function clearAccountDeletionHooksForTests(): void {
  hooks.clear();
}
