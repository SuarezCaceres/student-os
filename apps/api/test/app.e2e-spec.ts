import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { startJwksServer, type JwksServer } from './helpers/jwks-server';

const ALLOWED_ORIGIN = 'https://student-os.vercel.app';

/** Ruta que existe solo en los tests: fuerza un error interno con datos sensibles en el mensaje. */
@Controller('__test__')
class ProtectedTestController {
  @Get('boom')
  boom(): never {
    throw new Error('postgresql://user:SUPER-SECRETO@db.example.com:5432/postgres exploto');
  }
}

describe('API (e2e)', () => {
  let jwks: JwksServer;
  let app: INestApplication;

  async function createApp(): Promise<INestApplication> {
    // AppModule evalua ConfigModule al importarse: el entorno debe estar listo antes del import.
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService } = await import('../src/prisma/prisma.service');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedTestController],
    })
      // Sin base de datos viva: Prisma se sustituye por un doble.
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    const nestApp = moduleRef.createNestApplication({ logger: false });
    configureApp(nestApp);
    await nestApp.init();
    return nestApp;
  }

  beforeAll(async () => {
    jwks = await startJwksServer();
    process.env.SUPABASE_URL = jwks.url;
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.WEB_ORIGINS = `${ALLOWED_ORIGIN},http://localhost:5173`;
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:6543/db?pgbouncer=true';
    process.env.DIRECT_URL = 'postgresql://u:p@localhost:5432/db';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    await jwks.close();
  });

  describe('GET /health', () => {
    it('es publico y responde 200 con status, uptime y version', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });
    });

    it('no usa prefijo /api', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(404);
    });

    it('incluye cabeceras de seguridad de helmet y oculta x-powered-by', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('permite un origen de la lista blanca', async () => {
      const res = await request(app.getHttpServer()).get('/health').set('Origin', ALLOWED_ORIGIN).expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    it('no concede CORS a un origen ajeno', async () => {
      const res = await request(app.getHttpServer()).get('/health').set('Origin', 'https://evil.example.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('responde el preflight con las cabeceras permitidas', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/me')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });
  });

  describe('autenticacion', () => {
    it('401 sin token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(res.body.statusCode).toBe(401);
    });

    it('401 con un JWT invalido', async () => {
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    });

    it('401 con un JWT expirado', async () => {
      const token = await jwks.sign({ expiresInSeconds: -3600 });
      await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('GET /auth/me: 200 con un JWT valido y @CurrentUser() entrega id y email', async () => {
      const token = await jwks.sign({ sub: '33333333-3333-4333-8333-333333333333', email: 'ana@example.com' });
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual({ id: '33333333-3333-4333-8333-333333333333', email: 'ana@example.com' });
    });

    it('los modulos stub estan montados y no exponen datos sin token', async () => {
      // Controladores vacios: no hay handlers aun (404); cuando los agentes los rellenen, 401 sin token.
      for (const route of ['sync', 'profile', 'kanban', 'university', 'gym', 'calendar', 'google', 'public']) {
        const res = await request(app.getHttpServer()).get(`/${route}`);
        expect([401, 404]).toContain(res.status);
      }
    });
  });

  describe('filtro global de errores', () => {
    it('los 5xx no filtran el mensaje interno, secretos ni stack', async () => {
      const token = await jwks.sign();
      const res = await request(app.getHttpServer())
        .get('/__test__/boom')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      const serialized = JSON.stringify(res.body);
      expect(res.body.message).toBe('Error interno del servidor');
      expect(serialized).not.toContain('SUPER-SECRETO');
      expect(serialized).not.toContain('postgresql://');
      expect(serialized).not.toMatch(/at .*\.ts/);
      expect(res.body.stack).toBeUndefined();
    });

    it('una ruta inexistente devuelve 404 con el formato estandar', async () => {
      const token = await jwks.sign();
      const res = await request(app.getHttpServer())
        .get('/no-existe')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
    });
  });

  describe('rate limiting', () => {
    it('devuelve 429 al superar el limite por IP', async () => {
      const limited = await createApp();
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 125; i += 1) {
          const res = await request(limited.getHttpServer()).get('/auth/me');
          statuses.push(res.status);
        }
        expect(statuses.slice(0, 120).every((status) => status === 401)).toBe(true);
        expect(statuses.slice(120)).toContain(429);
      } finally {
        await limited.close();
      }
    });

    it('/health no se limita (sondeo del health check de Render)', async () => {
      const limited = await createApp();
      try {
        for (let i = 0; i < 130; i += 1) {
          await request(limited.getHttpServer()).get('/health').expect(200);
        }
      } finally {
        await limited.close();
      }
    });
  });
});
