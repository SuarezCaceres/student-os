import { AppStateSchema } from '@student-os/shared';
import { describe, expect, it } from 'vitest';
import { buildNewAccountState } from '../utils/newAccountState';
import { emptyAppState } from './emptyState';
import { initialData } from './initialData';

describe('emptyAppState (spec 010, C5)', () => {
  it('no trae datos en ningun modulo', () => {
    expect(emptyAppState.kanbanItems).toEqual([]);
    expect(emptyAppState.universityAssignments).toEqual([]);
    expect(emptyAppState.gymRoutines).toEqual([]);
    expect(emptyAppState.calendarBlocks).toEqual([]);
    expect(emptyAppState.weeklyReflections).toEqual({});
    expect(emptyAppState.streak).toBe(0);
    expect(emptyAppState.currentAcademicWeek).toBe(1);
  });

  it('no contiene nada de los datos de ejemplo de Mateo', () => {
    const text = JSON.stringify(emptyAppState);
    expect(text).not.toContain('Mateo');
    expect(text).not.toContain(initialData.career);
  });

  it('cumple el contrato compartido (se puede sincronizar tal cual)', () => {
    expect(AppStateSchema.safeParse(emptyAppState).success).toBe(true);
  });

  it('una cuenta nueva usa el nombre de pila de Google y sigue vacia', () => {
    const next = buildNewAccountState(emptyAppState, 'Ana María García');
    expect(next).toEqual({ ...emptyAppState, studentName: 'Ana' });
  });
});
