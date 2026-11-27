// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChoreDay } from '../../types';
import { ChoresHistory } from './ChoresHistory';

afterEach(cleanup);

const TODAY = '2026-11-25';
const day = (date: string, names: string[] = [], extra: Partial<ChoreDay> = {}): ChoreDay => ({
  date,
  hard: false,
  completed: names.map((name, index) => ({ choreId: `id-${index}`, name })),
  ...extra,
});
/** `count` días pasados consecutivos con un quehacer cada uno, empezando el 2026-11-24 hacia atrás. */
const pastDays = (count: number): ChoreDay[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(2026, 10, 24 - index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return day(iso, [`Quehacer ${index + 1}`]);
  });
const entries = () => screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-date'));

describe('ChoresHistory', () => {
  it('sin días pasados explica el vacío con tono amable', () => {
    render(<ChoresHistory history={[]} today={TODAY} />);
    expect(screen.getByText('Aún no hay días anteriores. Aquí verás lo que hiciste cada día.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('hoy no aparece en el historial, ni los días futuros ni los vacíos sin día difícil', () => {
    const history = [day('2026-11-26', ['Futuro']), day(TODAY, ['Hoy']), day('2026-11-23'), day('2026-11-22', ['Ayer'])];
    render(<ChoresHistory history={history} today={TODAY} />);
    expect(screen.queryByText('Hoy')).toBeNull();
    expect(screen.queryByText('Futuro')).toBeNull();
    expect(entries()).toHaveLength(1);
    expect(screen.getByText('Ayer')).toBeTruthy();
  });

  it('muestra fecha legible en español, cuántos se completaron y los nombres copiados', () => {
    render(<ChoresHistory history={[day('2026-11-24', ['Tender la cama', 'Ducharme'])]} today={TODAY} />);
    const entry = entries()[0];
    expect(within(entry).getByText('mar 24 nov')).toBeTruthy();
    expect(within(entry).getByText('2 quehaceres')).toBeTruthy();
    expect(within(entry).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Tender la cama', 'Ducharme']);
  });

  it('usa singular con un solo quehacer', () => {
    render(<ChoresHistory history={[day('2026-11-24', ['Ducharme'])]} today={TODAY} />);
    expect(screen.getByText('1 quehacer')).toBeTruthy();
  });

  it('respeta el orden recibido (más reciente primero)', () => {
    render(<ChoresHistory history={[day('2026-11-24', ['A']), day('2026-11-20', ['B'])]} today={TODAY} />);
    expect(entries().map((item) => item.getAttribute('data-date'))).toEqual(['2026-11-24', '2026-11-20']);
    expect(screen.getByText('vie 20 nov')).toBeTruthy();
  });

  it('un día difícil muestra «Día difícil · motivo» sin lenguaje de fracaso', () => {
    const history = [day('2026-11-24', ['Ducharme'], { hard: true, reason: 'cansado' }), day('2026-11-23', [], { hard: true })];
    const { container } = render(<ChoresHistory history={history} today={TODAY} />);
    expect(screen.getByText('Día difícil · cansado')).toBeTruthy();
    expect(screen.getByText('Día difícil')).toBeTruthy();
    expect(container.textContent).not.toMatch(/incumpl|fall|fracas|no lograste|meta no/i);
  });

  it('un nombre vacío en el registro no deja una viñeta en blanco', () => {
    render(<ChoresHistory history={[day('2026-11-24', ['  '])]} today={TODAY} />);
    expect(screen.getByText('Quehacer sin nombre')).toBeTruthy();
  });

  it('muestra 14 días y «Ver más» amplía de 14 en 14 hasta agotar', () => {
    render(<ChoresHistory history={pastDays(30)} today={TODAY} />);
    expect(entries()).toHaveLength(14);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(entries()).toHaveLength(28);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(entries()).toHaveLength(30);
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('con 14 días o menos no ofrece «Ver más»', () => {
    render(<ChoresHistory history={pastDays(14)} today={TODAY} />);
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('«Ver más» mide 44 px como mínimo (objetivo táctil)', () => {
    render(<ChoresHistory history={pastDays(20)} today={TODAY} />);
    expect(screen.getByRole('button', { name: 'Ver más' }).className).toMatch(/min-h-\[44px\]/);
  });
});
