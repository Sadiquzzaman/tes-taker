import { writeFileSync } from 'fs';
import { buildSwaggerDocument } from '../../src/common/swagger/swagger.setup';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * The API description for the mobile app (PM-05). Swagger is off on beta and production, so the
 * document is exported to docs/mobile/openapi.json: `pnpm openapi:export` (sets OPENAPI_OUT).
 */
describe('OpenAPI document', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('describes the API, including sign-in, devices and the version check', () => {
    const document = buildSwaggerDocument(t.app);
    const paths = Object.keys(document.paths);
    expect(paths).toEqual(expect.arrayContaining(['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/sessions', '/api/v1/app/version']));
    if (process.env.OPENAPI_OUT) {
      // Stable output: paths sorted, so the file only changes when the API does.
      const sorted = { ...document, paths: Object.fromEntries(Object.entries(document.paths).sort(([a], [b]) => a.localeCompare(b))) };
      writeFileSync(process.env.OPENAPI_OUT, `${JSON.stringify(sorted, null, 2)}\n`);
    }
  });
});
