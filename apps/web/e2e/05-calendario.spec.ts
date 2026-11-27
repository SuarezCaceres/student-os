import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  PageTap,
  WEB,
  control,
  evidence,
  newContext,
  openTab,
  relevantConsoleErrors,
  sessionFor,
  userKey,
} from './support/harness';

/**
 * Escenario 5 - Calendar como parte del entorno de la cuenta (spec 009, C7 y C8).
 * La persona entra con Google (un solo consentimiento, sin boton de conectar) y su calendario de Google ya esta
 * integrado: ve sus eventos sin hacer nada y lo que publica en StudentOS aparece en su Google Calendar.
 */
test.describe.configure({ mode: 'serial' });

interface GoogleEvent {
  id?: string;
  summary?: string;
  recurrence?: string[];
  start?: { dateTime?: string };
}

async function loginWithGoogle(browser: Browser, key: string): Promise<{ context: BrowserContext; page: Page; tap: PageTap }> {
  await control('/supabase/config', { loginUserKey: key });
  const context = await newContext(browser);
  const page = await context.newPage();
  const tap = new PageTap(page);
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Continuar con Google/i }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 30_000 });
  return { context, page, tap };
}

/** Evento de hoy, de 15:00 a 16:00 hora local, como lo devuelve Google. */
function todayEvent(id: string, summary: string, hour: number): GoogleEvent & { end: { dateTime: string } } {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { id, summary, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
}

async function googleEvents(email: string): Promise<GoogleEvent[]> {
  return control<GoogleEvent[]>(`/google/events?email=${encodeURIComponent(email)}`);
}

test.describe('5. calendario integrado con Google', () => {
  test('5a. C7: los eventos de Google se ven en el calendario sin pulsar nada y se actualizan al volver a la ventana', async ({ browser }) => {
    const key = userKey('s5a');
    const email = `${key}@e2e.test`;
    await control('/google/seed', { email, event: todayEvent('e2e-parcial', 'Parcial E2E de Calculo', 9) });

    const { context, page, tap } = await loginWithGoogle(browser, key);
    const s = await sessionFor(key);
    await expect
      .poll(async () => (await page.evaluate(() => localStorage.getItem('student_os_gcal_meta'))) ?? '', { timeout: 20_000 })
      .toContain('"connected":true');

    await openTab(page, 'Horario');
    // Sin pulsar «Sincronizar» ni «Conectar»: el evento ya esta.
    await expect(page.getByText('Parcial E2E de Calculo').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Conectar Google Calendar/i })).toHaveCount(0);

    // Un evento creado despues en Google aparece al volver a la ventana, sin recargar.
    await control('/google/seed', { email, event: todayEvent('e2e-reunion', 'Reunion E2E de grupo', 18) });
    // La app ignora los "volver a la ventana" que llegan menos de 10 s despues de una sincronizacion (enfriamiento).
    await page.waitForTimeout(11_000);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await expect(page.getByText('Reunion E2E de grupo').first()).toBeVisible({ timeout: 45_000 });
    await evidence(page, '05-calendario-eventos-de-google');

    expect(s.userId).toBeTruthy();
    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });

  test('5b. C8: el turno de trabajo se publica en el Google Calendar real de la cuenta sin vincular nada antes', async ({ browser }) => {
    const key = userKey('s5b');
    const email = `${key}@e2e.test`;
    const { context, page, tap } = await loginWithGoogle(browser, key);
    await expect
      .poll(async () => (await page.evaluate(() => localStorage.getItem('student_os_gcal_meta'))) ?? '', { timeout: 20_000 })
      .toContain('"connected":true');
    expect(await googleEvents(email)).toEqual([]);

    await openTab(page, 'Horario');
    await page.getByRole('button', { name: /Turno laboral/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Una cuenta nueva no trae turno: se activa y, como Calendar ya esta vinculado, viene marcado para sincronizar.
    await dialog.getByLabel(/Activar turno laboral fijo/).check();
    const save = dialog.getByRole('button', { name: 'Guardar y sincronizar Google' });
    await expect(save).toBeVisible({ timeout: 15_000 });
    await save.click();

    await expect
      .poll(async () => (await googleEvents(email)).filter((e) => (e.recurrence ?? []).some((r) => r.startsWith('RRULE'))).length, { timeout: 45_000 })
      .toBeGreaterThan(0);
    await evidence(page, '05-turno-publicado-en-google');

    expect(tap.pageErrors).toEqual([]);
    await context.close();
  });

  test('5c. C8: un bloque marcado para Google aparece en el Google Calendar de la cuenta', async ({ browser }) => {
    const key = userKey('s5c');
    const email = `${key}@e2e.test`;
    const { context, page, tap } = await loginWithGoogle(browser, key);
    await expect
      .poll(async () => (await page.evaluate(() => localStorage.getItem('student_os_gcal_meta'))) ?? '', { timeout: 20_000 })
      .toContain('"connected":true');

    await openTab(page, 'Horario');
    await page.getByRole('button', { name: 'Agendar bloque' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Actividad o clase').fill('Estudio E2E publicado');
    const alsoGoogle = dialog.getByLabel(/Guardar también en Google Calendar/);
    await expect(alsoGoogle).toBeVisible({ timeout: 15_000 });
    await alsoGoogle.check();
    await dialog.getByRole('button', { name: 'Guardar bloque' }).click();

    await expect
      .poll(async () => (await googleEvents(email)).some((e) => e.summary === 'Estudio E2E publicado'), { timeout: 45_000 })
      .toBe(true);
    expect(tap.pageErrors).toEqual([]);
    await context.close();
  });
});
