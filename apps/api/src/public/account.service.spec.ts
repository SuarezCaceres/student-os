import { HttpException } from '@nestjs/common';
import { at, kanbanRecord, newUserId, NOW, profileRecord, tombstone } from '../../test/helpers/sync-fixtures';
import { clearAccountDeletionHooksForTests, registerAccountDeletionHook } from '../common/account-deletion';
import { InMemoryProfileRepository } from '../profile/in-memory-profile.repository';
import { ProfileService } from '../profile/profile.service';
import { InMemorySyncRepository } from '../sync/in-memory-sync.repository';
import { SyncService } from '../sync/sync.service';
import { clearAccountExportContributorsForTests, registerAccountExportContributor } from './account-export.registry';
import { AccountService } from './account.service';
import { InMemoryAccountRepository } from './in-memory-account.repository';

describe('AccountService (repositorios en memoria)', () => {
  let syncRepo: InMemorySyncRepository;
  let accountRepo: InMemoryAccountRepository;
  let sync: SyncService;
  let service: AccountService;
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    clearAccountDeletionHooksForTests();
    clearAccountExportContributorsForTests();
    syncRepo = new InMemorySyncRepository();
    accountRepo = new InMemoryAccountRepository(syncRepo);
    sync = new SyncService(syncRepo, new ProfileService(new InMemoryProfileRepository()), () => NOW);
    service = new AccountService(accountRepo, sync);
    userA = newUserId();
    userB = newUserId();
    for (const user of [userA, userB]) {
      accountRepo.addProfile(user);
      await sync.push(user, {
        changes: [kanbanRecord('t1', at(-10), `tarea de ${user}`), kanbanRecord('t2', at(-9)), profileRecord(at(-8))],
      });
    }
  });

  afterAll(() => {
    clearAccountDeletionHooksForTests();
    clearAccountExportContributorsForTests();
  });

  describe('confirmacion', () => {
    it.each([undefined, null, {}, { confirm: 'borrar' }, { confirm: 'SI' }, { confirm: true }, 'BORRAR'])(
      'rechaza el cuerpo %j con 400 y no toca nada',
      async (body) => {
        const hook = jest.fn();
        registerAccountDeletionHook({ name: 'x', run: hook });
        await expect(service.deleteAccount(userA, body)).rejects.toMatchObject({ status: 400 });
        expect(hook).not.toHaveBeenCalled();
        expect(syncRepo.dump(userA)).toHaveLength(3);
        expect(accountRepo.hasProfile(userA)).toBe(true);
        expect(accountRepo.deleteCalls).toBe(0);
      },
    );
  });

  describe('borrado', () => {
    it('ejecuta los ganchos ANTES de borrar sync y perfil, solo con el userId del JWT', async () => {
      const seen: string[] = [];
      registerAccountDeletionHook({
        name: 'google',
        run: async (id) => {
          // En el momento del gancho todo sigue existiendo (si el gancho necesita datos, los tiene).
          seen.push(`${id}:${syncRepo.dump(id).length}:${accountRepo.hasProfile(id)}`);
        },
      });
      const report = await service.deleteAccount(userA, { confirm: 'BORRAR' });
      expect(seen).toEqual([`${userA}:3:true`]);
      expect(report).toEqual({
        deleted: true,
        modules: [{ name: 'google', ok: true }],
        syncRecordsDeleted: 3,
        profileDeleted: true,
        authUser: 'not_deleted',
      });
    });

    it('borra todo lo del usuario A y deja intacto lo del usuario B', async () => {
      await service.deleteAccount(userA, { confirm: 'BORRAR' });
      expect(syncRepo.dump(userA)).toEqual([]);
      expect(accountRepo.hasProfile(userA)).toBe(false);
      expect(syncRepo.dump(userB)).toHaveLength(3);
      expect(accountRepo.hasProfile(userB)).toBe(true);
    });

    it('es idempotente: repetirlo no falla y no inventa borrados', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      registerAccountDeletionHook({ name: 'google', run: hook });
      await service.deleteAccount(userA, { confirm: 'BORRAR' });
      const second = await service.deleteAccount(userA, { confirm: 'BORRAR' });
      expect(second).toMatchObject({ deleted: true, syncRecordsDeleted: 0, profileDeleted: false });
      expect(hook).toHaveBeenCalledTimes(2);
      expect(syncRepo.dump(userB)).toHaveLength(3);
    });

    it('si un gancho falla: 424 con el detalle por modulo, NO se borra nada mas y se puede reintentar', async () => {
      let googleFails = true;
      const okHook = jest.fn().mockResolvedValue(undefined);
      registerAccountDeletionHook({ name: 'calendar', run: okHook });
      registerAccountDeletionHook({
        name: 'google',
        run: async () => {
          if (googleFails) throw new Error('refresh-token-secreto-1//abc rechazado por usuario ana@example.com');
        },
      });

      const error = await service.deleteAccount(userA, { confirm: 'BORRAR' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(424);
      const message = (httpError.getResponse() as { message: string[] }).message;
      expect(message).toEqual(
        expect.arrayContaining([expect.stringContaining('calendar: ok'), expect.stringContaining('google: fallo (Error)')]),
      );
      // Sin datos sensibles: ni el mensaje original de la excepcion, ni tokens, ni correos.
      expect(JSON.stringify(httpError.getResponse())).not.toMatch(/secreto|ana@example|1\/\//);
      // Nada se borro.
      expect(syncRepo.dump(userA)).toHaveLength(3);
      expect(accountRepo.hasProfile(userA)).toBe(true);
      expect(accountRepo.deleteCalls).toBe(0);

      // Reintento tras arreglar el modulo: converge.
      googleFails = false;
      const report = await service.deleteAccount(userA, { confirm: 'BORRAR' });
      expect(report.modules).toEqual([
        { name: 'calendar', ok: true },
        { name: 'google', ok: true },
      ]);
      expect(syncRepo.dump(userA)).toEqual([]);
      expect(accountRepo.hasProfile(userA)).toBe(false);
      expect(okHook).toHaveBeenCalledTimes(2); // idempotente: se ejecuto en ambos intentos
    });

    it('un fallo despues de los ganchos (sync) se propaga y el reintento termina el trabajo', async () => {
      const original = sync.deleteAllForUser.bind(sync);
      const spy = jest.spyOn(sync, 'deleteAllForUser').mockRejectedValueOnce(new Error('db caida'));
      await expect(service.deleteAccount(userA, { confirm: 'BORRAR' })).rejects.toThrow('db caida');
      expect(accountRepo.hasProfile(userA)).toBe(true);
      spy.mockImplementation(original);
      await expect(service.deleteAccount(userA, { confirm: 'BORRAR' })).resolves.toMatchObject({ syncRecordsDeleted: 3 });
      expect(accountRepo.hasProfile(userA)).toBe(false);
    });
  });

  describe('exportacion', () => {
    it('devuelve solo los registros vivos del propio usuario', async () => {
      await sync.push(userA, { changes: [tombstone('t2', at(-1))] });
      const data = await service.exportData(userA, 'ana@example.com');
      expect(data.account).toMatchObject({ id: userA, email: 'ana@example.com' });
      expect(data.records.map((r) => r.id).sort()).toEqual(['profile', 't1']);
      expect(data.counts).toEqual({ total: 2, byCollection: { kanban: 1, profile: 1 } });
      expect(JSON.stringify(data)).not.toContain(userB);
      expect(data.records.every((r) => 'data' in r && r.data !== null)).toBe(true);
    });

    it('usuario sin datos: exportacion vacia, no error', async () => {
      const data = await service.exportData(newUserId(), undefined);
      expect(data.records).toEqual([]);
      expect(data.account).toMatchObject({ email: null, createdAt: null, lastSyncAt: null });
    });

    it('incluye extras de otros modulos y no falla si uno de ellos falla', async () => {
      registerAccountExportContributor({ name: 'google', collect: async (id) => ({ connected: true, for: id }) });
      registerAccountExportContributor({
        name: 'roto',
        collect: async () => {
          throw new Error('detalle interno con ana@example.com');
        },
      });
      const data = await service.exportData(userA, undefined);
      expect(data.extras).toEqual({ google: { connected: true, for: userA }, roto: { unavailable: true } });
      expect(JSON.stringify(data)).not.toContain('ana@example.com');
    });
  });
});
