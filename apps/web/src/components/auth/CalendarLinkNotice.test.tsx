// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithGoogle = vi.fn(async () => undefined);
vi.mock('../../services/supabase', () => ({ signInWithGoogle: () => signInWithGoogle() }));

import {
  __resetGoogleLoginForTests,
  __setCalendarLinkStateForTests,
  CALENDAR_LINK_MESSAGES,
  getCalendarLinkState,
} from '../../services/googleLogin';
import { CalendarLinkNotice } from './CalendarLinkNotice';

beforeEach(() => {
  __resetGoogleLoginForTests();
  signInWithGoogle.mockClear();
});
afterEach(() => cleanup());

describe('CalendarLinkNotice (C9)', () => {
  it('no muestra nada si no hubo fallo', () => {
    const { container } = render(<CalendarLinkNotice />);
    expect(container.innerHTML).toBe('');
  });

  it('muestra el mensaje claro cuando falta el permiso de Calendar y ofrece volver a intentarlo', () => {
    render(<CalendarLinkNotice />);
    act(() =>
      __setCalendarLinkStateForTests({
        status: 'failed',
        reason: 'missing_scopes',
        message: CALENDAR_LINK_MESSAGES.missing_scopes,
      }),
    );
    expect(screen.getByRole('alert').textContent).toContain('StudentOS necesita acceso a tu Google Calendar');
    act(() => screen.getByRole('button', { name: 'Continuar con Google' }).click());
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('"Cerrar" quita el aviso y olvida el fallo', () => {
    render(<CalendarLinkNotice />);
    act(() => __setCalendarLinkStateForTests({ status: 'failed', reason: 'other', message: CALENDAR_LINK_MESSAGES.other }));
    act(() => screen.getByRole('button', { name: 'Cerrar' }).click());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getCalendarLinkState()).toEqual({ status: 'idle' });
  });
});
