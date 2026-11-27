// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { initialData } from '../../data/initialData';
import { QuickAddModal } from './QuickAddModal';

afterEach(() => cleanup());

const noop = () => undefined;
const props = {
  isOpen: true,
  onClose: noop,
  state: initialData,
  onAddAssignment: noop,
  onAddGymExercise: noop,
  onAddKanbanItem: noop,
  onAddCalendarBlock: noop,
};

describe('QuickAddModal: gym opcional (spec 011, C4)', () => {
  it('con el gym activo ofrece la pestana Gym', () => {
    render(<QuickAddModal {...props} />);
    expect(screen.getByRole('tab', { name: 'Gym' })).toBeTruthy();
  });

  it('con el gym desactivado no ofrece la pestana Gym', () => {
    render(<QuickAddModal {...props} gymEnabled={false} />);
    expect(screen.queryByRole('tab', { name: 'Gym' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Uni' })).toBeTruthy();
  });

  it('si se pide abrir en Gym con el gym desactivado, cae en Uni y no muestra el formulario de ejercicio', () => {
    render(<QuickAddModal {...props} gymEnabled={false} initialTab="gym" />);
    expect(screen.getByRole('tab', { name: 'Uni', selected: true })).toBeTruthy();
    expect(screen.queryByPlaceholderText('Ej. Press inclinado con mancuernas')).toBeNull();
  });
});
