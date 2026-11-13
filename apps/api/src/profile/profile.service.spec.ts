import { newUserId, kanbanRecord, at } from '../../test/helpers/sync-fixtures';
import { InMemorySyncRepository } from '../sync/in-memory-sync.repository';
import { SyncService } from '../sync/sync.service';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let syncRepo: InMemorySyncRepository;
  let profileRepo: InMemoryProfileRepository;
  let profiles: ProfileService;
  let sync: SyncService;

  beforeEach(() => {
    syncRepo = new InMemorySyncRepository();
    profileRepo = new InMemoryProfileRepository((id) => syncRepo.getLastSyncAt(id));
    profiles = new ProfileService(profileRepo);
    sync = new SyncService(syncRepo, profiles, () => new Date());
  });

  it('ensure crea el perfil una sola vez (idempotente)', async () => {
    const id = newUserId();
    const first = await profiles.ensure(id);
    const second = await profiles.ensure(id);
    expect(second.createdAt).toEqual(first.createdAt);
    expect(profileRepo.creations).toBe(1);
  });

  it('get devuelve { id, email, createdAt, lastSyncAt } y lastSyncAt es null si nunca sincronizo', async () => {
    const id = newUserId();
    expect(await profiles.get(id, 'ana@example.com')).toEqual({
      id,
      email: 'ana@example.com',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      lastSyncAt: null,
    });
  });

  it('email ausente en el JWT -> null', async () => {
    expect((await profiles.get(newUserId(), undefined)).email).toBeNull();
  });

  it('la primera peticion de sync (push o pull) crea el perfil y get refleja lastSyncAt', async () => {
    const viaPull = newUserId();
    const viaPush = newUserId();
    expect(profileRepo.has(viaPull)).toBe(false);
    await sync.pull(viaPull, {});
    await sync.push(viaPush, { changes: [kanbanRecord('t1', at(-1))] });
    expect(profileRepo.has(viaPull)).toBe(true);
    expect(profileRepo.has(viaPush)).toBe(true);
    expect((await profiles.get(viaPush, undefined)).lastSyncAt).toEqual(expect.stringMatching(/^\d{4}-/));
  });

  it('cada usuario tiene su propio perfil', async () => {
    const a = newUserId();
    const b = newUserId();
    await sync.push(a, { changes: [kanbanRecord('t1', at(-1))] });
    expect((await profiles.get(b, undefined)).lastSyncAt).toBeNull();
  });
});
