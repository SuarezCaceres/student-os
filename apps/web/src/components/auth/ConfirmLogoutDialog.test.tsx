// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmLogoutDialog } from './ConfirmLogoutDialog';

afterEach(() => cleanup());

function setup(patch: Partial<React.ComponentProps<typeof ConfirmLogoutDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<ConfirmLogoutDialog isOpen pending={3} timedOut={false} onCancel={onCancel} onConfirm={onConfirm} {...patch} />);
  return { onCancel, onConfirm };
}

describe('ConfirmLogoutDialog (spec 010, C8)', () => {
  it('avisa de cuantos cambios se perderian y ofrece cancelar o cerrar igualmente', () => {
    setup({ pending: 3 });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Hay cambios sin guardar en tu cuenta');
    expect(dialog.textContent).toContain('3 cambios');
    expect(dialog.textContent).toContain('se perderán');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión de todos modos' })).toBeTruthy();
  });

  it('usa el singular con un solo cambio', () => {
    setup({ pending: 1 });
    expect(screen.getByRole('dialog').textContent).toContain('1 cambio');
    expect(screen.getByRole('dialog').textContent).toContain('se perderá');
  });

  it('distingue el servidor lento de la falta de conexion', () => {
    setup({ timedOut: true });
    expect(screen.getByRole('dialog').textContent).toContain('el servidor tardó demasiado');
    cleanup();
    setup({ timedOut: false });
    expect(screen.getByRole('dialog').textContent).toContain('puede que no tengas conexión');
  });

  it('Cancelar no cierra la sesion y Cerrar de todos modos si', () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión de todos modos' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape equivale a cancelar', () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('mientras se cierra la sesion los botones quedan bloqueados', () => {
    setup({ isLeaving: true });
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cerrando sesión…' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cerrado no pinta nada', () => {
    render(<ConfirmLogoutDialog isOpen={false} pending={2} timedOut={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
