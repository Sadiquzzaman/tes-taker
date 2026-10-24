import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** FND-18: each user's language is saved on the account and returned with their profile. */
describe('user language API', () => {
  let t: TestApp;
  let student: UserEntity;

  beforeAll(async () => {
    t = await createTestApp();
    student = await factories(t.dataSource).student();
  });

  afterAll(async () => {
    await t.close();
  });

  const setLocale = (locale: unknown, token?: string) => t.api.request('PATCH', '/user/me/locale', { body: { locale }, token });
  const profileLocale = async () =>
    (await t.api.get<{ payload: { locale: string | null } }>('/auth/profile', t.tokenFor(student))).body.payload.locale;

  it('starts with no language chosen', async () => {
    await expect(profileLocale()).resolves.toBeNull();
  });

  it('saves Bangla, then English, for the logged-in user', async () => {
    await expect(setLocale('bn', t.tokenFor(student))).resolves.toMatchObject({ status: 200, body: { payload: { locale: 'bn' } } });
    await expect(profileLocale()).resolves.toBe('bn');

    await setLocale('en', t.tokenFor(student));
    await expect(profileLocale()).resolves.toBe('en');
  });

  it('refuses an unsupported language', async () => {
    await expect(setLocale('fr', t.tokenFor(student))).resolves.toMatchObject({ status: 400 });
    await expect(profileLocale()).resolves.toBe('en');
  });

  it('requires a login', async () => {
    await expect(setLocale('bn')).resolves.toMatchObject({ status: 401 });
  });

  it('is protected by a database check as well', async () => {
    await expect(t.dataSource.query(`UPDATE users SET locale = 'xx' WHERE id = $1`, [student.id])).rejects.toThrow(
      /CHK_users_locale/,
    );
  });
});
