/**
 * API tests (*.e2e-spec.ts): the real AppModule against the throwaway databases in
 * docker-compose.test.yml. Run with `make test-api` (starts the databases) or
 * `pnpm test:e2e` when they are already up.
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // Load test/test.env in every test file, before the app modules are imported.
  setupFiles: ['<rootDir>/test/support/load-env.ts'],
  // Fresh schema from the real migrations, once per run.
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  // The test files share one database, so they run one at a time.
  maxWorkers: 1,
  testTimeout: 60000,
};
