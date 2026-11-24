// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthModal } from './AuthModal';

afterEach(() => cleanup());

describe('AuthModal: unico acceso con Google (spec 009, C1)', () => {
  it('no ofrece correo y contrasena, registro ni demo: solo «Continuar con Google»', () => {
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} />);
    expect(screen.getAllByRole('button', { name: /Continuar con Google/ })).toHaveLength(1);
    // Sin formulario de cuenta local.
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(screen.queryByText(/Crear (tu )?Cuenta/i)).toBeNull();
    expect(screen.queryByText(/Demo/i)).toBeNull();
    expect(screen.queryByText(/correo/i)).toBeNull();
  });

  it('avisa que Calendar se conecta en el mismo paso', () => {
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} />);
    expect(screen.getByText(/Google Calendar queda conectado/)).toBeTruthy();
    expect(screen.getByText(/ver y editar los eventos de tu calendario/)).toBeTruthy();
  });

  it('avisa antes del primer login que los datos locales del prototipo se eliminan sin pasarse a la cuenta (C14)', () => {
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} />);
    expect(screen.getByText(/no se pasan a tu cuenta y se eliminan al entrar/)).toBeTruthy();
  });

  it('al pulsar inicia el login con Google (una sola vez)', async () => {
    const signIn = vi.fn(async () => undefined);
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} onCloudSignIn={signIn} />);
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it('si el login falla, muestra el error y deja reintentar', async () => {
    const signIn = vi.fn(async () => {
      throw new Error('No se pudo abrir Google');
    });
    render(<AuthModal isOpen cloudAuth onClose={() => undefined} onCloudSignIn={signIn} />);
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo abrir Google'));
    expect((screen.getByRole('button', { name: /Continuar con Google/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Escape y la X cierran el modal', () => {
    const onClose = vi.fn();
    render(<AuthModal isOpen cloudAuth onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar ventana de autenticación/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cerrado no pinta nada', () => {
    const { container } = render(<AuthModal isOpen={false} cloudAuth onClose={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
