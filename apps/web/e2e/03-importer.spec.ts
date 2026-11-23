import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  PageTap,
  evidence,
  gotoApp,
  newContext,
  openTab,
  relevantConsoleErrors,
  rowsOf,
  sessionFor,
  syncBadgeText,
  syncRecordsOf,
  userKey,
  waitSynced,
  type TestSession,
} from './support/harness';

/**
 * Escenario 3 - Importador del primer inicio de sesion.
 * "Local con datos" = los datos de ejemplo que trae la app por defecto (initialData) en un navegador nuevo.
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

test.describe('3. importador del primer inicio', () => {
  const key = userKey('s3');
  let session: TestSession;

  test('3a. local con datos + nube vacia: ofrece subir, descarga respaldo previo y sube', async ({ browser }) => {
    session = await sessionFor(key);
    const { context, page, tap } = await openDevice(browser, session);
    await expect(page.getByText('¿Subimos tus datos a la nube?')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/respaldo \(archivo JSON\)/)).toBeVisible();
    await evidence(page, '03-importador-subir');
    expect((await rowsOf(session.userId)).syncActiveRecords, 'antes de decidir, no se sube nada').toBe(0);
    expect(tap.pushes(), 'antes de decidir no hay push').toHaveLength(0);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Subir mis datos' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const path = await download.path();
    const backup = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(JSON.stringify(backup).length, 'el respaldo previo contiene los datos locales').toBeGreaterThan(1000);

    await waitSynced(page, 40_000);
    await expect.poll(async () => (await rowsOf(session.userId)).syncActiveRecords, { timeout: 15_000 }).toBeGreaterThan(10);
    const collections = new Set((await syncRecordsOf(session.userId)).map((r) => r.collection));
    for (const c of ['kanban', 'university', 'profile']) expect(collections, `coleccion ${c} subida`).toContain(c);
    expect(tap.pushes().length).toBeGreaterThan(0);
    expect(tap.pushes().every((p) => p.status === 200), 'todos los push respondieron 200').toBe(true);
    await evidence(page, '03-importador-subido');

    // Una recarga NO vuelve a preguntar (marca "ya importo" + cursor persistido).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
    await waitSynced(page, 30_000);
    await expect(page.getByText('¿Subimos tus datos a la nube?')).toHaveCount(0);
    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });

  test('3b. local + nube con datos distintos: modal "Usar la nube / Conservar este dispositivo" y "Usar la nube" reemplaza lo local', async ({ browser }) => {
    // Dispositivo 1 (ya sincronizado) anade una tarea que solo existe en la nube.
    const d1 = await openDevice(browser, session);
    await waitSynced(d1.page, 40_000);
    await openTab(d1.page, 'Kanban');
    const input = d1.page.getByLabel('Agregar tarea en Por hacer');
    await input.fill('Solo en la nube');
    await input.press('Enter');
    await expect(d1.page.getByRole('heading', { name: 'Solo en la nube' })).toBeVisible();
    await expect
      .poll(async () => (await syncRecordsOf(session.userId, 'kanban')).some((r) => JSON.stringify(r.data ?? '').includes('Solo en la nube')), { timeout: 20_000 })
      .toBe(true);

    // Dispositivo 2: navegador nuevo, datos de ejemplo locales, mismo usuario.
    const d2 = await openDevice(browser, session);
    await expect(d2.page.getByText('Tienes datos aquí y en la nube')).toBeVisible({ timeout: 25_000 });
    await expect(d2.page.getByRole('button', { name: /Usar la nube/ })).toBeVisible();
    await expect(d2.page.getByRole('button', { name: /Conservar lo de este dispositivo/ })).toBeVisible();
    await evidence(d2.page, '03-importador-decision');
    expect(d2.tap.pushes(), 'no se mezcla ni se sube nada sin decidir').toHaveLength(0);

    await d2.page.getByRole('button', { name: /Usar la nube/ }).click();
    await expect(d2.page.getByText(/Se reemplazará lo de este dispositivo por lo de tu cuenta/)).toBeVisible();
    await evidence(d2.page, '03-importador-confirmar-nube');
    const downloads: string[] = [];
    d2.page.on('download', (dl) => downloads.push(dl.suggestedFilename()));
    await d2.page.getByRole('button', { name: 'Sí, reemplazar' }).click();
    await waitSynced(d2.page, 40_000);
    expect(downloads.length, 'respaldo local descargado antes de reemplazar').toBeGreaterThan(0);
    await openTab(d2.page, 'Kanban');
    await expect(d2.page.getByRole('heading', { name: 'Solo en la nube' })).toBeVisible({ timeout: 15_000 });
    await evidence(d2.page, '03-importador-usar-nube-ok');
    await d1.context.close();
    await d2.context.close();
  });

  test('3c. "Conservar lo de este dispositivo" sube lo local y tumba lo que solo estaba en la nube (con confirmacion y respaldos)', async ({ browser }) => {
    const d3 = await openDevice(browser, session);
    await expect(d3.page.getByText('Tienes datos aquí y en la nube')).toBeVisible({ timeout: 25_000 });
    await d3.page.getByRole('button', { name: /Conservar lo de este dispositivo/ }).click();
    await expect(d3.page.getByText(/Se reemplazará lo de tu nube por lo de este dispositivo/)).toBeVisible();
    const downloads: string[] = [];
    d3.page.on('download', (dl) => downloads.push(dl.suggestedFilename()));
    await d3.page.getByRole('button', { name: 'Sí, reemplazar' }).click();
    await waitSynced(d3.page, 40_000);
    expect(downloads.length, 'respaldo(s) descargado(s) antes de reemplazar la nube').toBeGreaterThan(0);
    await expect
      .poll(
        async () => {
          const rows = await syncRecordsOf(session.userId, 'kanban');
          const mine = rows.find((r) => JSON.stringify(r.data ?? '').includes('Solo en la nube') || r.deletedAt !== null);
          return mine ? mine.deletedAt !== null : 'no-encontrada';
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    await openTab(d3.page, 'Kanban');
    await expect(d3.page.getByRole('heading', { name: 'Solo en la nube' })).toHaveCount(0);
    await d3.context.close();
  });

  test('3d. "Ahora no": la sincronizacion queda en pausa, no se sube nada y se avisa en el indicador', async ({ browser }) => {
    const s = await sessionFor(userKey('s3d'));
    const d = await openDevice(browser, s);
    await expect(d.page.getByText('¿Subimos tus datos a la nube?')).toBeVisible({ timeout: 20_000 });
    await d.page.getByRole('button', { name: 'Ahora no' }).click();
    await expect.poll(() => syncBadgeText(d.page), { timeout: 10_000 }).toMatch(/en pausa/);
    await d.page.waitForTimeout(3_000);
    expect(d.tap.pushes()).toHaveLength(0);
    expect((await rowsOf(s.userId)).syncActiveRecords).toBe(0);
    await evidence(d.page, '03-importador-ahora-no');
    await d.context.close();
  });
});
