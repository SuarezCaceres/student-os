// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../data/initialData';
import type { AppState } from '../../types';
import { StatsHero } from '../layout/StatsHero';
import { OverviewBento } from './OverviewBento';

afterEach(() => cleanup());

const noop = () => undefined;
const baseBento = (state: AppState) => ({
  state,
  todayDateIso: '2026-11-17',
  onNavigateTab: noop,
  onToggleGymSet: noop,
  onUpdateUniStatus: noop,
  onUpdateKanbanStatus: noop,
  onOpenQuickAdd: noop,
});

// Sin perfil de gym ni rutinas con ejercicios: el estado de quien aun no configuro nada.
const withoutGym: AppState = { ...initialData, gymProfile: undefined, gymRoutines: [] };

describe('OverviewBento: gym opcional (spec 011)', () => {
  it('C2: sin perfil de gym ofrece «No voy al gimnasio» y lo dispara', () => {
    const onDisableGym = vi.fn();
    render(<OverviewBento {...baseBento(withoutGym)} onDisableGym={onDisableGym} />);
    fireEvent.click(screen.getByRole('button', { name: 'No voy al gimnasio' }));
    expect(onDisableGym).toHaveBeenCalledTimes(1);
  });

  it('no ofrece «No voy al gimnasio» a quien ya tiene perfil de gym', () => {
    const state: AppState = { ...withoutGym, gymProfile: initialData.gymProfile ?? {
      gymType: 'casa', selectedDays: ['Lunes'], goal: 'salud', experience: 'principiante',
      heightCm: 170, weightKg: 70, defaultSessionMinutes: 60, reminderMinutesBefore: [30],
    } as AppState['gymProfile'] };
    render(<OverviewBento {...baseBento(state)} onDisableGym={noop} />);
    expect(screen.queryByRole('button', { name: 'No voy al gimnasio' })).toBeNull();
  });

  it('C4/C6: con el gym desactivado no hay tarjeta de gym ni «Agregar ejercicio»; hay «Reactivar»', () => {
    const onEnableGym = vi.fn();
    render(<OverviewBento {...baseBento({ ...initialData, gymDisabled: true })} gymEnabled={false} onEnableGym={onEnableGym} />);
    expect(screen.getByTestId('gym-disabled-notice').textContent).toContain('Gym desactivado');
    expect(screen.queryByText('Agregar ejercicio')).toBeNull();
    expect(screen.queryByText('Ver rutina')).toBeNull();
    expect(screen.queryByText('Ir al Gym')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    expect(onEnableGym).toHaveBeenCalledTimes(1);
  });

  it('con el gym activo se mantiene la tarjeta de gym y no sale el aviso', () => {
    render(<OverviewBento {...baseBento(initialData)} />);
    expect(screen.queryByTestId('gym-disabled-notice')).toBeNull();
    expect(screen.getByText('Agregar ejercicio')).toBeTruthy();
  });
});

describe('StatsHero: gym opcional (spec 011, C4)', () => {
  it('con el gym desactivado no muestra el KPI de gym ni alertas de gym', () => {
    render(<StatsHero state={initialData} gymEnabled={false} missingGymScheduleCount={2} onNavigateTab={noop} />);
    expect(screen.queryByText(/^Gym \(/)).toBeNull();
    expect(screen.queryByText(/alertas? Gym/)).toBeNull();
  });

  it('con el gym activo conserva el KPI de gym y las alertas', () => {
    render(<StatsHero state={initialData} missingGymScheduleCount={2} onNavigateTab={noop} />);
    expect(screen.getByText(/^Gym \(/)).toBeTruthy();
    expect(screen.getByText(/2\s+alertas Gym/)).toBeTruthy();
  });
});
