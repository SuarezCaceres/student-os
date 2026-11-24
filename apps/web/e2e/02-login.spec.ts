import { expect, test } from '@playwright/test';
import {
  API,
  PageTap,
  WEB,
  apiFetch,
  control,
  evidence,
  gotoApp,
  newContext,
  relevantConsoleErrors,
  rowsOf,
  sessionFor,
  syncBadgeText,
  userKey,
} from './support/harness';

/**
 * Escenario 2 - Login con sesion en la nube (Supabase falso con JWKS ES256 real para la API real).
 */
test.describe('2. login con sesion en la nube', () => {
  test('2a. sesion inyectada en localStorage: entra al modo app, aparece el indicador de sync y el servidor crea el perfil', async ({ browser }) => {
    const s = await sessionFor(userKey('s2a'));
    const before = await rowsOf(s.userId);
    expect(before.profiles, 'el usuario aun no debe tener perfil').toBe(0);

    const context = await newContext(browser, { session: s });
    const page = await context.newPage();
    const tap = new PageTap(page);
    await gotoApp(page);

    // Modo app (no landing): navbar principal y badge de sync.
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect.poll(() => syncBadgeText(page), { timeout: 20_000 }).toMatch(/Falta elegir tus datos|Sincroniz/);
    await expect(page.getByText('¿Subimos tus datos a la nube?')).toBeVisible();
    await evidence(page, '02-login-app-con-sesion');

    // La app hizo su primer pull autenticado y la API respondio 200 con el JWT del Supabase falso.
    await expect.poll(() => tap.pulls().length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => tap.pulls()[0]?.status ?? null, { timeout: 15_000 }).toBe(200);
    expect(tap.statuses().filter((st) => st === 401)).toEqual([]);

    // El pull crea el perfil en el servidor (SyncService -> ProfileService.ensure).
    await expect.poll(async () => (await rowsOf(s.userId)).profiles, { timeout: 10_000 }).toBe(1);

    // GET /profile (llamada directa con el mismo token): 200 y devuelve el mismo usuario; sigue habiendo UN solo perfil.
    const profile = await apiFetch('/profile', s.accessToken);
    expect(profile.status).toBe(200);
    expect(profile.json).toMatchObject({ id: s.userId, email: s.email });
    expect((await rowsOf(s.userId)).profiles).toBe(1);

    // Sin token o con basura: 401.
    expect((await apiFetch('/profile', null)).status).toBe(401);
    expect((await apiFetch('/profile', 'no.es.un.jwt')).status).toBe(401);

    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });

  test('2b. flujo real de "Continuar con Google" (Supabase falso, PKCE): landing -> redirect -> vuelve con codigo -> sesion', async ({ browser }) => {
    const key = userKey('s2b');
    await control('/supabase/config', { loginUserKey: key });
    const s = await sessionFor(key);

    const context = await newContext(browser);
    const page = await context.newPage();
    const tap = new PageTap(page);
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
    // El modal ofrece un unico "Continuar con Google" (Supabase): un solo consentimiento con Calendar incluido.
    const loginButton = page.getByRole('dialog').getByRole('button', { name: /Continuar con Google/i });
    await expect(loginButton).toBeVisible();
    await evidence(page, '02-login-modal-nube');
    const authorizeRequest = page.waitForRequest((r) => r.url().includes('/auth/v1/authorize'));
    await loginButton.click();
    const req = await authorizeRequest;
    expect(new URL(req.url()).searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256');

    // C4: el MISMO consentimiento del login pide los permisos de Calendar y el refresh token (offline + consent).
    const asked = new URL(req.url()).searchParams;
    expect((asked.get('scopes') ?? '').split(/[\s,+]+/)).toEqual(
      expect.arrayContaining([
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ]),
    );
    expect(asked.get('access_type')).toBe('offline');
    expect(asked.get('prompt') ?? '').toContain('consent');

    // Tras el redirect de vuelta y el canje PKCE, la app entra sola.
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });

    // C5: Calendar queda vinculado SIN pulsar ningun boton: el servidor guardo el refresh token cifrado.
    await expect
      .poll(async () => (await apiFetch('/google/status', s.accessToken)).json, { timeout: 15_000 })
      .toMatchObject({ connected: true, needsReauth: false, email: `${key}@e2e.test` });
    expect(
      (await apiFetch('/google/status', s.accessToken)).text,
      'el estado de Calendar nunca incluye tokens',
    ).not.toMatch(/fake-rt-|refresh_token/i);

    // C10: ningun almacenamiento persistente del navegador contiene el refresh token de Google.
    const leaked = await page.evaluate(() => {
      const dump = (st: Storage) => Object.keys(st).map((k) => `${k}=${st.getItem(k)}`).join('\n');
      return `${dump(localStorage)}\n${dump(sessionStorage)}`;
    });
    expect(leaked).not.toMatch(/fake-rt-/);
    expect(leaked).not.toContain('provider_refresh_token');
    await expect.poll(() => tap.pulls().length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect.poll(() => tap.pulls()[0]?.status ?? null, { timeout: 15_000 }).toBe(200);
    const stored = await page.evaluate((k) => localStorage.getItem(k), s.storageKey);
    expect(stored, 'supabase-js guardo la sesion').toContain(s.userId);
    expect(page.url(), 'el ?code= se limpia de la URL').not.toContain('code=');
    await expect.poll(async () => (await rowsOf(s.userId)).profiles, { timeout: 10_000 }).toBe(1);
    await evidence(page, '02-login-google-pkce-ok');
    expect(tap.pageErrors).toEqual([]);
    await context.close();
  });

  test('2e. C9: si el usuario desmarca el permiso de Calendar en Google, no entra: mensaje claro, sin sesion y sin datos', async ({ browser }) => {
    const key = userKey('s2e');
    await control('/supabase/config', {
      loginUserKey: key,
      grantedScopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
    });
    try {
      const s = await sessionFor(key);
      const context = await newContext(browser);
      const page = await context.newPage();
      await page.goto(WEB, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /Continuar con Google/i }).click();

      // Vuelve de Google sin el permiso: el servidor lo rechaza y la app muestra el aviso en la landing.
      const notice = page.getByRole('alert').filter({ hasText: 'necesita acceso a tu Google Calendar' });
      await expect(notice).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('tablist', { name: 'Vistas principales' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Continuar con Google' }).first()).toBeVisible();
      await evidence(page, '02-login-sin-permiso-calendar');

      // No se guardo ninguna sesion ni datos suyos, y no hay conexion de Calendar.
      const stored = await page.evaluate((k) => localStorage.getItem(k), s.storageKey);
      expect(stored === null || !stored.includes('access_token')).toBe(true);
      expect((await rowsOf(s.userId)).profiles).toBe(0);
      expect((await apiFetch('/google/status', s.accessToken)).json).toMatchObject({ connected: false });
      await context.close();
    } finally {
      await control('/supabase/config', { grantedScopes: null });
    }
  });

  test('2c. cerrar sesion: supabase-js borra su sesion Y la app vuelve a la landing (BUG-01 corregido)', async ({ browser }) => {
    // BUG-01: `handleLogout` no esperaba a `signOut()` y App.tsx re-adoptaba la sesion de Supabase en vuelo, dejando al
    // usuario DENTRO de la app. Ahora el cierre espera a que termine (C11).
    const s = await sessionFor(userKey('s2c'));
    const context = await newContext(browser, { session: s });
    const page = await context.newPage();
    await gotoApp(page);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 30_000 });
    // El importador (nube vacia + datos locales) bloquea la pantalla: "Ahora no" deja la sync en pausa.
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), s.storageKey), { timeout: 10_000 }).toBeNull();
    await expect(page.getByRole('button', { name: /Continuar con Google/i }).first()).toBeVisible({ timeout: 8_000 });
    expect(API).toContain('3100');
    await context.close();
  });

  test('2d. cerrar sesion: la sesion de supabase-js se borra del navegador y una recarga no reabre la nube', async ({ browser }) => {
    const s = await sessionFor(userKey('s2d'));
    const context = await newContext(browser, { session: s });
    const page = await context.newPage();
    const tap = new PageTap(page);
    await gotoApp(page);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), s.storageKey), { timeout: 10_000 }).toBeNull();
    // Sin sesion de nube no queda indicador de sync ni nuevas llamadas autenticadas tras recargar.
    const callsBefore = tap.calls.length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    await expect(page.getByRole('status').filter({ hasText: /Sincroniz|Conectando|Pendiente/ })).toHaveCount(0);
    expect(tap.calls.length, 'tras cerrar sesion y recargar no debe haber llamadas a la API').toBe(callsBefore);
    await context.close();
  });
});
