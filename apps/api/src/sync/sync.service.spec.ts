import { defineSyncScenarios } from '../../test/helpers/sync-scenarios';
import { InMemoryProfileRepository } from '../profile/in-memory-profile.repository';
import { ProfileService } from '../profile/profile.service';
import { InMemorySyncRepository } from './in-memory-sync.repository';
import { SyncService } from './sync.service';

// Mismos escenarios que se ejecutan contra Postgres real en test/sync-prisma.e2e-spec.ts.
defineSyncScenarios('repositorio en memoria', async () => {
  const repository = new InMemorySyncRepository();
  const profiles = new InMemoryProfileRepository((id) => repository.getLastSyncAt(id));
  const clock = { now: new Date() };
  const service = new SyncService(repository, new ProfileService(profiles), () => clock.now);
  return { service, clock };
});
