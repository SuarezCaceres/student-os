/**
 * Módulo UNIVERSIDAD. Colección de sync: `university`
 * (un registro por UniversityAssignment, id = assignment.id).
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';

export const AssignmentTypeSchema = z.enum(['tarea', 'proyecto', 'examen', 'laboratorio']);
export type AssignmentType = z.infer<typeof AssignmentTypeSchema>;

export const AssignmentStatusSchema = z.enum(['pendiente', 'en_progreso', 'entregado']);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const RubricCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const UniversityAssignmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  course: z.string(),
  week: z.number(),
  dueDate: z.string(),
  status: AssignmentStatusSchema,
  type: AssignmentTypeSchema,
  weightPercentage: z.number().optional(),
  notes: z.string().optional(),
  gradeObtained: z.number().optional(),
  maxGrade: z.number().optional(),
  submissionUrl: z.string().optional(),
  rubricCriteria: z.array(RubricCriterionSchema).optional(),
});
export type UniversityAssignment = z.infer<typeof UniversityAssignmentSchema>;

/** Esquema de `SyncRecord.data` para la colección `university`. */
export const UniversityRecordDataSchema = UniversityAssignmentSchema;
export type UniversityRecordData = z.infer<typeof UniversityRecordDataSchema>;
