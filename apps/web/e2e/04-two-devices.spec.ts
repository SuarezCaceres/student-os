import { expect, test, type Page } from '@playwright/test';
import {
  PageTap,
  VIEWPORTS,
  evidence,
  gotoApp,
  newContext,
  openTab,
  pullByFocusUntil,
  rowsOf,
  sessionFor,
  syncRecordsOf,
  userKey,
  waitSynced,
  type TestSession,
} from './support/harness';

/**
 * Escenario 4 - Dos contextos con el mismo usuario: PC 1440x960 y movil 390x844.
 * Crear / editar / borrar una entrega, una tarea Kanban y un ejercicio de gym en un lado y verlos en el otro tras
 * sincronizar (foco), con orden estable y sin eco infinito (conteo de push acotado).
 */
test.describe.configure({ mode: 'serial' });

// Una cuenta nueva parte de la semana academica 1 (spec 010).
const WEEK = 1;

async function kanbanAdd(page: Page, title: string): Promise<void> {
  await openTab(page, 'Kanban');
  const input = page.getByLabel('Agregar tarea en Por hacer');
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function uniAdd(page: Page, title: string): Promise<void> {
  await openTab(page, 'Universidad');
  const input = page.getByLabel(`Nueva entrega para la semana ${WEEK}`);
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByLabel(`Eliminar ${title}`)).toBeVisible();
}

async function gymAdd(page: Page, name: string): Promise<void> {
  await openTab(page, 'Gym');
  await page.getByRole('button', { name: 'Agregar ejercicio' }).first().click();
  await page.getByPlaceholder('Ej. Press inclinado con mancuernas').fill(name);
  await page.getByRole('button', { name: 'Guardar ejercicio' }).click();
  await startGymSession(page);
  await expect(page.getByRole('group', { name: `Series de ${name}` })).toBeVisible();
}

async function startGymSession(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: /Iniciemos con el entrenamiento/ });
  if (await start.isVisible().catch(() => false)) await start.click();
}

async function hasRecord(userId: string, collection: string, needle: string): Promise<boolean> {
  return (await syncRecordsOf(userId, collection)).some((r) => r.deletedAt === null && JSON.stringify(r.data ?? '').includes(needle));
}

async function recordGone(userId: string, collection: string, needle: string): Promise<boolean> {
  const rows = await syncRecordsOf(userId, collection);
  return !rows.some((r) => r.deletedAt === null && JSON.stringify(r.data ?? '').includes(needle));
}

