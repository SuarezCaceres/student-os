/**
 * Módulo APRENDIZAJE (reflexiones semanales). Colección de sync: `learning`
 * (un registro por WeeklyReflection; id = String(week), ver `weeklyReflectionRecordId`).
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';

export const ResourceTypeSchema = z.enum([
  'youtube',
  'tiktok',
  'instagram',
  'articulo',
  'documentacion',
  'libro',
  'texto',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceCategorySchema = z.enum([
  'ia_claude',
  'ia_gemini',
  'skills',
  'video_gen',
  'cursos',
  'conferencias',
  'reels_instagram',
  'general',
]);
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>;

export const LearningResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  type: ResourceTypeSchema,
  category: ResourceCategorySchema.optional(),
  notes: z.string().optional(),
});
export type LearningResource = z.infer<typeof LearningResourceSchema>;

export const ReflectionMoodSchema = z.enum(['increible', 'productivo', 'cansado', 'despejado']);
export type ReflectionMood = z.infer<typeof ReflectionMoodSchema>;

export const WeeklyReflectionSchema = z.object({
  week: z.number(),
  learnings: z.string(),
  keyConcepts: z.array(z.string()),
  resources: z.array(LearningResourceSchema),
  gymReflection: z.string().optional(),
  mood: ReflectionMoodSchema.optional(),
  updatedAt: z.string(),
});
export type WeeklyReflection = z.infer<typeof WeeklyReflectionSchema>;

/**
 * `AppState.weeklyReflections` es `{ [week: number]: WeeklyReflection }`.
 * En JSON las claves son siempre strings, por eso la clave se valida como
 * entero en texto ("5"). El tipo inferido es `Record<string, WeeklyReflection>`,
 * asignable al `{ [week: number]: ... }` original.
 */
export const WeeklyReflectionsMapSchema = z.record(z.string().regex(/^\d+$/), WeeklyReflectionSchema);
export type WeeklyReflectionsMap = z.infer<typeof WeeklyReflectionsMapSchema>;

/** Id de registro de sync para una reflexión: la semana en texto. */
export const weeklyReflectionRecordId = (week: number): string => String(week);

/** Esquema de `SyncRecord.data` para la colección `learning`. */
export const LearningRecordDataSchema = WeeklyReflectionSchema;
export type LearningRecordData = z.infer<typeof LearningRecordDataSchema>;
