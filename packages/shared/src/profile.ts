/**
 * Módulo PERFIL. Colección de sync: `profile` con UN solo registro singleton
 * (id = PROFILE_RECORD_ID) cuyo `data` es el `Profile` completo.
 * Cubre studentName, career, currentAcademicWeek, streak y theme.
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';

export const ThemeSchema = z.enum(['dark', 'light']);
export type Theme = z.infer<typeof ThemeSchema>;

export const ProfileSchema = z.object({
  studentName: z.string(),
  career: z.string(),
  currentAcademicWeek: z.number(),
  streak: z.number(),
  theme: ThemeSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PROFILE_RECORD_ID = 'profile';

/** Esquema de `SyncRecord.data` para la colección `profile`. */
export const ProfileRecordDataSchema = ProfileSchema;
export type ProfileRecordData = z.infer<typeof ProfileRecordDataSchema>;
