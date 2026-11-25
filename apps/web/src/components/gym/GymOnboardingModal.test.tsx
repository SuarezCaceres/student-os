// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GymOnboardingModal } from './GymOnboardingModal';

afterEach(() => cleanup());

describe('GymOnboardingModal: «No voy al gimnasio» (spec 011, C1)', () => {
  it('el boton esta visible desde el primer paso y funciona sin rellenar ningun campo', () => {
    const onDisableGym = vi.fn();
    const onComplete = vi.fn();
    render(<GymOnboardingModal isOpen onClose={() => undefined} onComplete={onComplete} onDisableGym={onDisableGym} />);
    fireEvent.click(screen.getByRole('button', { name: 'No voy al gimnasio' }));
    expect(onDisableGym).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('sin la prop no aparece el boton (el resto de usos del asistente no cambia)', () => {
    render(<GymOnboardingModal isOpen onClose={() => undefined} onComplete={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'No voy al gimnasio' })).toBeNull();
  });
});
