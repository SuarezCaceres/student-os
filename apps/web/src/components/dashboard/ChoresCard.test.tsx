// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../data/initialData';
import { useChores } from '../../hooks/useChores';
import type { AppState, Chore, ChoreDay } from '../../types';
import { ALL_DAYS, buildChoreSeed } from '../../utils/chores';
import { ChoresCard } from './ChoresCard';

// Miercoles 2026-11-25 a mediodia (hora local). Solo se simula `Date`: los temporizadores reales no estorban.
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

const stateWith = (extra: Partial<AppState> = {}): AppState => ({
  ...initialData,
  chores: seeded.chores,
  choreSettings: seeded.choreSettings,
  choreDays: [],
  ...extra,
});

/** Usa el hook REAL con un estado de prueba: asi se prueba lo que ve el usuario, no un doble. */
function Harness({ initial, onState }: { initial: AppState; onState?: (state: AppState) => void }) {
  const [state, setState] = useState<AppState>(initial);
  onState?.(state);
  const chores = useChores(state, setState, { syncReady: true });
  return <ChoresCard chores={chores} />;
}

const checkbox = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const counter = (done: number, total: number) => screen.getByLabelText(`${done} de ${total} quehaceres completados`);
const doneDay = (count: number): ChoreDay => ({
  date: TODAY,
  hard: false,
  completed: seeded.chores.slice(0, count).map((chore) => ({ choreId: chore.id, name: chore.name })),
});
const manyChores = (count: number): Chore[] =>
  Array.from({ length: count }, (_, index) => ({ id: `extra-${index}`, name: `Extra ${index + 1}`, days: [...ALL_DAYS], order: index }));

