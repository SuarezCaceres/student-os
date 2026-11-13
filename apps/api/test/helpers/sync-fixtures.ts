import { randomUUID } from 'node:crypto';
import type { Collection, SyncRecord } from '@student-os/shared';

/** "Ahora" fijo de los tests (reloj del servidor simulado). */
export const NOW = new Date('2026-11-13T12:00:00.000Z');

/** ISO `minutes` minutos despues (o antes, si es negativo) de `NOW`. */
export function at(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString();
}

export function newUserId(): string {
  return randomUUID();
}

export function kanbanData(title: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'k-x',
    title,
    status: 'todo',
    category: 'universidad',
    priority: 'media',
    createdAt: '2026-11-01',
    ...extra,
  };
}

/** Registro vivo de la coleccion `kanban` (el `id` de la entidad coincide con el del registro). */
export function kanbanRecord(id: string, updatedAt: string, title = `Tarea ${id}`, rev = 0): SyncRecord {
  return {
    id,
    collection: 'kanban',
    data: kanbanData(title, { id }),
    updatedAt,
    deletedAt: null,
    rev,
  };
}

/** Tombstone: borrado logico (su `data` se descarta). */
export function tombstone(id: string, updatedAt: string, collection: Collection = 'kanban'): SyncRecord {
  return { id, collection, data: null, updatedAt, deletedAt: updatedAt, rev: 0 };
}

export function profileRecord(updatedAt: string, studentName = 'Ana'): SyncRecord {
  return {
    id: 'profile',
    collection: 'profile',
    data: { studentName, career: 'Ingenieria', currentAcademicWeek: 3, streak: 2, theme: 'dark' },
    updatedAt,
    deletedAt: null,
    rev: 0,
  };
}

/** Solo los campos comparables de un registro devuelto (para `toEqual` legibles). */
export function titleOf(record: SyncRecord): string | undefined {
  return (record.data as { title?: string } | null)?.title;
}
