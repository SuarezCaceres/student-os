import { defineConfig } from 'tsup';

// El package.json es "type": "module": ESM -> index.js / index.d.ts, CJS -> index.cjs / index.d.cts.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  // zod queda como dependencia externa (no se empaqueta).
  external: ['zod'],
});
