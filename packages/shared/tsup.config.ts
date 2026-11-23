import { defineConfig } from 'tsup';

// El package.json es "type": "module": ESM -> index.js / index.d.ts, CJS -> index.cjs / index.d.cts.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Los .d.ts los emite tsc (tsconfig.build.json): rollup-plugin-dts exige la API de TypeScript 6 y el monorepo hoistea TS 7.
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  // zod queda como dependencia externa (no se empaqueta).
  external: ['zod'],
});
