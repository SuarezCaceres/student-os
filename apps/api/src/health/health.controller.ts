import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from '../auth';
import { HealthService } from './health.service';

function readVersion(): string {
  try {
    // Funciona igual desde src/ (ts-jest) y dist/ (build): ambos estan a dos niveles de package.json.
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const VERSION = readVersion();

export type ReadinessBody = { status: 'ok'; db: 'ok' } | { status: 'error'; db: 'error' };

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @SkipThrottle()
  @Get()
  check(): { status: 'ok'; uptime: number; version: string } {
    return { status: 'ok', uptime: Math.round(process.uptime()), version: VERSION };
  }

  /**
   * Preparacion: ademas de estar viva, la API llega a la base de datos (`SELECT 1`). 200 si responde, 503 si no.
   * La respuesta nunca incluye el detalle del error.
   */
  @Public()
  @SkipThrottle()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessBody> {
    if (await this.health.isDatabaseReady()) {
      return { status: 'ok', db: 'ok' };
    }
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'error', db: 'error' };
  }
}
