/**
 * Primitivas compartidas entre módulos (días de la semana, categorías).
 *
 * REGLA (después de la Ola 1 este paquete es solo aditivo): cada agente edita
 * únicamente su propio archivo `src/<modulo>.ts`. Prohibido renombrar o borrar
 * tipos/esquemas ya publicados. Este archivo es de solo lectura tras la Ola 1.
 */
import { z } from 'zod';

export const DayOfWeekSchema = z.enum([
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

export const CategorySchema = z.enum(['universidad', 'trabajo', 'gym', 'personal']);
export type Category = z.infer<typeof CategorySchema>;
