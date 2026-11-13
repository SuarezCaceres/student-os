import type { ConfigService } from '@nestjs/config';
import { GoogleApiClient } from '../../src/google/google-api.client';
import { GoogleConfig } from '../../src/google/google.config';
import { GoogleService } from '../../src/google/google.service';
import { InMemoryGoogleRepository } from '../../src/google/in-memory-google.repository';
import { FAKE_CLIENT_ID, FAKE_CLIENT_SECRET, startFakeGoogle, type FakeGoogle } from './google-fake';

/** Valores FALSOS, solo para pruebas. */
export const TEST_ENC_KEY = 'test-only-encryption-key-0123456789-abcdefghijklmnop';
export const TEST_REDIRECT_URI = 'http://localhost:3000/google/callback';
export const WEB_ORIGIN = 'https://student-os.example.com';
export const OTHER_WEB_ORIGIN = 'http://localhost:5173';

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';

export function configValues(fake: FakeGoogle | null, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'test',
    GOOGLE_CLIENT_ID: FAKE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENC_KEY: TEST_ENC_KEY,
    GOOGLE_REDIRECT_URI: TEST_REDIRECT_URI,
    WEB_ORIGINS: [WEB_ORIGIN, OTHER_WEB_ORIGIN],
    ...(fake
      ? { GOOGLE_OAUTH_BASE: fake.url, GOOGLE_API_BASE: fake.url, GOOGLE_AUTH_URL: fake.authUrl }
      : {}),
    ...overrides,
  };
}

export function makeConfig(values: Record<string, unknown>): GoogleConfig {
  return new GoogleConfig({ get: (key: string) => values[key] } as unknown as ConfigService);
}

export interface GoogleHarness {
  fake: FakeGoogle;
  repo: InMemoryGoogleRepository;
  service: GoogleService;
  config: GoogleConfig;
  clock: { now: number };
  close: () => Promise<void>;
}

/** Servicio real + repositorio en memoria + servidor falso de Google + reloj controlable. */
export async function createGoogleHarness(overrides: Record<string, unknown> = {}): Promise<GoogleHarness> {
  const fake = await startFakeGoogle();
  const config = makeConfig(configValues(fake, overrides));
  const repo = new InMemoryGoogleRepository();
  const clock = { now: Date.UTC(2026, 10, 13, 12, 0, 0) };
  const service = new GoogleService(config, new GoogleApiClient(config), repo, () => clock.now);
  return { fake, repo, service, config, clock, close: () => fake.close() };
}

/** Recorre el flujo completo (connect -> consentimiento -> callback) y devuelve la URL final de redireccion. */
export async function connectUser(
  harness: GoogleHarness,
  userId: string,
  options: { email?: string; returnTo?: string; grantedScopes?: string[]; includeRefreshToken?: boolean } = {},
): Promise<string> {
  const { url } = await harness.service.startConnect(userId, options.returnTo);
  const { callbackUrl } = harness.fake.consent(url, options);
  const callback = new URL(callbackUrl);
  return harness.service.handleCallback({
    code: callback.searchParams.get('code') ?? undefined,
    state: callback.searchParams.get('state') ?? undefined,
  });
}
