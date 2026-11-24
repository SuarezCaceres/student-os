import { expect, test, type Page } from '@playwright/test';
import {
  PageTap,
  apiFetch,
  bootDevice,
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

const GYM_BLOCK = 'Entrenamiento Push (Pecho/Hombro)'; // bloque de gym del estado de partida

const preference = async (userId: string) => {
  const rows = await syncRecordsOf(userId, 'gym');
  const row = rows.find((r) => r.id === 'gym-preference' && r.deletedAt === null);
  return (row?.data as { value?: { disabled?: boolean } } | undefined)?.value?.disabled;
};

const gymTab = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' }).getByText('Gym', { exact: true });

test.describe('5. gym opcional', () => {
  let session: TestSession;
  let a: Device;

  test.beforeAll(async ({ browser }) => {
    session = await sessionFor(userKey('s5'));
    // Una cuenta nueva no trae bloques de calendario: se siembra uno de gym por el API para poder ver que se oculta.
    const now = new Date().toISOString();
    const seeded = await apiFetch('/sync/push', session.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          {
            id: 'cb-gym-e2e',
            collection: 'calendar',
            data: {
              kind: 'block',
              value: { id: 'cb-gym-e2e', day: 'Lunes', startTime: '07:00', endTime: '08:30', title: GYM_BLOCK, category: 'gym' },
            },
            updatedAt: now,
            deletedAt: null,
            rev: 0,
          },
        ],
      }),
    });
    expect(seeded.status, seeded.text).toBeLessThan(300);
    a = await bootDevice(browser, session, { kind: 'desktop' });
  });

  test.afterAll(async () => {
    await a?.context.close();
  });

  test('5a. con el gym activo hay pestana, bloques de gym y la opcion «No voy al gimnasio» (C1, C2)', async () => {
    await expect(gymTab(a.page)).toBeVisible();
    await openTab(a.page, 'Horario');
    await expect(a.page.getByText(GYM_BLOCK).first()).toBeVisible();

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
      // Los datos de gym siguen ahi: el bloque del horario vuelve a aparecer.
      await openTab(b.page, 'Horario');
      await expect(b.page.getByText(GYM_BLOCK).first()).toBeVisible();
      expect(relevantConsoleErrors(b.tap)).toEqual([]);

      await pullByFocusUntil(a.page, async () => (await gymTab(a.page).count()) > 0);
      await expect(gymTab(a.page)).toBeVisible();
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
});
