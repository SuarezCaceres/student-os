// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Navbar, type NavbarProps } from './Navbar';

afterEach(() => cleanup());

const baseProps: NavbarProps = {
  activeTab: 'overview',
  setActiveTab: () => undefined,
  isDark: false,
  toggleTheme: () => undefined,
  onOpenQuickAdd: () => undefined,
  onResetData: () => undefined,
};

describe('Navbar: pestana Gym opcional (spec 011, C3)', () => {
  it('con el gym activo muestra «Gym» en escritorio y en movil', () => {
    render(<Navbar {...baseProps} />);
    // Una vez en la barra de escritorio y otra en la inferior de movil.
    expect(screen.getAllByText('Gym').length).toBeGreaterThanOrEqual(2);
  });

  it('con el gym desactivado no hay pestana «Gym» en ninguna barra y quedan las demas', () => {
    render(<Navbar {...baseProps} gymEnabled={false} />);
    expect(screen.queryByText('Gym')).toBeNull();
    expect(screen.queryByRole('button', { name: /Gym/ })).toBeNull();
    expect(screen.getAllByText('Kanban').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Horario').length).toBeGreaterThanOrEqual(1);
  });

  it('con el gym desactivado no muestra alertas de horario de gym aunque lleguen', () => {
    render(<Navbar {...baseProps} gymEnabled={false} gymScheduleAlertCount={3} />);
    expect(screen.queryByLabelText(/Gym:/)).toBeNull();
  });
});
