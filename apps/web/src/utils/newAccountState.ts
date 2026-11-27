import type { AppState } from '../types';
import { applyRealAccountCalendarCleanup } from './accountDataCleanup';

/** Nombre que Google guarda en la cuenta (`full_name` o `name`), o `undefined` si no hay. */
export function getAccountDisplayName(user: { user_metadata?: unknown } | null | undefined): string | undefined {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
  return name.trim() || undefined;
}

/**
 * Estado con el que arranca una cuenta que la nube aun no conoce (spec 009 y 010): el de partida (`emptyAppState`, vacio) SIN los bloques de
 * horario de ejemplo y con el nombre de pila de su cuenta de Google. Es una funcion pura: el mismo resultado en cada
 * dispositivo, de modo que el segundo dispositivo de una cuenta nueva no discrepa del primero.
 */
export function buildNewAccountState(base: AppState, displayName?: string): AppState {
  const cleaned = applyRealAccountCalendarCleanup(base);
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? { ...cleaned, studentName: firstName } : cleaned;
}
