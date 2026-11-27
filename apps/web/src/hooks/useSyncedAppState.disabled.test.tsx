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
import { useSyncedAppState } from './useSyncedAppState';

/**
 * Sin VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_API_URL no hay login posible (solo la landing, con el
 * acceso deshabilitado) y el estado vive unicamente en localStorage: sin red y sin IndexedDB.
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

  it('useSyncedAppState sin nube: estado, escritura y reset solo en localStorage', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useSyncedAppState('synced_key', initialData));
    expect(result.current[0]).toEqual(initialData);

    act(() => result.current[1]((s) => ({ ...s, studentName: 'Ana', streak: s.streak + 1 })));
    expect(result.current[0].studentName).toBe('Ana');
    expect(JSON.parse(window.localStorage.getItem('synced_key')!).studentName).toBe('Ana');

    // Varias actualizaciones funcionales seguidas se encadenan igual que en React.
    const streak = result.current[0].streak;
    act(() => {
      result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
      result.current[1]((s) => ({ ...s, streak: s.streak + 1 }));
    });
    expect(result.current[0].streak).toBe(streak + 2);

    act(() => result.current[2]());
    expect(result.current[0]).toEqual(initialData);
    expect(JSON.parse(window.localStorage.getItem('synced_key') ?? 'null') ?? initialData).toEqual(initialData);

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

  it('JSON corrupto en localStorage cae al estado inicial', () => {
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

  it('AuthModal sin nube configurada: ofrece un unico acceso, deshabilitado, y explica que no esta disponible', () => {
    render(<AuthModal isOpen onClose={() => undefined} />);
    const button = screen.getByRole('button', { name: /Continuar con Google/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Entrar a StudentOS')).toBeTruthy();
    expect(screen.getByText(/no está disponible en este momento/)).toBeTruthy();
    // Ya no existe el modo demo.
    expect(screen.queryByText(/Modo Demo/)).toBeNull();
  });

  it('AuthModal con cloudAuth ofrece un unico "Continuar con Google" activo que incluye Calendar', () => {
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} />);
    const button = screen.getByRole('button', { name: /Continuar con Google/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(screen.getAllByText('Calendar').length).toBeGreaterThan(0);
    expect(screen.queryByText('Entrar solo con Google Calendar')).toBeNull();
  });
});
