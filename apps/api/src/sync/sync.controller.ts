import { Controller } from '@nestjs/common';

// Agente SYNC-API rellena este controlador; no editar app.module.ts.
// Las rutas son protegidas por defecto (guard global de Supabase JWT); usa @Public() para excluir una.
@Controller('sync')
export class SyncController {}
