import { expect, test, type Page } from '@playwright/test';
import {
  apiFetch,
  bootDevice,
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
 * Escenario 7 - Quehaceres diarios (spec 012). La tarjeta del resumen trae la lista base, se marca una vez por dia,
 * da animo segun cuantos se completan, permite decir «hoy no puedo» sin penalizar, y todo se guarda por usuario y
 * viaja a otros dispositivos.
 */
test.describe.configure({ mode: 'serial' });

const BASE = ['Tender la cama', 'Pasear al perro', 'Ducharme', 'Limpiar mi cuarto', 'Avanzar en mis proyectos personales de inteligencia artificial'];

const card = (page: Page) => page.getByTestId('chores-card');
const box = (page: Page, name: string) => card(page).getByRole('checkbox', { name });

/** Registros de la cuenta en el servidor (colección `calendar`) de un tipo dado. */
async function choreRecords(userId: string, kind: string) {
  const rows = await syncRecordsOf(userId, 'calendar');
  return rows.filter((r) => r.deletedAt === null && (r.data as { kind?: string } | null)?.kind === kind);
}

const completedOnServer = async (userId: string): Promise<string[]> => {
  const days = await choreRecords(userId, 'choreDay');
  const value = (days[0]?.data as { value?: { completed?: Array<{ name: string }> } } | undefined)?.value;
  return (value?.completed ?? []).map((c) => c.name).sort();
};

test.describe('7. quehaceres diarios', () => {
  let session: TestSession;
  let a: Device;

  test.beforeAll(async ({ browser }) => {
    session = await sessionFor(userKey('s7'));
    a = await bootDevice(browser, session, { kind: 'desktop' });
  });

  test.afterAll(async () => {
    await a?.context.close();
  });

  test('7a. una cuenta nueva ve los cinco quehaceres de la lista base sin marcar (C1)', async () => {
    await expect(card(a.page)).toBeVisible({ timeout: 30_000 });
    for (const name of BASE) await expect(box(a.page, name)).not.toBeChecked();
    await expect(card(a.page).getByRole('checkbox')).toHaveCount(5);
    await expect(a.page.getByLabel('0 de 5 quehaceres completados')).toBeVisible();
  });

  test('7b. marcar y desmarcar actualiza el contador y la barra, y 5 quehaceres dan «¡Eres lo máximo!» (C4, C5)', async () => {
    await box(a.page, BASE[0]).check();
    await expect(a.page.getByLabel('1 de 5 quehaceres completados')).toBeVisible();
    await box(a.page, BASE[0]).uncheck();
    await expect(a.page.getByLabel('0 de 5 quehaceres completados')).toBeVisible();

    for (const name of BASE) await box(a.page, name).check();
    await expect(a.page.getByLabel('5 de 5 quehaceres completados')).toBeVisible();
    await expect(a.page.getByTestId('chores-message')).toContainText('¡Eres lo máximo!');
  });

  test('7c. lo marcado se guarda en el servidor, con el nombre copiado en el historial (C14, C11)', async () => {
    await expect.poll(() => completedOnServer(session.userId), { timeout: 20_000 }).toEqual([...BASE].sort());
    expect((await choreRecords(session.userId, 'chore')).length, 'los 5 quehaceres base estan en la nube').toBe(5);
    expect((await choreRecords(session.userId, 'choreSettings')).length).toBe(1);
  });

  test('7d. otro dispositivo de la cuenta ve lo marcado y no vuelve a sembrar la lista (C14)', async ({ browser }) => {
    const b = await bootDevice(browser, session, { kind: 'desktop' });
    try {
      await expect(card(b.page)).toBeVisible({ timeout: 30_000 });
      await expect(card(b.page).getByRole('checkbox')).toHaveCount(5); // sin duplicados por doble siembra
      for (const name of BASE) await expect(box(b.page, name)).toBeChecked();
      expect(relevantConsoleErrors(b.tap)).toEqual([]);

      // Desmarca uno en B y llega a A.
      await box(b.page, BASE[2]).uncheck();
      await waitSynced(b.page, 30_000);
      await pullByFocusUntil(a.page, async () => !(await box(a.page, BASE[2]).isChecked()));
      await expect(box(a.page, BASE[2])).not.toBeChecked();
      await box(a.page, BASE[2]).check();
    } finally {
      await b.context.close();
    }
  });

  test('7e. «Hoy no puedo» marca un día difícil sin penalizar y «Deshacer» conserva lo marcado (C8, C9)', async () => {
    await a.page.getByRole('button', { name: 'Hoy no puedo' }).click();
    await expect(a.page.getByTestId('chores-hard-panel')).toBeVisible();
    await expect(a.page.getByTestId('chores-message')).toContainText('día difícil');
    await expect(card(a.page).getByRole('progressbar')).toHaveCount(0); // sin barra de meta incumplida
    await a.page.getByRole('button', { name: 'Cansado' }).click();

    await expect
      .poll(async () => {
        const days = await choreRecords(session.userId, 'choreDay');
        return (days[0]?.data as { value?: { hard?: boolean; reason?: string } } | undefined)?.value;
      }, { timeout: 20_000 })
      .toMatchObject({ hard: true, reason: 'cansado' });

    await a.page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(a.page.getByTestId('chores-hard-panel')).toHaveCount(0);
    for (const name of BASE) await expect(box(a.page, name)).toBeChecked(); // lo marcado se conserva
  });

  test('7f. se puede añadir un quehacer propio desde el editor y se guarda (C2)', async () => {
    await a.page.getByRole('button', { name: 'Editar quehaceres y metas' }).click();
    const dialog = a.page.getByRole('dialog');
    await dialog.getByLabel(/Nombre|nuevo quehacer/i).first().fill('Caminar 15 minutos');
    await dialog.getByRole('button', { name: 'Añadir' }).first().click();
    await a.page.keyboard.press('Escape');
    await expect(box(a.page, 'Caminar 15 minutos')).toBeVisible();
    await expect(box(a.page, 'Caminar 15 minutos')).not.toBeChecked();
    await expect.poll(async () => (await choreRecords(session.userId, 'chore')).length, { timeout: 20_000 }).toBe(6);
  });

  test('7g. la gráfica semanal muestra un estado vacío claro con pocos días (C13)', async () => {
    await a.page.getByRole('button', { name: 'Ver tu semana' }).click();
    await expect(card(a.page).getByText(/Aún no hay suficientes días/)).toBeVisible();
    // Sin gráfica en ceros: el contador de la tarjeta también es role=img, así que se busca solo la gráfica.
    await expect(card(a.page).getByRole('img', { name: /Promedio de quehaceres completados por día/ })).toHaveCount(0);
  });

  test('7h. otro usuario parte con su propia lista, sin lo marcado por este (C15)', async ({ browser }) => {
    const other = await sessionFor(userKey('s7-otro'));
    const c = await bootDevice(browser, other, { kind: 'desktop' });
    try {
      await expect(card(c.page)).toBeVisible({ timeout: 30_000 });
      await expect(card(c.page).getByRole('checkbox')).toHaveCount(5);
      for (const name of BASE) await expect(box(c.page, name)).not.toBeChecked();
      await expect(box(c.page, 'Caminar 15 minutos')).toHaveCount(0);
      expect(await completedOnServer(other.userId)).toEqual([]);
    } finally {
      await c.context.close();
    }
  });

  test('7i. el historial muestra los días pasados con el nombre con el que se completaron y el día difícil (C11)', async ({ browser }) => {
    // Se siembran por el API dos días pasados ANTES de arrancar el dispositivo: uno con un quehacer que ya no está en la
    // lista base (nombre antiguo) y otro difícil con motivo. Fechas locales de hace 2 y 3 días.
    const hist = await sessionFor(userKey('s7-hist'));
    const isoDaysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const at = new Date().toISOString();
    const record = (date: string, value: object) => ({
      id: `chore-day-${date}`,
      collection: 'calendar',
      data: { kind: 'choreDay', value: { date, ...value } },
      updatedAt: at,
      deletedAt: null,
      rev: 0,
    });
    const twoAgo = isoDaysAgo(2);
    const threeAgo = isoDaysAgo(3);
    const pushed = await apiFetch('/sync/push', hist.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        changes: [
          record(twoAgo, {
            hard: false,
            completed: [
              { choreId: 'chore-base-0', name: 'Hacer la cama de antes' },
              { choreId: 'chore-borrado', name: 'Regar las plantas' },
            ],
          }),
          record(threeAgo, { hard: true, reason: 'cansado', completed: [] }),
        ],
      }),
    });
    expect(pushed.status, pushed.text).toBeLessThan(300);

    const d = await bootDevice(browser, hist, { kind: 'desktop' });
    try {
      await expect(card(d.page)).toBeVisible({ timeout: 30_000 });
      const toggle = card(d.page).getByRole('button', { name: /historial/i });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(d.page.getByTestId('chores-history')).toHaveCount(0);

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const history = d.page.getByTestId('chores-history');
      const entries = history.locator('li[data-date]');
      await expect(entries).toHaveCount(2);
      // Más reciente primero.
      await expect(entries.nth(0)).toHaveAttribute('data-date', twoAgo);
      await expect(entries.nth(1)).toHaveAttribute('data-date', threeAgo);
      // Nombres copiados: ni «Hacer la cama de antes» ni «Regar las plantas» existen en la lista actual.
      await expect(entries.nth(0)).toContainText('2 quehaceres');
      await expect(entries.nth(0)).toContainText('Hacer la cama de antes');
      await expect(entries.nth(0)).toContainText('Regar las plantas');
      await expect(entries.nth(1)).toContainText('Día difícil · cansado');
      await expect(history).not.toContainText(/incumpl|fall|fracas/i);
      // Solo lectura y hoy sigue editable arriba, con su lista normal.
      await expect(history.getByRole('checkbox')).toHaveCount(0);
      await expect(card(d.page).getByRole('list', { name: 'Quehaceres de hoy' }).getByRole('checkbox')).toHaveCount(5);
      expect(relevantConsoleErrors(d.tap)).toEqual([]);
    } finally {
      await d.context.close();
    }
  });
});
