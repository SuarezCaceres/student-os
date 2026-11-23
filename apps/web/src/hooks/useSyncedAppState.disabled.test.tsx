// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthModal } from '../components/auth/AuthModal';
import { useAuthState } from '../components/auth/useAuthState';
import { SyncStatusBadge } from '../components/sync/SyncStatusBadge';
import { initialData } from '../data/initialData';
import { getApiClient } from '../services/api';
import { __resetSupabaseForTests, getSupabase, isSyncConfigured } from '../services/supabase';
import { syncStore } from '../sync/syncStore';
import { useLocalStorage } from './useLocalStorage';
import { useSyncedAppState } from './useSyncedAppState';

/**
 * Requisito critico: sin VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_API_URL la app se
 * comporta EXACTAMENTE como hoy (solo localStorage, sin red, sin IndexedDB, sin login obligatorio).
 */
describe('sin variables de entorno de Supabase/API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_API_URL', '');
    __resetSupabaseForTests();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('la configuracion de nube queda desactivada y no hay cliente', async () => {
    expect(isSyncConfigured()).toBe(false);
    expect(getApiClient()).toBeNull();
    await expect(getSupabase()).resolves.toBeNull();
  });

  it('useSyncedAppState se comporta igual que useLocalStorage (estado, escritura y reset)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const synced = renderHook(() => useSyncedAppState('synced_key', initialData));
    const plain = renderHook(() => useLocalStorage('plain_key', initialData));

    expect(synced.result.current[0]).toEqual(plain.result.current[0]);

    const edit = (s: typeof initialData) => ({ ...s, studentName: 'Ana', streak: s.streak + 1 });
    act(() => synced.result.current[1](edit));
    act(() => plain.result.current[1](edit));
    expect(synced.result.current[0]).toEqual(plain.result.current[0]);
    expect(window.localStorage.getItem('synced_key')).toBe(window.localStorage.getItem('plain_key'));

    // Varias actualizaciones funcionales seguidas se encadenan igual que en React.
    act(() => {
      synced.result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
      synced.result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
      plain.result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
      plain.result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
    });
    expect(synced.result.current[0].streak).toBe(plain.result.current[0].streak);

    act(() => synced.result.current[2]());
    act(() => plain.result.current[2]());
    expect(synced.result.current[0]).toEqual(plain.result.current[0]);
    expect(window.localStorage.getItem('synced_key')).toBe(window.localStorage.getItem('plain_key'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(syncStore.getSnapshot().enabled).toBe(false);
    expect(typeof indexedDB).toBe('undefined'); // jsdom no trae IndexedDB: si se tocara, fallaria
  });

  it('lee el estado guardado al iniciar y por defecto usa la clave student_os_state_v1', () => {
    window.localStorage.setItem('student_os_state_v1', JSON.stringify({ ...initialData, studentName: 'Guardado' }));
    const { result } = renderHook(() => useSyncedAppState(initialData));
    expect(result.current[0].studentName).toBe('Guardado');
    act(() => result.current[1]((s) => ({ ...s, career: 'Otra' })));
    expect(JSON.parse(window.localStorage.getItem('student_os_state_v1')!).career).toBe('Otra');
  });

  it('JSON corrupto en localStorage cae al estado inicial, como useLocalStorage', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem('student_os_state_v1', '{no es json');
    const { result } = renderHook(() => useSyncedAppState(initialData));
    expect(result.current[0]).toEqual(initialData);
  });

  it('useAuthState informa nube desactivada; el indicador no pinta nada', () => {
    const auth = renderHook(() => useAuthState());
    expect(auth.result.current.cloudAvailable).toBe(false);
    expect(auth.result.current.status).toBe('disabled');
    expect(auth.result.current.userSession).toBeNull();

    const { container } = render(<SyncStatusBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('AuthModal conserva el aspecto y el flujo de siempre (sin boton de nube)', () => {
    render(<AuthModal isOpen onClose={() => undefined} onSuccess={() => undefined} onEnterDemo={() => undefined} />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.queryByText('Guarda en la nube')).toBeNull();
    expect(screen.getByText('Entrar a StudentOS')).toBeTruthy();
    expect(screen.getByText(/Modo Demo/)).toBeTruthy();
  });

  it('AuthModal con cloudAuth ofrece Google en la nube y mantiene el acceso con Google Calendar', () => {
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} onSuccess={() => undefined} onEnterDemo={() => undefined} />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    expect(screen.getByText('Guarda en la nube')).toBeTruthy();
    expect(screen.getByText('Entrar solo con Google Calendar')).toBeTruthy();
  });
});
