// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../data/initialData';
import { useChores } from '../../hooks/useChores';
import type { AppState, Chore, DayOfWeek } from '../../types';
import { ALL_DAYS, buildChoreSeed, CHORE_EDIT_ERROR_MESSAGES } from '../../utils/chores';
import { ChoresCard } from './ChoresCard';

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
const baseState = (extra: Partial<AppState> = {}): AppState => ({
  ...initialData,
  chores: seeded.chores,
  choreSettings: seeded.choreSettings,
  choreDays: [],
  ...extra,
});

/** Tarjeta + editor con el hook REAL; `onState` deja ver el estado guardado para simular «recargar». */
function Harness({ initial, onState }: { initial: AppState; onState?: (state: AppState) => void }) {
  const [state, setState] = useState<AppState>(initial);
  onState?.(state);
  const chores = useChores(state, setState, { syncReady: true });
  return <ChoresCard chores={chores} />;
}

const openEditor = () => fireEvent.click(screen.getByRole('button', { name: 'Editar quehaceres y metas' }));
const nameInput = (name: string) => screen.getByLabelText(`Nombre de ${name}`) as HTMLInputElement;
const todayBox = (name: string) => screen.queryByRole('checkbox', { name });
const daysGroup = (name: string) => screen.getByRole('group', { name: `Días de ${name}` });
const addChore = (name: string) => {
  fireEvent.change(screen.getByLabelText('Nuevo quehacer'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
};

describe('ChoresEditor: lista de quehaceres', () => {
  it('C2: añadir un quehacer lo muestra en la tarjeta y se conserva al recargar', () => {
    let latest: AppState | undefined;
    const { unmount } = render(<Harness initial={baseState()} onState={(state) => (latest = state)} />);
    openEditor();
    addChore('Caminar 15 minutos');
    expect(todayBox('Caminar 15 minutos')).toBeTruthy();
    expect((screen.getByLabelText('Nuevo quehacer') as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('0 de 6 quehaceres completados')).toBeTruthy();

    unmount();
    cleanup();
    render(<Harness initial={latest!} />);
    expect(todayBox('Caminar 15 minutos')).toBeTruthy();
  });

  it('C2: renombrar actualiza la lista y el historial conserva el nombre con el que se completó', () => {
    let latest: AppState | undefined;
    const done = { date: TODAY, hard: false, completed: [{ choreId: 'chore-base-3', name: 'Ducharme' }] };
    render(<Harness initial={baseState({ choreDays: [done] })} onState={(state) => (latest = state)} />);
    openEditor();
    fireEvent.change(nameInput('Ducharme'), { target: { value: 'Ducha rápida' } });
    fireEvent.blur(nameInput('Ducharme'));
    expect(todayBox('Ducha rápida')).toBeTruthy();
    expect(todayBox('Ducharme')).toBeNull();
    expect(latest?.chores?.find((chore) => chore.id === 'chore-base-3')?.name).toBe('Ducha rápida');
    expect(latest?.choreDays?.[0].completed[0].name).toBe('Ducharme'); // C11
  });

  it('C2: eliminar pide confirmación, quita el quehacer y conserva lo completado en el historial', () => {
    let latest: AppState | undefined;
    const done = { date: TODAY, hard: false, completed: [{ choreId: 'chore-base-2', name: 'Pasear al perro' }] };
    render(<Harness initial={baseState({ choreDays: [done] })} onState={(state) => (latest = state)} />);
    openEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Pasear al perro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(todayBox('Pasear al perro')).toBeTruthy(); // cancelar no borra

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Pasear al perro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar Pasear al perro' }));
    expect(todayBox('Pasear al perro')).toBeNull();
    expect(latest?.chores?.some((chore) => chore.id === 'chore-base-2')).toBe(false);
    expect(latest?.choreDays?.[0].completed).toHaveLength(1);
  });

  it('rechaza un nombre vacío al renombrar y explica por qué', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    fireEvent.change(nameInput('Ducharme'), { target: { value: '   ' } });
    fireEvent.blur(nameInput('Ducharme'));
    expect(screen.getByRole('alert').textContent).toBe(CHORE_EDIT_ERROR_MESSAGES.empty);
    expect(todayBox('Ducharme')).toBeTruthy();
  });

  it('rechaza un nombre vacío o demasiado largo al añadir', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(screen.getByRole('alert').textContent).toBe(CHORE_EDIT_ERROR_MESSAGES.empty);
    addChore('x'.repeat(81));
    expect(screen.getByRole('alert').textContent).toBe(CHORE_EDIT_ERROR_MESSAGES['too-long']);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('avisa de un nombre repetido pero permite añadirlo', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    fireEvent.change(screen.getByLabelText('Nuevo quehacer'), { target: { value: 'ducharme' } });
    expect(screen.getByRole('status').textContent).toContain('Ya tienes un quehacer con ese nombre');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(screen.getAllByRole('checkbox', { name: /ducharme/i })).toHaveLength(2);
  });

  it('respeta el límite de 30 quehaceres: deshabilita añadir y lo explica', () => {
    const chores: Chore[] = Array.from({ length: 29 }, (_, index) => ({ id: `c-${index}`, name: `Tarea ${index + 1}`, days: [...ALL_DAYS], order: index }));
    render(<Harness initial={baseState({ chores })} />);
    openEditor();
    expect(screen.getByText('29/30')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Añadir' }) as HTMLButtonElement).disabled).toBe(false);
    addChore('La número 30');
    expect(screen.getByText('30/30')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Añadir' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(CHORE_EDIT_ERROR_MESSAGES.limit)).toBeTruthy();
  });
});

describe('ChoresEditor: días de la semana', () => {
  const clickDays = (group: HTMLElement, days: DayOfWeek[]) => days.forEach((day) => fireEvent.click(within(group).getByRole('button', { name: day })));

  it('C3: un quehacer que no toca hoy sale de la tarjeta y vuelve cuando se activa el día', () => {
    let latest: AppState | undefined;
    render(<Harness initial={baseState()} onState={(state) => (latest = state)} />);
    openEditor();
    // Solo sábado: hoy es miércoles.
    clickDays(daysGroup('Ducharme'), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Domingo']);
    expect(latest?.chores?.find((chore) => chore.id === 'chore-base-3')?.days).toEqual(['Sábado']);
    expect(todayBox('Ducharme')).toBeNull();
    expect(screen.getByLabelText('0 de 4 quehaceres completados')).toBeTruthy();

    clickDays(daysGroup('Ducharme'), ['Miércoles']);
    expect(todayBox('Ducharme')).toBeTruthy();
    expect(screen.getByLabelText('0 de 5 quehaceres completados')).toBeTruthy();
  });

  it('exige al menos un día de la semana', () => {
    render(<Harness initial={baseState({ chores: [{ id: 'a', name: 'Solo miércoles', days: ['Miércoles'], order: 0 }] })} />);
    openEditor();
    clickDays(daysGroup('Solo miércoles'), ['Miércoles']);
    expect(screen.getByRole('alert').textContent).toBe(CHORE_EDIT_ERROR_MESSAGES['no-days']);
    expect(within(daysGroup('Solo miércoles')).getByRole('button', { name: 'Miércoles' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('un quehacer nuevo se crea solo en los días elegidos', () => {
    let latest: AppState | undefined;
    render(<Harness initial={baseState()} onState={(state) => (latest = state)} />);
    openEditor();
    const group = screen.getByRole('group', { name: 'Días del nuevo quehacer' });
    clickDays(group, ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Domingo']);
    addChore('Ir al mercado');
    expect(latest?.chores?.find((chore) => chore.name === 'Ir al mercado')?.days).toEqual(['Sábado']);
    expect(todayBox('Ir al mercado')).toBeNull(); // hoy es miércoles
  });
});

describe('ChoresEditor: metas y mensajes', () => {
  const levelMin = (n: number) => screen.getByRole('spinbutton', { name: `Cantidad de la meta ${n}` }) as HTMLInputElement;
  const levelMessage = (n: number) => screen.getByRole('textbox', { name: `Mensaje de la meta ${n}` }) as HTMLInputElement;

  it('muestra por defecto 5 = «¡Eres lo máximo!» y 10 = «¡Sigue así!»', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    expect(levelMin(1).value).toBe('5');
    expect(levelMessage(1).value).toBe('¡Eres lo máximo!');
    expect(levelMin(2).value).toBe('10');
    expect(levelMessage(2).value).toBe('¡Sigue así!');
  });

  it('C6: guardar nuevos umbrales y mensajes los aplica a la tarjeta y se conserva', () => {
    let latest: AppState | undefined;
    const { unmount } = render(<Harness initial={baseState()} onState={(state) => (latest = state)} />);
    openEditor();
    fireEvent.change(levelMin(1), { target: { value: '2' } });
    fireEvent.change(levelMessage(1), { target: { value: '¡Buen arranque!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(screen.getByText('Metas guardadas.')).toBeTruthy();
    expect(latest?.choreSettings?.levels[0]).toEqual({ min: 2, message: '¡Buen arranque!' });

    fireEvent.click(todayBox('Tender la cama')!);
    expect(screen.getByTestId('chores-message').textContent).toBe('Llevas 1 de 2');
    fireEvent.click(todayBox('Ducharme')!);
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Buen arranque!');

    unmount();
    cleanup();
    render(<Harness initial={latest!} />);
    expect(screen.getByTestId('chores-message').textContent).toBe('¡Buen arranque!');
  });

  it('rechaza cantidades repetidas o mensajes vacíos con el error del contrato', () => {
    let latest: AppState | undefined;
    render(<Harness initial={baseState()} onState={(state) => (latest = state)} />);
    openEditor();
    fireEvent.change(levelMin(2), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(screen.getByText(CHORE_EDIT_ERROR_MESSAGES['invalid-levels'])).toBeTruthy();
    fireEvent.change(levelMin(2), { target: { value: '10' } });
    fireEvent.change(levelMessage(1), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metas' }));
    expect(screen.getByText(CHORE_EDIT_ERROR_MESSAGES['invalid-levels'])).toBeTruthy();
    expect(latest?.choreSettings?.levels).toEqual([
      { min: 5, message: '¡Eres lo máximo!' },
      { min: 10, message: '¡Sigue así!' },
    ]);
  });

  it('permite añadir, quitar y restaurar las metas por defecto', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir meta' }));
    expect(levelMin(3).value).toBe('15');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar la meta 3' }));
    expect(screen.queryByRole('spinbutton', { name: 'Cantidad de la meta 3' })).toBeNull();
    fireEvent.change(levelMessage(1), { target: { value: 'Otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valores por defecto' }));
    expect(levelMessage(1).value).toBe('¡Eres lo máximo!');
  });
});

describe('ChoresEditor: accesibilidad del modal', () => {
  it('se abre como diálogo con título y se cierra con «Listo»', () => {
    render(<Harness initial={baseState()} />);
    openEditor();
    const dialog = screen.getByRole('dialog', { name: 'Editar quehaceres' });
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('desde el vacío de hoy, «Añadir un quehacer» abre el editor', () => {
    render(<Harness initial={baseState({ chores: [{ id: 'x', name: 'Solo sábado', days: ['Sábado'], order: 0 }] })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir un quehacer' }));
    expect(screen.getByRole('dialog', { name: 'Editar quehaceres' })).toBeTruthy();
  });
});
