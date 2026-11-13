// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const facade = vi.hoisted(() => ({
  beginGoogleCloudConnect: vi.fn(),
  connectGoogleCalendar: vi.fn(),
  consumeGoogleRedirectResult: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  disconnectGoogleCalendarCloud: vi.fn(),
  fetchGoogleEventsAndBusyForWeek: vi.fn(),
  getStoredAccessToken: vi.fn(),
  getStoredGoogleMeta: vi.fn(),
  refreshGoogleCloudConnection: vi.fn(),
  upsertGoogleGymEvent: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => facade);

import { GoogleCalendarSyncModal } from './GoogleCalendarSyncModal';

const TOKEN = '__student_os_google_cloud__';

function open() {
  return render(<GoogleCalendarSyncModal isOpen onClose={() => undefined} calendarBlocks={[]} />);
}

describe('GoogleCalendarSyncModal', () => {
  beforeEach(() => {
    Object.values(facade).forEach((fn) => fn.mockReset());
    facade.getStoredGoogleMeta.mockReturnValue({ connected: false });
    facade.getStoredAccessToken.mockReturnValue(null);
    facade.consumeGoogleRedirectResult.mockReturnValue(null);
    facade.refreshGoogleCloudConnection.mockResolvedValue(null); // modo GIS por defecto
  });
  afterEach(cleanup);

  describe('modo nube', () => {
    it('desconectado: muestra "Sin conectar" y conectar redirige a Google (sin popup)', async () => {
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: true,
      });
      facade.beginGoogleCloudConnect.mockResolvedValue(undefined);
      open();

      expect(await screen.findByText('Sin conectar')).toBeTruthy();
      const connect = screen.getByRole('button', { name: /Conectar con Google Calendar/ });
      await waitFor(() => expect((connect as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(connect);
      await waitFor(() => expect(facade.beginGoogleCloudConnect).toHaveBeenCalledTimes(1));
      expect(facade.connectGoogleCalendar).not.toHaveBeenCalled();
      // Mientras navega, el boton queda ocupado.
      expect(await screen.findByText('Abriendo Google...')).toBeTruthy();
    });

    it('conectado: muestra la cuenta, explica que no hay que volver a iniciar sesion y avisa al padre', async () => {
      const onConnectionChange = vi.fn();
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true, email: 'ana@gmail.example' },
        accessToken: TOKEN,
        needsReauth: false,
        serverConfigured: true,
      });
      render(<GoogleCalendarSyncModal isOpen onClose={() => undefined} calendarBlocks={[]} onConnectionChange={onConnectionChange} />);

      expect(await screen.findByText('Conectado')).toBeTruthy();
      expect(screen.getByText('ana@gmail.example')).toBeTruthy();
      expect(screen.getByText(/no tendrás que volver a iniciar sesión en Google cada hora/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Conectar con Google Calendar|Reconectar/ })).toBeNull();
      await waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(true, TOKEN));
    });

    it('requiere reconexion: badge de aviso, explicacion honesta (7 dias en modo prueba) y boton Reconectar', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true, email: 'ana@gmail.example' },
        accessToken: null,
        needsReauth: true,
        serverConfigured: true,
      });
      facade.beginGoogleCloudConnect.mockResolvedValue(undefined);
      open();

      expect(await screen.findByText('Requiere reconexión')).toBeTruthy();
      expect(screen.getByText(/pasaron 7 días con la app en modo de prueba/)).toBeTruthy();
      const reconnect = await screen.findByRole('button', { name: /Reconectar con Google Calendar/ });
      fireEvent.click(reconnect);
      await waitFor(() => expect(facade.beginGoogleCloudConnect).toHaveBeenCalled());
    });

    it('desconectar pide confirmacion, revoca en el servidor y avisa del resultado', async () => {
      const onConnectionChange = vi.fn();
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true, email: 'ana@gmail.example' },
        accessToken: TOKEN,
        needsReauth: false,
        serverConfigured: true,
      });
      facade.disconnectGoogleCalendarCloud.mockResolvedValue({ revoked: true });
      render(<GoogleCalendarSyncModal isOpen onClose={() => undefined} calendarBlocks={[]} onConnectionChange={onConnectionChange} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      // Aun no se revoco nada: primero confirma.
      expect(facade.disconnectGoogleCalendarCloud).not.toHaveBeenCalled();
      expect(screen.getByRole('group', { name: /Confirmar desconexión/ })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Sí, desconectar/ }));
      await waitFor(() => expect(facade.disconnectGoogleCalendarCloud).toHaveBeenCalledTimes(1));
      expect(await screen.findByText(/StudentOS ya no tiene acceso a tu calendario/)).toBeTruthy();
      expect(onConnectionChange).toHaveBeenLastCalledWith(false, null);
      expect(screen.getByText('Sin conectar')).toBeTruthy();
      expect(facade.disconnectGoogleCalendar).not.toHaveBeenCalled();
    });

    it('cancelar la confirmacion no toca el servidor', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true },
        accessToken: TOKEN,
        needsReauth: false,
        serverConfigured: true,
      });
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('group', { name: /Confirmar desconexión/ })).toBeNull();
      expect(facade.disconnectGoogleCalendarCloud).not.toHaveBeenCalled();
    });

    it('si Google no confirma la revocacion, lo dice y explica como quitar el acceso a mano', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true });
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: true },
        accessToken: TOKEN,
        needsReauth: false,
        serverConfigured: true,
      });
      facade.disconnectGoogleCalendarCloud.mockResolvedValue({ revoked: false });
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, desconectar/ }));
      expect(await screen.findByText(/Google no confirmó la revocación/)).toBeTruthy();
      expect(screen.getByText(/myaccount\.google\.com\/permissions/)).toBeTruthy();
    });

    it('servidor sin credenciales de Google: avisa y no deja conectar', async () => {
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: false,
      });
      open();
      expect(await screen.findByText(/todavía no tiene configurada la conexión con Google Calendar/)).toBeTruthy();
      const connect = screen.getByRole('button', { name: /Conectar con Google Calendar/ }) as HTMLButtonElement;
      expect(connect.disabled).toBe(true);
    });

    it('si el servidor no responde, avisa sin bloquear el modal', async () => {
      facade.refreshGoogleCloudConnection.mockRejectedValue(new Error('timeout'));
      open();
      expect(await screen.findByText(/No pudimos consultar tu conexión con Google ahora mismo/)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Descargar \.ics/ })).toBeTruthy();
    });

    it.each([
      [{ status: 'connected' }, /quedó conectado/],
      [{ status: 'error', reason: 'denied' }, /Cancelaste el permiso/],
      [{ status: 'error', reason: 'expired' }, /caducó/],
      [{ status: 'error', reason: 'missing_scopes' }, /Faltó el permiso para crear eventos/],
      [{ status: 'error', reason: 'server' }, /No se pudo conectar con Google Calendar/],
    ])('al volver de Google (%o) muestra un mensaje en espanol', async (result, text) => {
      facade.consumeGoogleRedirectResult.mockReturnValue(result);
      facade.refreshGoogleCloudConnection.mockResolvedValue({
        meta: { connected: false },
        accessToken: null,
        needsReauth: false,
        serverConfigured: true,
      });
      open();
      expect(await screen.findByText(text)).toBeTruthy();
    });
  });

  describe('modo GIS (sin nube): comportamiento de siempre', () => {
    it('conectar usa connectGoogleCalendar (popup de GIS), no la redireccion', async () => {
      facade.connectGoogleCalendar.mockResolvedValue({
        accessToken: 'gis-token',
        expiresAt: Date.now() + 3_600_000,
        meta: { connected: true, email: 'ana@gmail.example' },
        user: { email: 'ana@gmail.example' },
      });
      open();
      fireEvent.click(await screen.findByRole('button', { name: /Conectar con Google Calendar/ }));
      expect(await screen.findByText(/Conectado a Google Calendar como ana@gmail\.example/)).toBeTruthy();
      expect(facade.beginGoogleCloudConnect).not.toHaveBeenCalled();
    });

    it('sesion expirada: texto original de OAuth temporal y boton Reconectar', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true, email: 'ana@gmail.example' });
      open();
      expect(await screen.findByText(/La sesión temporal OAuth expiró al recargar/)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Reconectar con Google Calendar/ })).toBeTruthy();
    });

    it('desconectar usa disconnectGoogleCalendar sin confirmacion adicional', async () => {
      facade.getStoredGoogleMeta.mockReturnValue({ connected: true });
      facade.getStoredAccessToken.mockReturnValue('gis-token');
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
      expect(facade.disconnectGoogleCalendar).toHaveBeenCalledWith('gis-token');
      expect(facade.disconnectGoogleCalendarCloud).not.toHaveBeenCalled();
      expect(await screen.findByText(/desconectada de esta sesión/)).toBeTruthy();
    });

    it('no consulta la nube mas de una vez ni rompe si refresh devuelve null', async () => {
      open();
      await waitFor(() => expect(facade.refreshGoogleCloudConnection).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Sin conectar')).toBeTruthy();
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
        if (button.closest('[role="dialog"]') && /Conectar|Sincronizar|Enviar|Descargar|Cerrar/.test(button.textContent ?? '')) {
          expect(button.className).toMatch(/t-btn/);
        }
      }
      expect(baseElement.innerHTML).not.toMatch(/violet|purple|indigo|fuchsia/i);
      // Ningun texto por debajo de 13 px.
      expect(baseElement.innerHTML).not.toMatch(/text-\[(8|9|10|11|12)px\]/);
    });
  });
});
