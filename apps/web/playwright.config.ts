import { defineConfig } from '@playwright/test';

/**
 * Suite E2E contra el stack REAL local (ver apps/api/test/e2e-harness/stack.mjs y docs/qa/REPORT.md).
 *   npm run test:e2e -w @student-os/web
 * El stack (Postgres embebido, Supabase/Google falsos, API Nest, Vite) lo levanta y apaga global-setup.ts.
 * Navegador: el Chrome del sistema (`channel: 'chrome'`); `E2E_CHANNEL=msedge` usa Edge.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  outputDir: './e2e/.results',
  // Un solo worker y en orden: todos los escenarios comparten un unico stack/base de datos.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: '../../docs/qa/artifacts/results.json' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    channel: (process.env.E2E_CHANNEL as 'chrome' | 'msedge' | undefined) ?? 'chrome',
    headless: process.env.E2E_HEADED !== '1',
    trace: process.env.E2E_TRACE === 'on' ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
  },
});
