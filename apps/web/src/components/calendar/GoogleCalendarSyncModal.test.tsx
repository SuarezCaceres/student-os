// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const facade = vi.hoisted(() => ({
  fetchGoogleEventsAndBusyForWeek: vi.fn(),
  getStoredGoogleMeta: vi.fn(),
  refreshGoogleCloudConnection: vi.fn(),
  upsertGoogleGymEvent: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => facade);

import { GoogleCalendarSyncModal } from './GoogleCalendarSyncModal';

const TOKEN = '__student_os_google_cloud__';

function open(props: Partial<React.ComponentProps<typeof GoogleCalendarSyncModal>> = {}) {
  return render(<GoogleCalendarSyncModal isOpen onClose={() => undefined} calendarBlocks={[]} {...props} />);
}

const connectedState = {
  meta: { connected: true, email: 'ana@gmail.example' },
  accessToken: TOKEN,
  needsReauth: false,
  serverConfigured: true,
};

/** Spec 009 (C6): Calendar se vincula solo al iniciar sesion, asi que no existen botones para conectar ni desvincular. */
const NO_CONNECT_OR_DISCONNECT = /Conectar|Reconectar|Desconectar|Desvincular|Vincular/;

describe('GoogleCalendarSyncModal', () => {
  beforeEach(() => {
    Object.values(facade).forEach((fn) => fn.mockReset());
    facade.getStoredGoogleMeta.mockReturnValue({ connected: false });
    facade.refreshGoogleCloudConnection.mockResolvedValue(null);
  });
  afterEach(cleanup);

  describe('estado de la conexion (solo lectura)', () => {
    it('conectado: muestra la cuenta, explica que se conecto al iniciar sesion y avisa al padre', async () => {
      const onConnectionChange = vi.fn();
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue(connectedState);
      open({ onConnectionChange });

      expect(await screen.findByText('Conectado')).toBeTruthy();
      expect(screen.getByText('ana@gmail.example')).toBeTruthy();
      expect(screen.getByText(/se conectó al iniciar sesión/)).toBeTruthy();
      await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(true, TOKEN));
    });

    it('C6: ni conectado, ni desconectado, ni con reconexion hay botones para conectar o desvincular', async () => {
      const states = [
        connectedState,
        { meta: { connected: false }, accessToken: null, needsReauth: false, serverConfigured: true },
        { meta: { connected: true, email: 'ana@gmail.example' }, accessToken: null, needsReauth: true, serverConfigured: true },
      ];
      for (const state of states) {
        facade.refreshGoogleCloudConnection.mockResolvedValue(state);
        const { baseElement, unmount } = open();
        await waitFor(() => expect(screen.queryByText('Revisando conexión...')).toBeNull());
        for (const button of Array.from(baseElement.querySelectorAll('button'))) {
          expect(button.textContent ?? '', `boton inesperado: ${button.textContent}`).not.toMatch(NO_CONNECT_OR_DISCONNECT);
        }
        unmount();
      }
    });

    it('desconectado: muestra "Sin conectar", pide entrar con Google y deja las acciones de Calendar deshabilitadas', async () => {
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: true,
      });
      open();

      expect(await screen.findByText('Sin conectar')).toBeTruthy();
      expect(screen.getByText(/se conecta al iniciar sesión con Google/)).toBeTruthy();
      expect((screen.getByRole('button', { name: /Sincronizar disponibilidad semanal/ }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: /Enviar bloques actuales a Google/ }) as HTMLButtonElement).disabled).toBe(true);
      // El .ics no necesita Google.
      expect((screen.getByRole('button', { name: /Descargar \.ics/ }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('requiere reconexion: aviso honesto y pide cerrar sesion y volver a entrar con Google', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true, email: 'ana@gmail.example' },
        accessToken: null,
        needsReauth: true,
        serverConfigured: true,
      });
      open();

      expect(await screen.findByText('Requiere reconexión')).toBeTruthy();
      expect(screen.getByText(/Cierra sesión y vuelve a entrar con Google/)).toBeTruthy();
      expect((screen.getByRole('button', { name: /Sincronizar disponibilidad semanal/ }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('servidor sin credenciales de Google: avisa y deja solo el .ics', async () => {
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: false,
      });
      open();
      expect(await screen.findByText(/todavía no tiene configurada la conexión con Google Calendar/)).toBeTruthy();
      expect((screen.getByRole('button', { name: /Sincronizar disponibilidad semanal/ }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('si el servidor no responde, avisa sin bloquear el modal', async () => {
      facade.refreshGoogleCloudConnection.mockRejectedValue(new Error('timeout'));
      open();
      expect(await screen.findByText(/No pudimos consultar tu conexión con Google ahora mismo/)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Descargar \.ics/ })).toBeTruthy();
    });

    it('consulta al servidor una sola vez al abrir', async () => {
      open();
      await waitFor(() => expect(facade.refreshGoogleCloudConnection).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Sin conectar')).toBeTruthy();
    });
  });

  describe('acciones con Calendar conectado', () => {
    it('sincronizar la semana usa el token del servidor y avisa al padre', async () => {
      const onWeekEventsSynced = vi.fn();
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue(connectedState);
      facade.fetchGoogleEventsAndBusyForWeek.mockResolvedValue({ events: [{ id: 'e1' }], busyByDate: {} });
      open({ onWeekEventsSynced });

      const sync = await screen.findByRole('button', { name: /Sincronizar disponibilidad semanal/ });
      await waitFor(() => expect((sync as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(sync);

      await waitFor(() => expect(facade.fetchGoogleEventsAndBusyForWeek).toHaveBeenCalledTimes(1));
      expect(facade.fetchGoogleEventsAndBusyForWeek.mock.calls[0][0]).toBe(TOKEN);
      await waitFor(() => expect(onWeekEventsSynced).toHaveBeenCalled());
      expect(await screen.findByText(/Sincronizado: 1 evento de Google/)).toBeTruthy();
    });

    it('un error de Google al sincronizar se muestra y no rompe el modal', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true });
      facade.refreshGoogleCloudConnection.mockResolvedValue(connectedState);
      facade.fetchGoogleEventsAndBusyForWeek.mockRejectedValue(new Error('Google no respondió'));
      open();
      const sync = await screen.findByRole('button', { name: /Sincronizar disponibilidad semanal/ });
      await waitFor(() => expect((sync as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(sync);
      expect(await screen.findByText('Google no respondió')).toBeTruthy();
    });
  });

  describe('accesibilidad y diseno', () => {
    it('los botones de accion usan .t-btn (>= 44 px) y no hay violeta en la interfaz', async () => {
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: true,
      });
      const { baseElement } = open();
      await screen.findByText('Sin conectar');
      const buttons = Array.from(baseElement.querySelectorAll('button')).filter((b) => b.textContent && !b.getAttribute('aria-label'));
      expect(buttons.length).toBeGreaterThan(2);
      for (const button of buttons) {
        if (button.closest('[role="dialog"]') && /Sincronizar|Enviar|Descargar|Cerrar/.test(button.textContent ?? '')) {
          expect(button.className).toMatch(/t-btn/);
        }
      }
      expect(baseElement.innerHTML).not.toMatch(/violet|purple|indigo|fuchsia/i);
      // Ningun texto por debajo de 13 px.
      expect(baseElement.innerHTML).not.toMatch(/text-\[(8|9|10|11|12)px\]/);
    });
  });
});
