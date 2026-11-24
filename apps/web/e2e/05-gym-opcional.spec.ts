import { expect, test, type Page } from '@playwright/test';
import {
  PageTap,
  WEB,
  apiFetch,
  bootDevice,
  control,
  gotoApp,
  newContext,
  openTab,
  pullByFocusUntil,
  relevantConsoleErrors,
  sessionFor,
  syncRecordsOf,
  userKey,
  waitSynced,
  type Device,
  type TestSession,
} from './support/harness';

/**
 * Escenario 5 - Gym opcional (spec 011). «No voy al gimnasio» oculta todo el modulo, se guarda por usuario
 * y viaja a otros dispositivos; «Reactivar» lo devuelve y los datos de gym no se pierden.
 */
test.describe.configure({ mode: 'serial' });

const GYM_BLOCK = 'Entrenamiento Push E2E'; // bloque de gym local que crea la prueba

const preference = async (userId: string) => {
  const rows = await syncRecordsOf(userId, 'gym');
  const row = rows.find((r) => r.id === 'gym-preference' && r.deletedAt === null);
  return (row?.data as { value?: { disabled?: boolean } } | undefined)?.value?.disabled;
};

/** Crea un bloque de gym en el horario desde la interfaz (los bloques de gym son locales: no viajan por el sync). */
async function addGymBlock(page: Page, title: string): Promise<void> {
  await openTab(page, 'Horario');
  await page.getByRole('button', { name: 'Agendar bloque' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Actividad o clase').fill(title);
  await dialog.locator('select').nth(1).selectOption('gym');
  await dialog.getByRole('button', { name: 'Guardar bloque' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(title).first()).toBeVisible();
}

const gymTab = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' }).getByText('Gym', { exact: true });

test.describe('5. gym opcional', () => {
  let session: TestSession;
  let a: Device;

  test.beforeAll(async ({ browser }) => {
    session = await sessionFor(userKey('s5'));
    a = await bootDevice(browser, session, { kind: 'desktop' });
  });

  test.afterAll(async () => {
    await a?.context.close();
  });

  test('5a. con el gym activo hay pestana, bloques de gym y la opcion «No voy al gimnasio» (C1, C2)', async () => {
    await expect(gymTab(a.page)).toBeVisible();
    await addGymBlock(a.page, GYM_BLOCK);

    await openTab(a.page, 'Gym');
    // Sin perfil de gym (cuenta nueva) la opcion esta en la propia pestana.
    await expect(a.page.getByRole('button', { name: 'No voy al gimnasio' })).toBeVisible();
    // Y tambien dentro del asistente, sin rellenar ningun campo.
    await a.page.getByRole('button', { name: /Configurar gym|Mi perfil gym/ }).click();
    await expect(a.page.getByRole('dialog').getByRole('button', { name: 'No voy al gimnasio' })).toBeVisible();
    await a.page.keyboard.press('Escape');
  });

  test('5b. «No voy al gimnasio» oculta el modulo y lleva al resumen (C3, C4, C5)', async () => {
    await openTab(a.page, 'Gym');
    await a.page.getByRole('button', { name: 'No voy al gimnasio' }).first().click();

    await expect(gymTab(a.page)).toHaveCount(0);
    await expect(a.page.getByTestId('gym-disabled-notice')).toBeVisible(); // estamos en el resumen
    await expect(a.page.getByText('Agregar ejercicio')).toHaveCount(0);

    await openTab(a.page, 'Horario');
    await expect(a.page.getByText(GYM_BLOCK)).toHaveCount(0);
  });

  test('5c. la eleccion se guarda en el servidor y sobrevive a recargar (C8)', async () => {
    await expect.poll(() => preference(session.userId), { timeout: 20_000 }).toBe(true);
    await a.page.reload();
    await a.page.getByRole('navigation', { name: 'Navegación principal' }).waitFor({ state: 'visible', timeout: 30_000 });
    await expect(gymTab(a.page)).toHaveCount(0);
  });

  test('5d. otro dispositivo de la misma cuenta lo recibe, y reactivar vuelve a llegar al primero (C6, C7, C8)', async ({ browser }) => {
    const b = await bootDevice(browser, session, { kind: 'desktop' });
    try {
      await expect(gymTab(b.page)).toHaveCount(0);
      await expect(b.page.getByTestId('gym-disabled-notice')).toBeVisible();

      await b.page.getByRole('button', { name: 'Reactivar' }).click();
      await expect(gymTab(b.page)).toBeVisible();
      await expect.poll(() => preference(session.userId), { timeout: 20_000 }).toBe(false);
      expect(relevantConsoleErrors(b.tap)).toEqual([]);

      // El primer dispositivo recibe la reactivacion y su bloque de gym (local) vuelve a aparecer: no se perdio nada.
      await pullByFocusUntil(a.page, async () => (await gymTab(a.page).count()) > 0);
      await expect(gymTab(a.page)).toBeVisible();
      await openTab(a.page, 'Horario');
      await expect(a.page.getByText(GYM_BLOCK).first()).toBeVisible();
    } finally {
      await b.context.close();
    }
  });

  test('5e. otro usuario no ve el gym desactivado de este (C9)', async ({ browser }) => {
    // Este usuario lo desactiva de nuevo; uno distinto sigue con su gym activo.
    await openTab(a.page, 'Gym');
    await a.page.getByRole('button', { name: 'No voy al gimnasio' }).first().click();
    await expect.poll(() => preference(session.userId), { timeout: 20_000 }).toBe(true);

    const other = await sessionFor(userKey('s5-otro'));
    const ctx = await newContext(browser, { session: other });
    const page = await ctx.newPage();
    const tap = new PageTap(page);
    await gotoApp(page);
    await page.getByRole('navigation', { name: 'Navegación principal' }).waitFor({ state: 'visible', timeout: 30_000 });
    await waitSynced(page, 40_000);
    await expect(gymTab(page)).toBeVisible();
    await expect(page.getByTestId('gym-disabled-notice')).toHaveCount(0);
    expect(await preference(other.userId)).toBeUndefined();
    expect(tap.pageErrors).toEqual([]);
    await ctx.close();
  });

  test('5f. con Calendar vinculado y el gym desactivado, la app no publica nada de gym en Google (C5)', async ({ browser }) => {
    const key = userKey('s5-google');
    const email = `${key}@e2e.test`;
    await control('/supabase/config', { loginUserKey: key });
    const s = await sessionFor(key);
    const at = new Date().toISOString();
    // La cuenta ya tiene el gym desactivado.
    const seeded = await apiFetch('/sync/push', s.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          { id: 'gym-preference', collection: 'gym', data: { kind: 'preference', value: { disabled: true } }, updatedAt: at, deletedAt: null, rev: 0 },
        ],
      }),
    });
    expect(seeded.status, seeded.text).toBeLessThan(300);

    const before = (await control<{ paths: string[] }>('/google/state?email=' + encodeURIComponent(email))).paths.length;

    // Login real con Google (Calendar queda vinculado solo) y recorrido por todas las pestanas.
    const context = await newContext(browser);
    const page = await context.newPage();
    const tap = new PageTap(page);
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Continuar con Google/i }).click();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => (await apiFetch('/google/status', s.accessToken)).json, { timeout: 15_000 })
      .toMatchObject({ connected: true });
    await waitSynced(page, 40_000);
    await expect(gymTab(page)).toHaveCount(0);
    for (const tab of ['Kanban', 'Universidad', 'Horario', 'Aprendizaje', 'Resumen'] as const) await openTab(page, tab);
    await openTab(page, 'Horario');
    await page.waitForTimeout(3_000);

    // Calendar esta realmente vinculado (la API hablo con Google al enlazar) y, aun asi, la app no escribe en el calendario.
    // Nota: en esta base la web aun no lee el calendario de Google durante la prueba; tras rebasar sobre la 009 (E2E de
    // calendario) conviene exigir tambien una lectura `GET /calendar/v3/` para que la prueba sea mas estricta.
    const after = (await control<{ paths: string[] }>('/google/state?email=' + encodeURIComponent(email))).paths.slice(before);
    expect(after.some((p) => p.startsWith('POST /token')), 'Calendar quedo vinculado: ' + JSON.stringify(after)).toBe(true);
    expect(after.filter((p) => p.startsWith('POST /calendar/v3/') || p.startsWith('PATCH /calendar/v3/'))).toEqual([]);
    const events = await control<Array<{ summary?: string }>>('/google/events?email=' + encodeURIComponent(email));
    expect(events.filter((e) => /gym|entrenamiento/i.test(e.summary ?? ''))).toEqual([]);
    expect(tap.pageErrors).toEqual([]);
    await context.close();
  });
});
