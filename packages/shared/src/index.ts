/**
 * @student-os/shared — contrato compartido web <-> api.
 *
 * REGLA: después de la Ola 1 este paquete es SOLO ADITIVO. Cada agente edita
 * únicamente su archivo (`src/<modulo>.ts`). Prohibido renombrar o borrar
 * tipos/esquemas publicados. `index.ts` solo reexporta; si se agrega un módulo
 * nuevo, el Integrador añade su línea aquí.
 */
export * from './common';
export * from './kanban';
export * from './university';
export * from './learning';
export * from './gym';
export * from './workShift';
export * from './habits';
export * from './calendar';
export * from './profile';
export * from './appState';
export * from './sync';
