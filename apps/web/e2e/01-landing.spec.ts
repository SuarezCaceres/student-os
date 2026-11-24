import { expect, test } from '@playwright/test';
import { PageTap, WEB, WEB_NOCLOUD, evidence, gotoApp, newContext, relevantConsoleErrors, sessionFor, userKey } from './support/harness';

/**
 * Escenario 1 - Sin sesion solo existe la landing y el unico acceso es «Continuar con Google» (spec 009, C1 y C2).
 * No hay registro con correo, ni demo, ni modo local.
 */
test.describe('1. landing publica: unico acceso con Google', () => {
  test('1a. C1: la landing y el modal solo ofrecen «Continuar con Google», sin correo, registro ni demo', async ({ browser }) => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const tap = new PageTap(page);
    await page.goto(WEB, { waitUntil: 'networkidle' });

    // La landing lleva los enlaces legales (el escenario 10 los comprueba a fondo).
    await expect(page.getByRole('link', { name: /Política de privacidad|Privacidad/i }).first()).toBeVisible();
    // Ninguna entrada alternativa en la landing.
    for (const prohibited of [/Explorar Demo/i, /Ver Demo/i, /Crear Cuenta/i, /Probar Demo/i, /Iniciar Sesión/i, /Modo Demo/i]) {
      await expect(page.getByText(prohibited), `no debe haber ${prohibited}`).toHaveCount(0);
    }
    await evidence(page, '01-landing-solo-google');

    // El acceso abre el modal, que solo tiene el boton de Google.
    await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Continuar con Google/i })).toHaveCount(1);
    await expect(dialog.locator('input')).toHaveCount(0);
    await expect(dialog.getByText(/Google Calendar queda conectado/)).toBeVisible();
    await evidence(page, '01-landing-modal-google');

    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });

  test('1b. C2: sin sesion no se ve la app ni datos locales previos, aunque quede la marca de sesion del prototipo', async ({ browser }) => {
    // Primero entra con una sesion real para que la app guarde datos locales validos en el navegador...
    const s = await sessionFor(userKey('s1b'));
    const context = await newContext(browser, { session: s });
    const page = await context.newPage();
    await gotoApp(page);
    await expect(page.getByRole('tablist', { name: 'Vistas principales' })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem('student_os_state_v1')), 'la app dejo datos locales').toBeTruthy();

    // ...y simula lo que dejo el prototipo: sin sesion de Supabase, pero con datos locales y la marca de sesion antigua.
    await page.evaluate((storageKey) => {
      localStorage.removeItem(storageKey);
      localStorage.setItem('student_os_user_session', JSON.stringify({ name: 'Alguien', email: 'a@b.c', isLoggedIn: true }));
    }, s.storageKey);
    await page.reload({ waitUntil: 'networkidle' });

    // No se monta la app, no se muestran los datos y se ve la landing con su unico acceso.
    await expect(page.getByRole('tablist', { name: 'Vistas principales' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Continuar con Google/i }).first()).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test('1c. sin variables de nube el acceso queda deshabilitado, avisa y no hace peticiones de red hacia la nube', async ({ browser }) => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const tap = new PageTap(page);
    const cloudRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      const { port, hostname } = new URL(url);
      // (Google Fonts es una peticion estatica conocida y declarada en la politica de privacidad: no es "nube".)
      const isFonts = /^fonts\.(googleapis|gstatic)\.com$/.test(hostname);
      if (
        !isFonts &&
        (['3100', '54341', '54342'].includes(port) ||
          /supabase\.co|googleapis\.com|accounts\.google\.com/.test(hostname) ||
          /supabase_supabase-js|@supabase\/supabase-js/.test(url))
      ) {
        cloudRequests.push(url);
      }
    });

    await page.goto(WEB_NOCLOUD, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Continuar con Google/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /Continuar con Google/i })).toBeDisabled();
    await expect(dialog.getByText(/no está disponible en este momento/)).toBeVisible();
    await evidence(page, '01-landing-sin-nube');

    expect(cloudRequests, `peticiones de nube inesperadas: ${cloudRequests.join(', ')}`).toEqual([]);
    expect(tap.calls).toEqual([]);
    expect(tap.pageErrors).toEqual([]);
    expect(relevantConsoleErrors(tap)).toEqual([]);
    await context.close();
  });
});
