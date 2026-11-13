/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Unitarios junto al codigo (src) + e2e con supertest (test).
  // testRegex (no testMatch): los globs de micromatch ignoran rutas con carpetas ocultas
  // (p. ej. `.claude/worktrees/...`), y testRegex no tiene ese problema.
  testRegex: '(src/.*\\.spec|test/.*\\.e2e-spec)\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  clearMocks: true,
};
