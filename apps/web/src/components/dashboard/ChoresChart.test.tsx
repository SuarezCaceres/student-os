// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../data/initialData';
import { useChores } from '../../hooks/useChores';
import type { AppState, ChoreDay } from '../../types';
import { buildChoreSeed, computeWeekdayStats } from '../../utils/chores';
import { ChoresCard } from './ChoresCard';
import { ChoresChart } from './ChoresChart';

// Miercoles 2026-11-25 a mediodia (hora local). Solo se simula `Date`.
const TODAY = '2026-11-25';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seeded = buildChoreSeed();
const day = (date: string, completedCount: number, hard = false): ChoreDay => ({
  date,
  hard,
  completed: seeded.chores.slice(0, completedCount).map((chore) => ({ choreId: chore.id, name: chore.name })),
});

// Lunes 16: 2 · martes 17: dificil (0, no cuenta) · lunes 23: 4 · martes 24: 5. El resto de dias, sin registro, cuentan como 0.
const history: ChoreDay[] = [day('2026-11-16', 2), day('2026-11-17', 0, true), day('2026-11-23', 4), day('2026-11-24', 5)];
const statsFor = (choreDays: ChoreDay[]) => computeWeekdayStats({ chores: seeded.chores, choreDays }, TODAY);

describe('ChoresChart: con historial suficiente', () => {
  it('C12: muestra siete barras de lunes a domingo con el promedio de cada día', () => {
    render(<ChoresChart stats={statsFor(history)} />);
    const chart = screen.getByRole('img', { name: 'Promedio de quehaceres completados por día de la semana' });
    expect(chart).toBeTruthy();
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    expect(days.every((name) => screen.getByTestId(`chores-bar-${name}`))).toBe(true);
    expect(within(screen.getByTestId('chores-bar-Lunes')).getByText('3')).toBeTruthy(); // (2 + 4) / 2
    expect(within(screen.getByTestId('chores-bar-Martes')).getByText('5')).toBeTruthy();
  });

  it('C12: resalta el mejor día y lo dice con texto', () => {
    render(<ChoresChart stats={statsFor(history)} />);
    expect(screen.getByTestId('chores-best-day').textContent).toBe('Tu mejor día: Martes');
    expect(screen.getByTestId('chores-bar-Martes').getAttribute('data-best')).toBe('true');
    expect(screen.getByTestId('chores-bar-Lunes').getAttribute('data-best')).toBeNull();
  });

  it('C12: no cuenta los días difíciles en el promedio', () => {
    // Si el martes difícil del 17 (0 completados) contara, el promedio del martes sería (0 + 5) / 2 = 2,5.
    render(<ChoresChart stats={statsFor(history)} />);
    expect(within(screen.getByTestId('chores-bar-Martes')).getByText('5')).toBeTruthy();
    expect(screen.queryByText('2,5')).toBeNull();
  });

  it('describe los datos con texto accesible para quien no ve la gráfica', () => {
    const { container } = render(<ChoresChart stats={statsFor(history)} />);
    const description = container.querySelector('desc')?.textContent ?? '';
    expect(description).toContain('Lunes 3');
    expect(description).toContain('Martes 5');
    expect(description).toContain('Tu mejor día es Martes.');
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-describedby')).toBe(container.querySelector('desc')?.id);
  });

  it('usa solo tokens CSS para el color (tema claro y oscuro)', () => {
    const { container } = render(<ChoresChart stats={statsFor(history)} />);
    const colors = [...container.querySelectorAll('svg[role="img"] [fill], svg[role="img"] [stroke]')].flatMap((node) => [node.getAttribute('fill'), node.getAttribute('stroke')]);
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.filter((value): value is string => Boolean(value) && value !== 'none').every((value) => value.startsWith('var(--'))).toBe(true);
  });

  it('con todos los promedios en cero no inventa un mejor día y no dibuja barras en cero (C13)', () => {
    const zeros = [day('2026-11-16', 0), day('2026-11-17', 0), day('2026-11-18', 0), day('2026-11-19', 0)].map((entry) => ({ ...entry, completed: [] }));
    // Un registro vacío no se guarda en la app, pero el cálculo debe seguir siendo correcto con uno.
    render(<ChoresChart stats={statsFor(zeros)} />);
    expect(screen.getByTestId('chores-chart-empty')).toBeTruthy();
    expect(screen.queryByTestId('chores-best-day')).toBeNull();
    expect(screen.queryByTestId('chores-bar-Lunes')).toBeNull();
  });
});

describe('ChoresChart: estado vacío', () => {
  it('C13: sin historial muestra un mensaje claro y ninguna gráfica en ceros', () => {
    render(<ChoresChart stats={statsFor([])} />);
    expect(screen.getByTestId('chores-chart-empty').textContent).toContain('Aún no hay suficientes días');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('chores-best-day')).toBeNull();
  });

  it('C13: con muy pocos días registrados sigue en vacío y dice cuánto falta', () => {
    render(<ChoresChart stats={statsFor([day('2026-11-24', 3)])} />);
    expect(screen.getByTestId('chores-chart-empty').textContent).toContain('Llevas 1 de 3 días');
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('ChoresChart dentro de la tarjeta', () => {
  function Harness({ choreDays }: { choreDays: ChoreDay[] }) {
    const [state, setState] = useState<AppState>({ ...initialData, chores: seeded.chores, choreSettings: seeded.choreSettings, choreDays });
    const chores = useChores(state, setState, { syncReady: true });
    return <ChoresCard chores={chores} />;
  }

  it('se despliega con «Ver tu semana» y se oculta con «Ocultar tu semana»', () => {
    render(<Harness choreDays={history} />);
    expect(screen.queryByTestId('chores-chart')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Ver tu semana' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Ocultar tu semana' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('chores-best-day').textContent).toBe('Tu mejor día: Martes');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar tu semana' }));
    expect(screen.queryByTestId('chores-chart')).toBeNull();
  });

  it('un usuario nuevo ve el estado vacío al abrir su semana', () => {
    render(<Harness choreDays={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver tu semana' }));
    expect(screen.getByTestId('chores-chart-empty')).toBeTruthy();
  });
});
