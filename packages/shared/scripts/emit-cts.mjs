// Copia dist/index.d.ts -> dist/index.d.cts para la condicion `require` de `exports`.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../dist/index.d.ts', import.meta.url), new URL('../dist/index.d.cts', import.meta.url));
