// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { initialData } from '../../data/initialData';
import { useChores } from '../../hooks/useChores';
import type { AppState } from '../../types';
import { OverviewBento } from './OverviewBento';

afterEach(() => cleanup());

const noop = () => undefined;

function BentoWithChores({ initial }: { initial: AppState }) {
  const [state, setState] = useState<AppState>(initial);
  const chores = useChores(state, setState, { syncReady: true });
  return (
    <OverviewBento
      state={state}
      chores={chores}
      todayDateIso="2026-11-17"
      onNavigateTab={noop}
      onToggleGymSet={noop}
      onUpdateUniStatus={noop}
      onUpdateKanbanStatus={noop}
      onOpenQuickAdd={noop}
      onHabitsChange={noop}
      onRestoreState={noop}
    />
  );
}

describe('OverviewBento: quehaceres diarios (spec 012)', () => {
  it('monta la tarjeta «Quehaceres» junto a «Hábitos diarios» con la lista base', () => {
    render(<BentoWithChores initial={{ ...initialData, chores: undefined, choreDays: undefined, choreSettings: undefined }} />);
    expect(screen.getByRole('heading', { name: 'Hábitos diarios' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Quehaceres' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: /Tender la cama|Pasear al perro|Ducharme|Limpiar mi cuarto|Avanzar/ })).toHaveLength(5);
  });

  it('marcar un quehacer desde el resumen actualiza el contador', () => {
    render(<BentoWithChores initial={{ ...initialData, chores: undefined, choreDays: undefined, choreSettings: undefined }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tender la cama' }));
    expect(screen.getByLabelText('1 de 5 quehaceres completados')).toBeTruthy();
  });

  it('sin la prop `chores` no aparece la tarjeta (compatibilidad con quien aun no la pasa)', () => {
    render(
      <OverviewBento
        state={initialData}
        todayDateIso="2026-11-17"
        onNavigateTab={noop}
        onToggleGymSet={noop}
        onUpdateUniStatus={noop}
        onUpdateKanbanStatus={noop}
        onOpenQuickAdd={noop}
        onHabitsChange={noop}
        onRestoreState={noop}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Quehaceres' })).toBeNull();
  });
});
