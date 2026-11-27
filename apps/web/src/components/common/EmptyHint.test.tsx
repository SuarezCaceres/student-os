// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyHint } from './EmptyHint';

afterEach(() => cleanup());

describe('EmptyHint (spec 010, C5)', () => {
  it('muestra el titulo y el texto como una nota informativa', () => {
    render(<EmptyHint title="Tu espacio está listo">Empieza por una tarea.</EmptyHint>);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Tu espacio está listo');
    expect(note.textContent).toContain('Empieza por una tarea.');
  });

  it('sin titulo ni atajos solo pinta el texto', () => {
    render(<EmptyHint>Aún no tienes tareas.</EmptyHint>);
    expect(screen.getByRole('note').textContent).toBe('Aún no tienes tareas.');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('cada atajo es un boton que ejecuta su accion', () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <EmptyHint
        actions={[
          { label: 'Escribir una tarea', onClick: first },
          { label: 'Agendar un bloque', onClick: second },
        ]}
      >
        Primeros pasos
      </EmptyHint>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agendar un bloque' }));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