test.describe('4. PC y movil con el mismo usuario', () => {
  let session: TestSession;
  let desktop: Page;
  let mobile: Page;
  let dTap: PageTap;
  let mTap: PageTap;
  const TASK = 'Tarea PC';
  const ASSIGN = 'Entrega PC';
  const EXERCISE = 'Ejercicio PC';

  test.beforeAll(async ({ browser }) => {
    session = await sessionFor(userKey('s4'));
    const dCtx = await newContext(browser, { session, viewport: VIEWPORTS.desktop });
    desktop = await dCtx.newPage();
    dTap = new PageTap(desktop);
    await gotoApp(desktop);
    // Sin importador (spec 009) y con cuenta vacia (spec 010): el primer dispositivo solo sube el perfil; no hay datos de ejemplo.
    await waitSynced(desktop, 40_000);
    await expect.poll(async () => (await rowsOf(session.userId)).syncActiveRecords, { timeout: 15_000 }).toBe(1);

    // El movil entra con la misma cuenta: trae lo de la nube y reemplaza su estado local (sin dialogos).
    const mCtx = await newContext(browser, { session, viewport: VIEWPORTS.mobile, isMobile: true });
    mobile = await mCtx.newPage();
    mTap = new PageTap(mobile);
    await gotoApp(mobile);
    await expect(mobile.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible({ timeout: 30_000 });
    await waitSynced(mobile, 40_000);
    await expect(mobile.getByText('Tienes datos aquí y en la nube')).toHaveCount(0);
  });

  test.afterAll(async () => {
    await desktop?.context().close();
    await mobile?.context().close();
  });

  test('4a. CREAR en el PC (entrega, tarea Kanban, ejercicio de gym) y verlo en el movil tras sincronizar', async () => {
    await kanbanAdd(desktop, TASK);
    await uniAdd(desktop, ASSIGN);
    await gymAdd(desktop, EXERCISE);
    await expect.poll(() => hasRecord(session.userId, 'kanban', TASK), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => hasRecord(session.userId, 'university', ASSIGN), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => hasRecord(session.userId, 'gym', EXERCISE), { timeout: 20_000 }).toBe(true);
    await evidence(desktop, '04-pc-creado');

    await openTab(mobile, 'Kanban');
    const attempts = await pullByFocusUntil(mobile, () => mobile.getByRole('heading', { name: TASK }).isVisible());
    await evidence(mobile, '04-movil-kanban-recibido');
    await openTab(mobile, 'Universidad');
    await expect(mobile.getByLabel(`Eliminar ${ASSIGN}`)).toBeVisible({ timeout: 10_000 });
    await openTab(mobile, 'Gym');
    await startGymSession(mobile);
    await expect(mobile.getByRole('group', { name: `Series de ${EXERCISE}` })).toBeVisible({ timeout: 10_000 });
    await evidence(mobile, '04-movil-gym-recibido');
    expect(attempts).toBeLessThan(12);
  });

  test('4b. EDITAR en el movil (empezar tarea, entregar, completar serie) y verlo en el PC', async () => {
    // Kanban: Empezar => en progreso
    await openTab(mobile, 'Kanban');
    await mobile.locator('article', { hasText: TASK }).getByRole('button', { name: 'Empezar' }).click();
    // En movil el tablero se muestra por pestanas de columna: la tarjeta pasa a "En curso".
    await mobile.getByRole('tab', { name: /En curso/ }).click();
    await expect(mobile.locator('article', { hasText: TASK }).getByRole('button', { name: 'Terminar' })).toBeVisible();
    // Universidad: marcar entregada
    await openTab(mobile, 'Universidad');
    await mobile.getByLabel(`Marcar ${ASSIGN} como entregada`).check();
    // Gym: iniciar sesion y completar la serie 1
    await openTab(mobile, 'Gym');
    await startGymSession(mobile);
    await mobile.getByRole('button', { name: `Serie 1 de ${EXERCISE}: pendiente` }).click();
    await expect(mobile.getByRole('button', { name: `Serie 1 de ${EXERCISE}: completada` })).toBeVisible();

    await expect
      .poll(async () => (await syncRecordsOf(session.userId, 'kanban')).some((r) => JSON.stringify(r.data ?? '').includes(TASK) && JSON.stringify(r.data).includes('in_progress')), { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(async () => (await syncRecordsOf(session.userId, 'university')).some((r) => JSON.stringify(r.data ?? '').includes(ASSIGN) && JSON.stringify(r.data).includes('entregado')), { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(async () => (await syncRecordsOf(session.userId, 'gym')).some((r) => JSON.stringify(r.data ?? '').includes(EXERCISE) && /"completedSets":\[true/.test(JSON.stringify(r.data))), { timeout: 20_000 })
      .toBe(true);
    await evidence(mobile, '04-movil-editado');

    await openTab(desktop, 'Kanban');
    await pullByFocusUntil(desktop, () => desktop.locator('article', { hasText: TASK }).getByRole('button', { name: 'Terminar' }).isVisible());
    await openTab(desktop, 'Universidad');
    await expect(desktop.getByLabel(`Marcar ${ASSIGN} como pendiente`)).toBeChecked({ timeout: 10_000 });
    await openTab(desktop, 'Gym');
    await startGymSession(desktop);
    await expect(desktop.getByRole('button', { name: `Serie 1 de ${EXERCISE}: completada` })).toBeVisible({ timeout: 10_000 });
    await evidence(desktop, '04-pc-edicion-recibida');
  });

  test('4c. orden estable: las dos pantallas muestran la misma secuencia de tarjetas', async () => {
    // Una cuenta nueva parte vacia (spec 010): el PC crea varias tarjetas propias para que el orden se pueda comparar.
    for (const title of ['Orden K1', 'Orden K2', 'Orden K3']) await kanbanAdd(desktop, title);
    for (const title of ['Orden U1', 'Orden U2', 'Orden U3']) await uniAdd(desktop, title);
    await expect.poll(() => hasRecord(session.userId, 'kanban', 'Orden K3'), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => hasRecord(session.userId, 'university', 'Orden U3'), { timeout: 20_000 }).toBe(true);
    await openTab(mobile, 'Kanban');
    await pullByFocusUntil(mobile, () => mobile.getByRole('heading', { name: 'Orden K3' }).isVisible());
    await openTab(mobile, 'Universidad');
    await expect(mobile.getByLabel('Eliminar Orden U3')).toBeVisible({ timeout: 15_000 });
    // Orden del estado local de cada dispositivo (lo que realmente pinta la UI), por coleccion.
    const stateOrder = async (p: Page): Promise<{ kanban: string[]; uni: string[] }> =>
      p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('student_os_state_v1') ?? '{}') as { kanbanItems?: Array<{ id: string }>; universityAssignments?: Array<{ id: string }> };
        return { kanban: (s.kanbanItems ?? []).map((i) => i.id), uni: (s.universityAssignments ?? []).map((i) => i.id) };
      });
    const [sd, sm] = [await stateOrder(desktop), await stateOrder(mobile)];
    expect(sd.kanban.length).toBeGreaterThan(3);
    expect(sm.kanban).toEqual(sd.kanban);
    expect(sm.uni).toEqual(sd.uni);
    // Y en pantalla: la columna "Por hacer" se ve en el mismo orden (en el PC son 3 columnas; en el movil una pestana).
    await openTab(desktop, 'Kanban');
    await openTab(mobile, 'Kanban');
    await mobile.getByRole('tab', { name: /Por hacer/ }).click();
    const todoTitles = async (p: Page): Promise<string[]> => (await p.locator('article:has(span:text-is("Empezar")) h3').allTextContents()).map((t) => t.trim());
    const [d, m] = [await todoTitles(desktop), await todoTitles(mobile)];
    expect(d.length).toBeGreaterThan(0);
    expect(m).toEqual(d);
    await openTab(desktop, 'Universidad');
    await openTab(mobile, 'Universidad');
    const uni = async (p: Page): Promise<string[]> => p.locator('[aria-label^="Ver detalle y rúbrica de"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const [ud, um] = [await uni(desktop), await uni(mobile)];
    expect(ud.length).toBeGreaterThan(3);
    expect(um).toEqual(ud);
  });

  test('4d. BORRAR en el PC (entrega, tarea, ejercicio) y verlo desaparecer en el movil', async () => {
    await openTab(desktop, 'Kanban');
    await desktop.getByRole('button', { name: `Eliminar tarea: ${TASK}` }).click();
    await openTab(desktop, 'Universidad');
    await desktop.getByLabel(`Eliminar ${ASSIGN}`).click();
    await openTab(desktop, 'Gym');
    await startGymSession(desktop);
    await desktop.getByLabel(`Eliminar ${EXERCISE}`).click();
    await expect.poll(() => recordGone(session.userId, 'kanban', TASK), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => recordGone(session.userId, 'university', ASSIGN), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => recordGone(session.userId, 'gym', EXERCISE), { timeout: 20_000 }).toBe(true);
    // Los borrados viajan como tombstones (borrado logico), no se pierden entre dispositivos.
    expect((await syncRecordsOf(session.userId)).filter((r) => r.deletedAt !== null).length).toBeGreaterThanOrEqual(2);

    await openTab(mobile, 'Kanban');
    await mobile.getByRole('tab', { name: /En curso/ }).click();
    await pullByFocusUntil(mobile, async () => (await mobile.getByRole('heading', { name: TASK }).count()) === 0);
    // (el estado local tampoco la conserva, en ninguna columna)
    expect(await mobile.evaluate(() => localStorage.getItem('student_os_state_v1') ?? '')).not.toContain('Tarea PC');
    await openTab(mobile, 'Universidad');
    await expect(mobile.getByLabel(`Eliminar ${ASSIGN}`)).toHaveCount(0, { timeout: 10_000 });
    await openTab(mobile, 'Gym');
    await startGymSession(mobile);
    await expect(mobile.getByRole('group', { name: `Series de ${EXERCISE}` })).toHaveCount(0, { timeout: 10_000 });
    await evidence(mobile, '04-movil-borrado-recibido');
  });

  test('4e. sin eco infinito: tras converger no hay mas pushes y el total esta acotado', async () => {
    await waitSynced(desktop, 30_000);
    await waitSynced(mobile, 30_000);
    const before = { d: dTap.pushes().length, m: mTap.pushes().length };
    await desktop.waitForTimeout(20_000);
    const after = { d: dTap.pushes().length, m: mTap.pushes().length };
    expect(after, 'en reposo no se hacen push').toEqual(before);
    // 3 entidades x (crear + editar + borrar) = ~9 cambios; con debounce de 1,5 s el motor agrupa. Cota generosa.
    const total = { d: dTap.pushes().length, m: mTap.pushes().length };
    console.log(`[e2e] push totales  PC=${total.d}  movil=${total.m}; pulls PC=${dTap.pulls().length} movil=${mTap.pulls().length}`);
    expect(total.d).toBeLessThanOrEqual(15);
    expect(total.m).toBeLessThanOrEqual(12);
    // Los pushes del dispositivo que SOLO recibio (movil en 4a y PC en 4b) no deben contener su eco: el movil solo
    // empujo lo que edito (4b), asi que debe tener bastantes menos que el PC.
    expect(total.m).toBeLessThan(total.d);
    expect(dTap.statuses().filter((s) => s >= 400 && s !== 409)).toEqual([]);
    expect(mTap.statuses().filter((s) => s >= 400 && s !== 409)).toEqual([]);
    expect(dTap.pageErrors.concat(mTap.pageErrors)).toEqual([]);
  });
});
