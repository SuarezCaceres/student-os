import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Las pruebas de sync corren en node con fake-indexeddb; las de componentes piden jsdom con
// `// @vitest-environment jsdom` en la cabecera del archivo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
