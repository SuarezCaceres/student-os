import { expect, test } from '@playwright/test';
import { PageTap, WEB_NOCLOUD, evidence, newContext, openTab, relevantConsoleErrors } from './support/harness';

/**
 * Escenario 1 - Modo sin nube: el servidor Vite del puerto 5294 se arranca SIN VITE_SUPABASE_* ni VITE_API_URL.
 * La app debe comportarse como antes de existir el backend: sin red hacia la API/Supabase, sin errores de consola.
 */
test('1. modo sin nube: la app arranca y funciona como hoy, sin errores de consola ni red de nube', async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  const tap = new PageTap(page);
  const cloudRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    const { port, hostname } = new URL(url);
    // Hacia la API, Supabase/Google falsos, o la libreria supabase-js (que no debe ni descargarse sin variables).
    // (Google Fonts es una peticion estatica conocida y declarada en la politica de privacidad: no es "nube".)
    const isFonts = /^fonts\.(googleapis|gstatic)\.com$/.test(hostname);
    if (!isFonts && (['3100', '54341', '54342'].includes(port) || /supabase\.co|googleapis\.com|accounts\.google\.com/.test(hostname) || /supabase_supabase-js|@supabase\/supabase-js/.test(url))) {
      cloudRequests.push(url);
    }
  });

  await page.goto(WEB_NOCLOUD, { waitUntil: 'networkidle' });
  // Landing publica: el pie lleva los enlaces legales (escenario 10 los comprueba a fondo).
  await expect(page.getByRole('link', { name: /Política de privacidad|Privacidad/i }).first()).toBeVisible();
  await evidence(page, '01-nocloud-landing');

  // Sin nube, "Iniciar sesion" ofrece el modal de siempre (acceso local con correo/GIS y modo demo).
  await page.getByRole('button', { name: /Iniciar sesión/i }).first().click();
  await expect(page.getByText('Entrar al Workspace en Modo Demo (1 Clic)')).toBeVisible();
  await evidence(page, '01-nocloud-authmodal');
  await page.getByRole('button', { name: 'Cerrar ventana de autenticación' }).first().click();

  // Entra al modo demo con datos de ejemplo.
  await page.getByRole('button', { name: /Explorar Demo en Vivo/i }).first().click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({ timeout: 20_000 });

  // Usa la app de verdad: crear y borrar una tarea Kanban, persistir en localStorage.
  await openTab(page, 'Kanban');
  const input = page.getByLabel('Agregar tarea en Por hacer');
  await input.fill('Tarea sin nube');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: 'Tarea sin nube' })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('student_os_state_v1') ?? '');
  expect(stored).toContain('Tarea sin nube');
  // El modo demo no guarda "sesion": al recargar vuelve la landing, pero los datos siguen en localStorage.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Explorar Demo en Vivo/i }).first().click();
  await openTab(page, 'Kanban');
  await expect(page.getByRole('heading', { name: 'Tarea sin nube' })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar tarea: Tarea sin nube' }).click();
  await expect(page.getByRole('heading', { name: 'Tarea sin nube' })).toHaveCount(0);
  await evidence(page, '01-nocloud-kanban');

  // Ni indicador de sync, ni peticiones de nube, ni IndexedDB de sync.
  await expect(page.getByRole('status').filter({ hasText: /Sincroniz|Conectando/ })).toHaveCount(0);
  expect(cloudRequests, `peticiones de nube inesperadas: ${cloudRequests.join(', ')}`).toEqual([]);
  expect(tap.calls).toEqual([]);
  const idb = await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    return dbs.map((d) => d.name);
  });
  expect(idb.filter((n) => n && /keyval|sync/i.test(n))).toEqual([]);

  expect(tap.pageErrors).toEqual([]);
  expect(relevantConsoleErrors(tap)).toEqual([]);
  await context.close();
});
