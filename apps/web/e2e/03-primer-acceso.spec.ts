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
 * Escenario 3 - Primer acceso sin importador (spec 009, C11 y C14).
 * Ya no hay dialogo para elegir que hacer con los datos locales: lo que habia en el navegador de otra cuenta o del
 * prototipo NUNCA se sube ni se muestra; se descarta y se trae lo de la nube.
 */
test.describe.configure({ mode: 'serial' });

async function openDevice(browser: Browser, session: TestSession): Promise<{ context: BrowserContext; page: Page; tap: PageTap }> {
  const context = await newContext(browser, { session });
  const page = await context.newPage();
  const tap = new PageTap(page);
  await gotoApp(page);
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
  return { context, page, tap };
}

test.describe('3. primer acceso sin importador', () => {
  test('3a. un usuario nuevo entra directo: sin dialogo de importador, sin descargas de respaldo y con su perfil creado', async ({ browser }) => {
    const session = await sessionFor(userKey('s3a'));
    const { context, page, tap } = await openDevice(browser, session);
    const downloads: string[] = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));

    await waitSynced(page, 40_000);
    // Ninguna pantalla que pida elegir que hacer con los datos.
    for (const gone of [/¿Subimos tus datos a la nube\?/, /Usar la nube/, /Conservar lo de este dispositivo/, /Elegir qué hacer con mis datos/, /Falta elegir tus datos/]) {
      await expect(page.getByText(gone), `no debe existir ${gone}`).toHaveCount(0);
    }
    expect(downloads, 'ya no se descargan respaldos del importador').toEqual([]);
    await expect.poll(async () => (await rowsOf(session.userId)).profiles, { timeout: 10_000 }).toBe(1);
    // Estado de una cuenta nueva: nombre de pila de su cuenta de Google y sin los bloques de horario de ejemplo.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('student_os_state_v1') ?? '{}') as { studentName?: string; calendarBlocks?: Array<{ id: string }> });
    expect(stored.studentName).toBe('Usuario');
    expect((stored.calendarBlocks ?? []).some((b) => /^cb-\d+$/.test(b.id))).toBe(false);
    await evidence(page, '03-primer-acceso-directo');
    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });

  test('3b. C11/C14: los datos de A en el navegador nunca se muestran ni se suben a la cuenta de B', async ({ browser }) => {
    const sessionA = await sessionFor(userKey('s3b-a'));
    const sessionB = await sessionFor(userKey('s3b-b'));
    const secret = `Tarea secreta de A ${Date.now()}`;

    // A trabaja y guarda algo propio en la nube.
    const { context, page, tap } = await openDevice(browser, sessionA);
    await waitSynced(page, 40_000);
    await openTab(page, 'Kanban');
    const input = page.getByLabel('Agregar tarea en Por hacer');
    await input.fill(secret);
    await input.press('Enter');
    await expect(page.getByRole('heading', { name: secret })).toBeVisible();
    await expect.poll(() => serverHas(sessionA.userId, 'kanban', secret), { timeout: 30_000 }).toBe(true);

    // Entra B en el MISMO navegador: el estado local sigue siendo el de A (no hubo limpieza), pero la sesion es la de B.
    await page.evaluate(
      ({ keyA, keyB, sessionBJson }) => {
        localStorage.removeItem(keyA);
        localStorage.setItem(keyB, sessionBJson);
      },
      { keyA: sessionA.storageKey, keyB: sessionB.storageKey, sessionBJson: JSON.stringify(sessionB.session) },
    );
    expect(await page.evaluate(() => localStorage.getItem('student_os_state_v1') ?? ''), 'el navegador aun guarda lo de A').toContain(secret);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
    await waitSynced(page, 40_000);

    // B no ve lo de A, ni en pantalla ni en el navegador, y nada de A llego a la cuenta de B.
    await openTab(page, 'Kanban');
    await expect(page.getByRole('heading', { name: secret })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('student_os_state_v1') ?? ''), 'lo de A se descarto del navegador').not.toContain(secret);
    expect(await serverHas(sessionB.userId, 'kanban', secret), 'lo de A nunca llega a B').toBe(false);
    expect(
      (await syncRecordsOf(sessionB.userId)).some((r) => JSON.stringify(r.data).includes(secret)),
      'ningun registro de B contiene lo de A',
    ).toBe(false);
    // Y lo de A sigue intacto en su cuenta.
    expect(await serverHas(sessionA.userId, 'kanban', secret)).toBe(true);
    await evidence(page, '03-usuario-b-sin-datos-de-a');
    expect(tap.pageErrors).toEqual([]);
    await context.close();
  });
});
