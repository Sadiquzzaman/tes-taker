import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { OrganizationStatusEnum } from '../../src/organizations/enums/organization-status.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type LevelName = { en: { one: string; other: string }; bn: string };
type Labels = { preset: string; class: LevelName; section: LevelName };
type Settings = { class_teacher_enabled: boolean; default_locale: string };

const CUSTOM = {
  preset: 'CUSTOM',
  class: { en: { one: 'Programme', other: 'Programmes' }, bn: 'প্রোগ্রাম' },
  section: { en: { one: 'Group', other: 'Groups' }, bn: 'গ্রুপ' },
};

/**
 * P2-04 part 1: each workspace names its levels (FND-03) and sets the language for members who
 * have not chosen one (organizations.default_locale, FND-18).
 */
describe('level names and organisation language API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let owner: UserEntity;
  let admin: UserEntity;
  let teacher: UserEntity;
  let student: UserEntity;
  let school: OrganizationEntity;
  let otherOwner: UserEntity;
  let otherSchool: OrganizationEntity;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const asAdmin = () => orgToken(admin, school, OrganizationMemberRoleEnum.ADMIN);
  const asTeacher = () => orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER);
  const asStudent = () => orgToken(student, school, OrganizationMemberRoleEnum.STUDENT);

  const call = <T>(method: string, path: string, token?: string, body?: unknown) => t.api.request<T>(method, path, { token, body });
  const labelsFor = async (token: string) => {
    const response = await call<Payload<Labels>>('GET', '/workspace/level-labels', token);
    expect(response.status).toBe(200);
    return response.body.payload;
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    admin = await make.teacher({ personal_teacher_enabled: false });
    teacher = await make.teacher({ personal_teacher_enabled: false });
    student = await make.student();
    otherOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    otherSchool = await make.organization(otherOwner);
    await make.member(school, admin, OrganizationMemberRoleEnum.ADMIN);
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    await make.member(school, student, OrganizationMemberRoleEnum.STUDENT);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('level names (FND-03)', () => {
    it('starts as Class / Section', async () => {
      await expect(labelsFor(asTeacher())).resolves.toMatchObject({
        preset: 'CLASS_SECTION',
        class: { en: { one: 'Class', other: 'Classes' }, bn: 'ক্লাস' },
        section: { en: { one: 'Section', other: 'Sections' }, bn: 'সেকশন' },
      });
    });

    it('lets the owner choose Course / Batch, and every member sees it', async () => {
      const saved = await call<Payload<Labels>>('PATCH', '/workspace/level-labels', asOwner(), { preset: 'COURSE_BATCH' });
      expect(saved.status).toBe(200);
      expect(saved.body.payload).toMatchObject({ preset: 'COURSE_BATCH', class: { en: { one: 'Course' } }, section: { bn: 'ব্যাচ' } });

      for (const token of [asAdmin(), asTeacher(), asStudent()]) {
        await expect(labelsFor(token)).resolves.toMatchObject({ preset: 'COURSE_BATCH', section: { en: { other: 'Batches' } } });
      }
    });

    it('saves the owner\'s own words, trimmed', async () => {
      const saved = await call<Payload<Labels>>('PATCH', '/workspace/level-labels', asOwner(), {
        ...CUSTOM,
        class: { ...CUSTOM.class, en: { one: '  Programme ', other: 'Programmes' } },
      });
      expect(saved.status).toBe(200);
      await expect(labelsFor(asTeacher())).resolves.toEqual(CUSTOM);
      const row = await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ id: school.id });
      expect(row.level_labels).toEqual(CUSTOM);
    });

    it('refuses incomplete or too-long custom names', async () => {
      const missing = await call('PATCH', '/workspace/level-labels', asOwner(), { preset: 'CUSTOM', class: CUSTOM.class });
      expect(missing.status).toBe(400);
      const blank = await call('PATCH', '/workspace/level-labels', asOwner(), {
        ...CUSTOM,
        section: { en: { one: '   ', other: 'Groups' }, bn: 'গ্রুপ' },
      });
      expect(blank.status).toBe(400);
      const long = await call('PATCH', '/workspace/level-labels', asOwner(), {
        ...CUSTOM,
        section: { ...CUSTOM.section, bn: 'গ'.repeat(31) },
      });
      expect(long.status).toBe(400);
      const unknown = await call('PATCH', '/workspace/level-labels', asOwner(), { preset: 'YEAR_GROUP' });
      expect(unknown.status).toBe(400);
      await expect(labelsFor(asTeacher())).resolves.toEqual(CUSTOM);
    });

    it('lets only the owner rename levels', async () => {
      for (const token of [asAdmin(), asTeacher(), asStudent()]) {
        const response = await call('PATCH', '/workspace/level-labels', token, { preset: 'CLASS_SECTION' });
        expect(response.status).toBe(403);
      }
      await expect(labelsFor(asTeacher())).resolves.toEqual(CUSTOM);
    });

    it('keeps each organisation\'s names to itself', async () => {
      await expect(labelsFor(orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER))).resolves.toMatchObject({
        preset: 'CLASS_SECTION',
      });
      // The other school's owner cannot reach this school's workspace.
      const response = await call('PATCH', '/workspace/level-labels', orgToken(otherOwner, school, OrganizationMemberRoleEnum.OWNER), {
        preset: 'CLASS_SECTION',
      });
      expect(response.status).toBe(403);
      await expect(labelsFor(asTeacher())).resolves.toEqual(CUSTOM);
    });

    it('lets a solo teacher rename the levels of their own workspace', async () => {
      const solo = await make.teacher();
      const saved = await call<Payload<Labels>>('PATCH', '/workspace/level-labels', t.tokenFor(solo), { preset: 'COURSE_BATCH' });
      expect(saved.status).toBe(200);
      await expect(labelsFor(t.tokenFor(solo))).resolves.toMatchObject({ preset: 'COURSE_BATCH' });
      await expect(labelsFor(asTeacher())).resolves.toEqual(CUSTOM);
    });

    it('gives Class / Section to a student with no workspace', async () => {
      const loner = await make.student();
      await expect(labelsFor(t.tokenFor(loner))).resolves.toMatchObject({ preset: 'CLASS_SECTION' });
    });

    it('requires a login', async () => {
      expect((await call('GET', '/workspace/level-labels')).status).toBe(401);
    });
  });

  describe('organisation language (FND-18)', () => {
    it('starts as Bangla and can be changed by an owner or admin', async () => {
      const settings = await call<Payload<Settings>>('GET', `/organizations/${school.id}/settings`, asTeacher());
      expect(settings.body.payload.default_locale).toBe('bn');

      const saved = await call<Payload<Settings>>('PATCH', `/organizations/${school.id}/settings`, asAdmin(), { default_locale: 'en' });
      expect(saved.status).toBe(200);
      // Only the language changed; class teachers keep the school default.
      expect(saved.body.payload).toMatchObject({ default_locale: 'en', class_teacher_enabled: true });
    });

    it('refuses other languages and other roles', async () => {
      expect((await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { default_locale: 'fr' })).status).toBe(400);
      expect((await call('PATCH', `/organizations/${school.id}/settings`, asTeacher(), { default_locale: 'bn' })).status).toBe(403);
      const settings = await call<Payload<Settings>>('GET', `/organizations/${school.id}/settings`, asOwner());
      expect(settings.body.payload.default_locale).toBe('en');
    });

    it('is sent with the session when a member opens the organisation', async () => {
      const response = await call<{ payload: { locale: string | null; organization: { default_locale: string | null } } }>(
        'POST',
        '/auth/select-context',
        t.tokenFor(teacher),
        { type: 'organization', organization_id: school.id },
      );
      expect(response.status).toBe(200);
      // The member's own choice (none yet) stays separate from the organisation's language.
      expect(response.body.payload.locale).toBeNull();
      expect(response.body.payload.organization.default_locale).toBe('en');
    });

    it('is not available before the organisation is approved', async () => {
      const pendingOwner = await make.teacher({ personal_teacher_enabled: false });
      const pending = await make.organization(pendingOwner, { status: OrganizationStatusEnum.PENDING });
      const response = await call('PATCH', `/organizations/${pending.id}/settings`, orgToken(pendingOwner, pending, OrganizationMemberRoleEnum.OWNER), {
        default_locale: 'en',
      });
      expect(response.status).toBe(403);
    });
  });
});
