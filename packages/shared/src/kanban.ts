/**
 * Módulo KANBAN. Colección de sync: `kanban` (un registro por KanbanItem, id = item.id).
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';
import { CategorySchema } from './common';

export const PrioritySchema = z.enum(['baja', 'media', 'alta']);
export type Priority = z.infer<typeof PrioritySchema>;

export const KanbanStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export type KanbanStatus = z.infer<typeof KanbanStatusSchema>;

export const KanbanChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
});
export type KanbanChecklistItem = z.infer<typeof KanbanChecklistItemSchema>;

export const KanbanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: KanbanStatusSchema,
  category: CategorySchema,
  priority: PrioritySchema,
  dueDate: z.string().optional(),
  createdAt: z.string(),
  checklist: z.array(KanbanChecklistItemSchema).optional(),
  tags: z.array(z.string()).optional(),
});
export type KanbanItem = z.infer<typeof KanbanItemSchema>;

/** Esquema de `SyncRecord.data` para la colección `kanban`. */
export const KanbanRecordDataSchema = KanbanItemSchema;
export type KanbanRecordData = z.infer<typeof KanbanRecordDataSchema>;
