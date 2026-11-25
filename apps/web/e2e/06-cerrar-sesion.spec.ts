import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  PageTap,
  evidence,
  gotoApp,
  newContext,
  openTab,
  relevantConsoleErrors,
  rowsOf,
  serverHas,
  sessionFor,
  syncRecordsOf,
  userKey,
  waitSynced,
  type TestSession,
} from './support/harness';

/**
 * Escenario 6 - Cerrar sesion sin perder trabajo y cuentas nuevas en varios dispositivos (spec 010, C2, C6, C7 y C8).
 */
test.describe.configure({ mode: 'serial' });

async function openDevice(browser: Browser, session: TestSession): Promise<{ context: BrowserContext; page: Page; tap: PageTap }> {
  const context = await newContext(browser, { session });
  const page = await context.newPage();
  const tap = new PageTap(page);
  await gotoApp(page);
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
  await waitSynced(page, 40_000);
  return { context, page, tap };
}

async function addTask(page: Page, title: string): Promise<void> {
  await openTab(page, 'Kanban');
  const input = page.getByLabel('Agregar tarea en Por hacer');
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

const logoutButton = (page: Page) => page.getByRole('button', { name: 'Cerrar sesión' }).first();
const landingButton = (page: Page) => page.getByRole('button', { name: /Continuar con Google/i }).first();

test.describe('6. cerrar sesion y cuentas nuevas', () => {
  test('6a. C2/C7: lo ultimo que se escribio se sube antes de salir y se ve al volver a entrar, en otro dispositivo', async ({ browser }) => {
    const session = await sessionFor(userKey('s6a'));
    const { context, page, tap } = await openDevice(browser, session);
    const task = `Tarea al salir ${Date.now()}`;

    // Se escribe y se sale al instante: el cambio aun esta esperando al debounce del motor.
    await addTask(page, task);
    await logoutButton(page).click();
    await expect(landingButton(page)).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => serverHas(session.userId, 'kanban', task), { timeout: 15_000 }).toBe(true);

    // Otro dispositivo (contexto nuevo) entra con la misma cuenta y ve esa ultima edicion.
    const other = await openDevice(browser, session);
    await openTab(other.page, 'Kanban');
    await expect(other.page.getByRole('heading', { name: task })).toBeVisible({ timeout: 20_000 });
    await evidence(other.page, '06-tarea-guardada-al-salir');

    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await other.context.close();
    await context.close();
  });

  test('6b. C8: sin conexion y con cambios pendientes avisa; cancelar mantiene la sesion y cerrar igualmente sale', async ({ browser }) => {
    const session = await sessionFor(userKey('s6b'));
    const { context, page } = await openDevice(browser, session);
    const task = `Tarea sin red ${Date.now()}`;

    await context.setOffline(true);
    await addTask(page, task);
    await logoutButton(page).click();

    const dialog = page.getByRole('dialog', { name: /Hay cambios sin guardar en tu cuenta/ });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText(/1 cambio/);
    await evidence(page, '06-aviso-cambios-sin-guardar');

    // Cancelar: sigue dentro, con su tarea, y la sesion sigue abierta.
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: task })).toBeVisible();

    // Cerrar igualmente: sale y lo que no se pudo subir no esta en el servidor.
    await logoutButton(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión de todos modos' }).click();
    await expect(landingButton(page)).toBeVisible({ timeout: 30_000 });
    expect(await serverHas(session.userId, 'kanban', task)).toBe(false);
    await context.close();
  });

  test('6c. con conexion y sin cambios pendientes sale directo, sin aviso', async ({ browser }) => {
    const session = await sessionFor(userKey('s6c'));
    const { context, page } = await openDevice(browser, session);
    await logoutButton(page).click();
    await expect(landingButton(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog', { name: /Hay cambios sin guardar/ })).toHaveCount(0);
    await context.close();
  });

  test('6d. C6: dos dispositivos de una cuenta nueva que entran a la vez terminan iguales y sin duplicados', async ({ browser }) => {
    const session = await sessionFor(userKey('s6d'));
    const [a, b] = await Promise.all([openDevice(browser, session), openDevice(browser, session)]);
    await Promise.all([waitSynced(a.page, 40_000), waitSynced(b.page, 40_000)]);

    const snapshot = (p: Page) =>
      p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('student_os_state_v1') ?? '{}') as Record<string, unknown>;
        return {
          studentName: s.studentName,
          kanbanItems: s.kanbanItems,
          universityAssignments: s.universityAssignments,
          gymRoutines: s.gymRoutines,
          calendarBlocks: s.calendarBlocks,
          weeklyReflections: s.weeklyReflections,
        };
      });
    const [sa, sb] = [await snapshot(a.page), await snapshot(b.page)];
    expect(sa).toEqual(sb);
    expect(sa.kanbanItems).toEqual([]);
    expect(sa.universityAssignments).toEqual([]);

    // En el servidor solo existe el perfil de la cuenta, una sola vez.
    const records = (await syncRecordsOf(session.userId)).filter((r) => r.deletedAt === null);
    expect(records.map((r) => r.collection)).toEqual(['profile']);
    expect((await rowsOf(session.userId)).profiles).toBe(1);
    expect(a.tap.statuses().filter((s) => s >= 400 && s !== 409)).toEqual([]);
    expect(b.tap.statuses().filter((s) => s >= 400 && s !== 409)).toEqual([]);
    expect(a.tap.pageErrors.concat(b.tap.pageErrors)).toEqual([]);

    await a.context.close();
    await b.context.close();
  });
});
