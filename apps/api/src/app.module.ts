import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { SupabaseJwtGuard } from './auth/supabase-jwt.guard';
import { CalendarModule } from './calendar/calendar.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { Env, validateEnv } from './config/env.schema';
import { GoogleModule } from './google/google.module';
import { GymModule } from './gym/gym.module';
import { HealthModule } from './health/health.module';
import { KanbanModule } from './kanban/kanban.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { PublicModule } from './public/public.module';
import { SyncModule } from './sync/sync.module';
import { UniversityModule } from './university/university.module';

/**
 * Modulo raiz. ARCHIVO FINAL (API-CORE): ningun agente posterior debe editarlo.
 * Cada modulo de dominio ya esta registrado como stub; los agentes solo rellenan su carpeta.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level: nodeEnv === 'test' ? 'silent' : nodeEnv === 'production' ? 'info' : 'debug',
            // Jamas registrar credenciales.
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
              remove: true,
            },
            autoLogging: { ignore: (req) => req.url === '/health' },
          },
        };
      },
    }),
    // Limite global por IP: 120 peticiones/minuto. PUBLIC puede afinar con @Throttle por ruta.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
    // Modulos de dominio (stubs). Agente responsable entre parentesis.
    SyncModule, // SYNC-API (Ola 2)
    ProfileModule, // SYNC-API (Ola 2)
    KanbanModule, // KANBAN-UNI (Ola 3)
    UniversityModule, // KANBAN-UNI (Ola 3)
    GymModule, // GYM (Ola 3)
    CalendarModule, // CALENDAR (Ola 3)
    GoogleModule, // GOOGLE (Ola 3)
    PublicModule, // PUBLIC (Ola 3)
  ],
  providers: [
    // El orden importa: primero limitar (frena fuerza bruta sobre tokens invalidos), luego autenticar.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
