import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { startJwksServer, type JwksServer } from './helpers/jwks-server';
import { startPublicPg, type PublicPg } from './helpers/public-pg';
import { at, kanbanRecord, newUserId, profileRecord, tombstone } from './helpers/sync-fixtures';
import { clearAccountDeletionHooksForTests, registerAccountDeletionHook } from '../src/common/account-deletion';
import {
  clearAccountExportContributorsForTests,
  registerAccountExportContributor,
} from '../src/public/account-export.registry';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * PUBLIC e2e: HTTP real (supertest) con el guard real de Supabase JWT (JWKS local), AppModule completo y
 * Postgres REAL embebido (puerto base 54335 + E2E_PORT_OFFSET, schema privado `dev_public`, `prisma db push`). Sin Docker, sin Supabase.
 */
jest.setTimeout(180_000);

// Tablas de la app (orden alfabetico, como las devuelve la consulta). Las de Google guardan secretos cifrados.
const APP_TABLES = ['google_connections', 'google_oauth_states', 'profiles', 'sync_records', 'user_sync_state'];

describe('Cuenta publica: exportar y borrar (e2e sobre Postgres real)', () => {
  let pg: PublicPg;
  let jwks: JwksServer;
  let app: INestApplication;
  let prisma: PrismaService;

  /** Estado de un "modulo externo" simulado (como GOOGLE): lo que guarda por usuario. */
  const external = new Map<string, string>();
  let externalFails = false;
  const externalCalls: string[] = [];

  beforeAll(async () => {
    pg = await startPublicPg();
    jwks = await startJwksServer();
    process.env.SUPABASE_URL = jwks.url;
    process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
    process.env.WEB_ORIGINS = 'http://localhost:5173';
    process.env.DATABASE_URL = pg.url;
    process.env.DIRECT_URL = pg.url;

    clearAccountDeletionHooksForTests();
    clearAccountExportContributorsForTests();
    registerAccountDeletionHook({
      name: 'modulo-externo',
      run: async (userId) => {
        externalCalls.push(userId);
        if (externalFails) throw new Error('token-secreto 1//abcdefghijklmnopqrstuvwxyz ana@example.com');
        external.delete(userId);
      },
    });
    registerAccountExportContributor({
      name: 'modulo-externo',
      collect: async (userId) => ({ conectado: external.has(userId) }),
    });

    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService: PrismaServiceClass } = await import('../src/prisma/prisma.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaServiceClass);
  });

  afterAll(async () => {
    clearAccountDeletionHooksForTests();
    clearAccountExportContributorsForTests();
    await app?.close();
    await jwks?.close();
    await pg?.stop();
  });

  const http = () => request(app.getHttpServer());
  const auth = async (userId: string, email = `${userId.slice(0, 8)}@example.com`) => ({
    Authorization: `Bearer ${await jwks.sign({ sub: userId, email })}`,
  });

  /** Crea un usuario con datos en sync (3 registros), perfil y datos del modulo externo. */
  async function seedUser(label: string) {
    const id = newUserId();
    const headers = await auth(id);
    await http()
      .post('/sync/push')
      .set(headers)
      .send({ changes: [kanbanRecord('t1', at(-10), `${label}-uno`), kanbanRecord('t2', at(-9), `${label}-dos`), profileRecord(at(-8), label)] })
      .expect(200);
    external.set(id, `token-de-${label}`);
    return { id, headers, label };
  }

  async function dbCounts(userId: string) {
    return {
      records: await prisma.syncItem.count({ where: { userId } }),
      state: await prisma.userSyncState.count({ where: { userId } }),
      profile: await prisma.profile.count({ where: { id: userId } }),
    };
  }

  describe('autenticacion', () => {
    it('GET /account/export y DELETE /account sin token -> 401', async () => {
      await http().get('/account/export').expect(401);
      await http().delete('/account').send({ confirm: 'BORRAR' }).expect(401);
    });

    it('token de otro emisor/expirado -> 401', async () => {
      const expired = await jwks.sign({ sub: newUserId(), expiresInSeconds: -3600 });
      await http().get('/account/export').set('Authorization', `Bearer ${expired}`).expect(401);
    });
  });

  describe('exportacion', () => {
    it('descarga SOLO los datos del propio usuario, con cabeceras de descarga y sin cache', async () => {
      const a = await seedUser('ana');
      const b = await seedUser('beto');
      // Un registro borrado (tombstone) no se exporta.
      await http().post('/sync/push').set(a.headers).send({ changes: [tombstone('t2', at(-1))] }).expect(200);

      const res = await http().get('/account/export').set(a.headers).expect(200);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="studentos-datos-\d{4}-\d{2}-\d{2}\.json"$/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['permissions-policy']).toContain('camera=()');
      expect(res.headers['x-content-type-options']).toBe('nosniff'); // helmet sigue activo

      const body = JSON.parse(res.text) as {
        schemaVersion: number;
        account: { id: string; email: string };
        records: { collection: string; id: string; data: Record<string, unknown> }[];
        counts: { total: number; byCollection: Record<string, number> };
        extras: Record<string, unknown>;
      };
      expect(body.schemaVersion).toBe(1);
      expect(body.account).toMatchObject({ id: a.id, email: `${a.id.slice(0, 8)}@example.com` });
      expect(body.records.map((r) => r.id).sort()).toEqual(['profile', 't1']);
      expect(body.counts).toEqual({ total: 2, byCollection: { kanban: 1, profile: 1 } });
      expect(body.extras).toEqual({ 'modulo-externo': { conectado: true } });
      const serialized = res.text;
      expect(serialized).not.toContain(b.id);
      expect(serialized).not.toContain('beto-');
      expect(serialized).not.toContain('token-de-');
    });

    it('ignora cualquier userId enviado por query/cabecera: siempre el del JWT', async () => {
      const a = await seedUser('ana');
      const b = await seedUser('beto');
      const res = await http()
        .get(`/account/export?userId=${b.id}&id=${b.id}`)
        .set(a.headers)
        .set('X-User-Id', b.id)
        .expect(200);
      expect(res.text).toContain('ana-uno');
      expect(res.text).not.toContain('beto-uno');
    });

    it('usuario nuevo sin datos: 200 con listas vacias', async () => {
      const res = await http().get('/account/export').set(await auth(newUserId())).expect(200);
      expect(JSON.parse(res.text)).toMatchObject({ records: [], counts: { total: 0, byCollection: {} } });
    });
  });

  describe('borrado', () => {
    it('exige confirmacion explicita: sin cuerpo o con valor incorrecto -> 400 y NO se borra nada', async () => {
      const a = await seedUser('ana');
      await http().delete('/account').set(a.headers).expect(400);
      await http().delete('/account').set(a.headers).send({}).expect(400);
      const wrong = await http().delete('/account').set(a.headers).send({ confirm: 'borrar' }).expect(400);
      expect(JSON.stringify(wrong.body.message)).toContain('BORRAR');
      expect(await dbCounts(a.id)).toEqual({ records: 3, state: 1, profile: 1 });
      expect(external.has(a.id)).toBe(true);
    });

    it('borra TODO lo del usuario A (sync, estado, perfil, modulo externo) y deja intacto a B', async () => {
      const a = await seedUser('ana');
      const b = await seedUser('beto');
      await http().get('/profile').set(a.headers).expect(200); // asegura el perfil
      expect(await dbCounts(a.id)).toEqual({ records: 3, state: 1, profile: 1 });
      const bBefore = await dbCounts(b.id);
      const bDump = await prisma.syncItem.findMany({ where: { userId: b.id }, orderBy: { id: 'asc' } });

      const res = await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        deleted: true,
        modules: expect.arrayContaining([
          { name: 'modulo-externo', ok: true },
          { name: 'google', ok: true }, // gancho real de GoogleModule (revoca y borra su conexion)
        ]),
        syncRecordsDeleted: 3,
        profileDeleted: true,
        authUser: 'not_deleted',
      });

      expect(await dbCounts(a.id)).toEqual({ records: 0, state: 0, profile: 0 });
      expect(external.has(a.id)).toBe(false);
      expect(externalCalls).toContain(a.id);
      expect(externalCalls).not.toContain(b.id);

      // B intacto: mismas filas, mismo contenido, mismo perfil, mismo modulo externo.
      expect(await dbCounts(b.id)).toEqual(bBefore);
      expect(await prisma.syncItem.findMany({ where: { userId: b.id }, orderBy: { id: 'asc' } })).toEqual(bDump);
      expect(external.has(b.id)).toBe(true);
      const bExport = await http().get('/account/export').set(b.headers).expect(200);
      expect(JSON.parse(bExport.text).counts.total).toBe(3);
    });

    it('es idempotente: borrar dos veces no falla', async () => {
      const a = await seedUser('ana');
      await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(200);
      const again = await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(200);
      expect(again.body).toMatchObject({ deleted: true, syncRecordsDeleted: 0, profileDeleted: false });
      expect(await dbCounts(a.id)).toEqual({ records: 0, state: 0, profile: 0 });
    });

    it('si un gancho falla: 424 con detalle por modulo (sin datos sensibles), no se borra nada y el reintento funciona', async () => {
      const a = await seedUser('ana');
      externalFails = true;
      const failed = await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(424);
      expect(failed.body.statusCode).toBe(424);
      expect(failed.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('modulo-externo: fallo')]),
      );
      const text = JSON.stringify(failed.body);
      expect(text).not.toMatch(/token-secreto|ana@example|1\/\//);
      expect(await dbCounts(a.id)).toEqual({ records: 3, state: 1, profile: 1 });
      expect(external.has(a.id)).toBe(true);

      // El modulo se recupera y el usuario reintenta.
      externalFails = false;
      await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(200);
      expect(await dbCounts(a.id)).toEqual({ records: 0, state: 0, profile: 0 });
      expect(external.has(a.id)).toBe(false);
    });

    it('tras borrar, el mismo JWT sigue siendo valido pero la cuenta empieza vacia (no se filtran datos viejos)', async () => {
      const a = await seedUser('ana');
      await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(200);
      const pulled = await http().get('/sync/pull').set(a.headers).expect(200);
      expect(pulled.body.records).toEqual([]);
    });
  });

  describe('limite de frecuencia', () => {
    it('la exportacion se limita por USUARIO (5 / 10 min): el 6.o recibe 429 con Retry-After; otro usuario desde la misma IP no se ve afectado', async () => {
      const a = await seedUser('ana');
      const b = await seedUser('beto');
      for (let i = 0; i < 5; i += 1) {
        await http().get('/account/export').set(a.headers).expect(200);
      }
      const limited = await http().get('/account/export').set(a.headers).expect(429);
      expect(limited.headers['retry-after']).toBeDefined();
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      expect(limited.headers['retry-after-user']).toBeUndefined();
      expect(JSON.stringify(limited.body.message)).toMatch(/Demasiadas solicitudes/);

      // Mismo origen (127.0.0.1), otro usuario: sigue pudiendo exportar.
      await http().get('/account/export').set(b.headers).expect(200);
    });

    it('el borrado tambien se limita por usuario, pero un 400 de confirmacion cuenta como intento', async () => {
      const a = await seedUser('ana');
      for (let i = 0; i < 5; i += 1) {
        await http().delete('/account').set(a.headers).send({ confirm: 'no' }).expect(400);
      }
      await http().delete('/account').set(a.headers).send({ confirm: 'BORRAR' }).expect(429);
      expect(await dbCounts(a.id)).toEqual({ records: 3, state: 1, profile: 1 });
    });

    it('el limite de /account no depende de la IP: no afecta a otras rutas del mismo usuario', async () => {
      const a = await seedUser('ana');
      for (let i = 0; i < 6; i += 1) {
        await http().get('/account/export').set(a.headers);
      }
      await http().get('/sync/pull').set(a.headers).expect(200);
      await http().get('/profile').set(a.headers).expect(200);
    });
  });

  describe('rls-baseline.sql (sobre el schema privado dev_public)', () => {
    /** Divide el script en sentencias sin romper los bloques `$$ ... $$` y sin comentarios `--`. */
    function statements(sql: string): string[] {
      const code = sql
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join(' ');
      const out: string[] = [];
      let current = '';
      let inDollar = false;
      for (let i = 0; i < code.length; i += 1) {
        if (code.startsWith('$$', i)) {
          inDollar = !inDollar;
          current += '$$';
          i += 1;
          continue;
        }
        if (code[i] === ';' && !inDollar) {
          if (current.trim()) out.push(current.trim());
          current = '';
          continue;
        }
        current += code[i];
      }
      if (current.trim()) out.push(current.trim());
      return out;
    }

    const script = readFileSync(join(__dirname, '..', 'prisma', 'rls-baseline.sql'), 'utf8').replaceAll(
      "target_schema text := 'public'",
      "target_schema text := 'dev_public'",
    );

    async function applyBaseline() {
      for (const statement of statements(script)) {
        await prisma.$executeRawUnsafe(statement);
      }
    }

    beforeAll(async () => {
      // En Supabase existen de serie; en el Postgres embebido los creamos.
      await prisma.$executeRawUnsafe(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      END $$`);
    });

    it('activa y fuerza RLS en las tablas de la app (incluidas las de secretos de Google), y quita privilegios a anon/authenticated (idempotente)', async () => {
      await applyBaseline();
      await applyBaseline(); // se puede reejecutar sin error

      const rows = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean; forced: boolean }[]>`
        SELECT t.tablename, t.rowsecurity, c.relforcerowsecurity AS forced
        FROM pg_tables t JOIN pg_class c ON c.oid = format('%I.%I', t.schemaname, t.tablename)::regclass
        WHERE t.schemaname = 'dev_public' AND t.tablename <> '_prisma_migrations' ORDER BY t.tablename`;
      expect(rows.map((r) => r.tablename)).toEqual(APP_TABLES);
      expect(rows.every((r) => r.rowsecurity && r.forced)).toBe(true);

      for (const table of APP_TABLES) {
        for (const role of ['anon', 'authenticated']) {
          const [{ allowed }] = await prisma.$queryRawUnsafe<{ allowed: boolean }[]>(
            `SELECT has_table_privilege('${role}', 'dev_public.${table}', 'SELECT,INSERT,UPDATE,DELETE') AS allowed`,
          );
          expect(allowed).toBe(false);
        }
      }
    });
  });
});