describe('ChoresCard: lista de hoy', () => {
  it('C1: un usuario nuevo ve los cinco quehaceres base sin marcar y el contador en 0/5', () => {
    // Sin ajustes guardados: el hook siembra la lista base.
    render(<Harness initial={{ ...initialData, chores: undefined, choreDays: undefined, choreSettings: undefined }} />);
    expect(screen.getByRole('heading', { name: 'Quehaceres' })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Quehaceres de hoy' });
    const boxes = within(list).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(5);
    expect(boxes.every((box) => !box.checked)).toBe(true);
    expect(checkbox('Tender la cama')).toBeTruthy();
    expect(checkbox('Avanzar en mis proyectos personales de inteligencia artificial')).toBeTruthy();
    expect(counter(0, 5).textContent).toBe('0/5');
  });

  it('muestra un esqueleto mientras la lista base aun no esta lista', () => {
    function NotReady() {
      const [state, setState] = useState<AppState>({ ...initialData, chores: undefined, choreSettings: undefined });
      const chores = useChores(state, setState, { syncReady: false });
      return <ChoresCard chores={chores} />;
    }
    render(<NotReady />);
    expect(screen.getByTestId('chores-skeleton').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('C3: solo lista los quehaceres que aplican al dia de hoy', () => {
    const chores: Chore[] = [
      { id: 'a', name: 'Todos los dias', days: [...ALL_DAYS], order: 0 },
      { id: 'b', name: 'Solo miércoles', days: ['Miércoles'], order: 1 },
      { id: 'c', name: 'Solo sábado', days: ['Sábado'], order: 2 },
    ];
    render(<Harness initial={stateWith({ chores })} />);
    expect(checkbox('Todos los dias')).toBeTruthy();
    expect(checkbox('Solo miércoles')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Solo sábado' })).toBeNull();
    expect(counter(0, 2)).toBeTruthy();
  });

  it('C4: marcar y desmarcar sube y baja el contador, y un quehacer cuenta una sola vez', () => {
    render(<Harness initial={stateWith()} />);
    fireEvent.click(checkbox('Ducharme'));
    expect(checkbox('Ducharme').checked).toBe(true);
    expect(counter(1, 5).textContent).toBe('1/5');
    fireEvent.click(checkbox('Tender la cama'));
    expect(counter(2, 5)).toBeTruthy();
    fireEvent.click(checkbox('Ducharme'));
    expect(checkbox('Ducharme').checked).toBe(false);
    expect(counter(1, 5)).toBeTruthy();
  });

  it('C4: el estado guardado no duplica el quehacer al marcarlo', () => {
    let latest: AppState | undefined;
    render(<Harness initial={stateWith()} onState={(state) => (latest = state)} />);
    fireEvent.click(checkbox('Ducharme'));
    const today = latest?.choreDays?.find((day) => day.date === TODAY);
    expect(today?.completed.filter((entry) => entry.choreId === 'chore-base-3')).toHaveLength(1);
  });

  it('las casillas se pueden marcar con el teclado (son checkbox nativos con etiqueta)', () => {
    render(<Harness initial={stateWith()} />);
    const box = checkbox('Pasear al perro');
    box.focus();
    expect(document.activeElement).toBe(box);
    fireEvent.click(box); // la barra espaciadora sobre un checkbox nativo dispara el click
    expect(box.checked).toBe(true);
  });
});

describe('ChoresCard: motivacion y meta', () => {
  it('C5: con menos de 5 muestra el progreso hacia la primera meta y la barra avanza', () => {
    render(<Harness initial={stateWith({ choreDays: [doneDay(2)] })} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 2 de 5');
    const bar = screen.getByRole('progressbar', { name: 'Progreso hacia la meta de hoy' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
  });

  it('C5: al completar 5 ve «¡Eres lo máximo!»', () => {
    render(<Harness initial={stateWith({ chores: [...seeded.chores, ...manyChores(5)], choreDays: [doneDay(4)] })} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 4 de 5');
    fireEvent.click(checkbox('Extra 1'));
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Eres lo máximo!');
  });

  it('C5: al completar 10 ve «¡Sigue así!»', () => {
    const state = stateWith({ chores: [...seeded.chores, ...manyChores(5)] });
    const ten: ChoreDay = {
      date: TODAY,
      hard: false,
      completed: state.chores!.slice(0, 9).map((chore) => ({ choreId: chore.id, name: chore.name })),
    };
    render(<Harness initial={{ ...state, choreDays: [ten] }} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Eres lo máximo!');
    fireEvent.click(checkbox('Extra 5'));
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Sigue así!');
  });

  it('C6: muestra los mensajes personalizados de los ajustes guardados', () => {
    const state = stateWith({ choreSettings: { seeded: true, levels: [{ min: 2, message: 'Vas volando' }] }, choreDays: [doneDay(1)] });
    render(<Harness initial={state} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 1 de 2');
    fireEvent.click(checkbox('Ducharme'));
    expect(screen.getByTestId('chores-message').textContent).toBe('Vas volando');
  });

  it('C7: con menos de 5 aplicables, completar todos los de hoy da el mensaje de «completaste todos», no de meta lejana', () => {
    const chores: Chore[] = [
      { id: 'a', name: 'Primero', days: [...ALL_DAYS], order: 0 },
      { id: 'b', name: 'Segundo', days: [...ALL_DAYS], order: 1 },
    ];
    render(<Harness initial={stateWith({ chores })} />);
    fireEvent.click(checkbox('Primero'));
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 1 de 2');
    fireEvent.click(checkbox('Segundo'));
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Completaste todos los quehaceres de hoy!');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('sin quehaceres hoy no hay barra ni division entre cero y se explica el vacio', () => {
    render(<Harness initial={stateWith({ chores: [{ id: 'x', name: 'Solo sábado', days: ['Sábado'], order: 0 }] })} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('Hoy no tienes quehaceres. Añade uno si quieres.');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(counter(0, 0).textContent).toBe('0/0');
  });
});

describe('ChoresCard: «Hoy no puedo»', () => {
  it('C8: marca el dia dificil con tono amable, sin barra de meta ni lenguaje de fallo', () => {
    render(<Harness initial={stateWith()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy no puedo' }));
    expect(screen.getByTestId('chores-message').textContent).toContain('día difícil y está bien');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hoy no puedo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
    expect(screen.getByTestId('chores-card').textContent).not.toMatch(/incumpl|fall|meta no/i);
  });

  it('permite indicar un motivo opcional y cambiarlo', () => {
    render(<Harness initial={stateWith()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy no puedo' }));
    const group = screen.getByRole('group');
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cansado', 'Agobiado', 'Enfermo', 'Otro']);
    fireEvent.click(within(group).getByRole('button', { name: 'Agobiado' }));
    expect(within(group).getByRole('button', { name: 'Agobiado' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'Enfermo' }));
    expect(within(group).getByRole('button', { name: 'Agobiado' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(group).getByRole('button', { name: 'Enfermo' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('C9: deshacer conserva lo ya marcado y el dia deja de ser dificil', () => {
    let latest: AppState | undefined;
    render(<Harness initial={stateWith({ choreDays: [doneDay(2)] })} onState={(state) => (latest = state)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy no puedo' }));
    expect(counter(2, 5)).toBeTruthy(); // marcar el dia dificil no borra nada
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('button', { name: 'Hoy no puedo' })).toBeTruthy();
    expect(counter(2, 5)).toBeTruthy();
    expect(checkbox('Tender la cama').checked).toBe(true);
    expect(checkbox('Pasear al perro').checked).toBe(true);
    expect(latest?.choreDays?.find((day) => day.date === TODAY)?.hard).toBe(false);
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 2 de 5');
  });

  it('se puede seguir marcando quehaceres en un dia dificil sin cambiar el tono', () => {
    render(<Harness initial={stateWith()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoy no puedo' }));
    fireEvent.click(checkbox('Ducharme'));
    expect(counter(1, 5)).toBeTruthy();
    expect(screen.getByTestId('chores-message').textContent).toContain('día difícil y está bien');
  });
});
