import { describe, expect, it } from 'vitest';
import { initialData } from '../data/initialData';
import { MOCK_CALENDAR_BLOCK_IDS } from './accountDataCleanup';
import { buildNewAccountState, getAccountDisplayName } from './newAccountState';

describe('getAccountDisplayName', () => {
  it('usa full_name y, si no, name', () => {
    expect(getAccountDisplayName({ user_metadata: { full_name: ' Ana García ', name: 'otro' } })).toBe('Ana García');
    expect(getAccountDisplayName({ user_metadata: { name: 'Luis' } })).toBe('Luis');
  });

  it('devuelve undefined si la cuenta no trae nombre', () => {
    expect(getAccountDisplayName({ user_metadata: {} })).toBeUndefined();
    expect(getAccountDisplayName({ user_metadata: { full_name: '   ' } })).toBeUndefined();
    expect(getAccountDisplayName({ user_metadata: { full_name: 42 } })).toBeUndefined();
    expect(getAccountDisplayName(null)).toBeUndefined();
  });
});

describe('buildNewAccountState', () => {
  it('quita los bloques de horario de ejemplo y pone el nombre de pila de la cuenta', () => {
    expect(initialData.calendarBlocks.some((b) => MOCK_CALENDAR_BLOCK_IDS.has(b.id))).toBe(true);
    const next = buildNewAccountState(initialData, 'Ana María García');
    expect(next.studentName).toBe('Ana');
    expect(next.calendarBlocks.some((b) => MOCK_CALENDAR_BLOCK_IDS.has(b.id))).toBe(false);
  });

  it('sin nombre conserva el del estado de partida', () => {
    expect(buildNewAccountState(initialData).studentName).toBe(initialData.studentName);
    expect(buildNewAccountState(initialData, '  ').studentName).toBe(initialData.studentName);
  });

  it('es pura: el mismo resultado en cada dispositivo y no modifica el estado de partida', () => {
    const before = JSON.stringify(initialData);
    expect(buildNewAccountState(initialData, 'Ana')).toEqual(buildNewAccountState(initialData, 'Ana'));
    expect(JSON.stringify(initialData)).toBe(before);
  });
});
