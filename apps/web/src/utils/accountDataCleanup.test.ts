// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearLegacyLocalData } from './accountDataCleanup';

describe('clearLegacyLocalData (spec 009, C14)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('borra lo que dejo el prototipo y conserva el estado de la cuenta y la vinculacion actual', () => {
    const legacyLocal = [
      'student_os_user_session',
      'student_os_gcal_client_id',
      'student_os_cleaned_mock_calendar_v1',
      'student_os_work_shift_v1',
      'student_os_sync_imported_v1:user-1',
      'student_os_sync_imported_v1:user-2',
    ];
    for (const key of legacyLocal) window.localStorage.setItem(key, '1');
    window.sessionStorage.setItem('student_os_gcal_token', '{"accessToken":"ya29"}');
    window.localStorage.setItem('student_os_state_v1', '{"studentName":"Ana"}');
    window.localStorage.setItem('student_os_gcal_meta', '{"connected":true}');
    window.localStorage.setItem('otra_app', 'x');

    clearLegacyLocalData();

    for (const key of legacyLocal) expect(window.localStorage.getItem(key), key).toBeNull();
    expect(window.sessionStorage.getItem('student_os_gcal_token')).toBeNull();
    expect(window.localStorage.getItem('student_os_state_v1')).toBe('{"studentName":"Ana"}');
    expect(window.localStorage.getItem('student_os_gcal_meta')).toBe('{"connected":true}');
    expect(window.localStorage.getItem('otra_app')).toBe('x');
  });

  it('no falla si el almacenamiento esta bloqueado', () => {
    const blocked = {
      length: 0,
      key: () => null,
      removeItem: () => {
        throw new Error('bloqueado');
      },
    } as unknown as Storage;
    expect(() => clearLegacyLocalData(blocked, blocked)).not.toThrow();
  });
});
