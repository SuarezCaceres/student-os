import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from '../auth';

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

@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  check(): { status: 'ok'; uptime: number; version: string } {
    return { status: 'ok', uptime: Math.round(process.uptime()), version: VERSION };
  }
}
