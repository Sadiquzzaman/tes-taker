import { IsNull } from 'typeorm';
import { EnrolmentEntity } from '../../src/academics/entities/enrolment.entity';
import { GuardianEntity } from '../../src/academics/entities/guardian.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { GuardiansService } from '../../src/academics/guardians.service';
import { AuditService } from '../../src/audit/audit.service';
import { Guardians1755600000000 } from '../../src/migrations/1755600000000-Guardians';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Guardian = { id: string; name: string; relation: string; phone: string; is_primary: boolean };
type Guardians = { guardians: Guardian[]; sms_locale: string | null; organization_sms_locale: string };
type Section = { id: string };

// Synthetic numbers only (no real people).
const FATHER = { name: 'Test Father', relation: 'FATHER', phone: '01700000001' };
const MOTHER = { name: 'Test Mother', relation: 'MOTHER', phone: '01800000002' };

/**
 * Guardians (P2-05, FND-09) and the guardian SMS language (FND-10): up to 2 per student, one primary,
 * Bangladeshi mobile numbers, changed by staff and the student's teachers only, never hard-deleted,
 * every change audited; invited students keep the guardians entered before they joined.
 */
describe('guardians API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;

  let owner: UserEntity;
  let assistant: UserEntity;
  let school: OrganizationEntity;
  let otherOwner: UserEntity;
  let otherSchool: OrganizationEntity;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });
  const getGuardians = (enrolmentId: string, token = asOwner()) => call<Payload<Guardians>>('GET', `/enrolments/${enrolmentId}/guardians`, token);
  const save = (enrolmentId: string, body: unknown, token = asOwner()) => call<Payload<Guardians>>('PUT', `/enrolments/${enrolmentId}/guardians`, token, body);

  /** A class of the school with section A; returns the class and that section. */
  const newClass = async (name: string) => {
    const classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: name })).body.payload.id;
    const [section] = (await call<Payload<Section[]>>('GET', `/classes/${classId}/sections`, asOwner())).body.payload;
    return { classId, section };
  };
  const enrolled = async (name: string) => {
    const { classId, section } = await newClass(name);
    const student = await make.student();
    const enrolment = await make.enrol({ id: classId }, student);
    return { classId, section, student, enrolment };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    owner = await make.teacher({ personal_teacher_enabled: false });
    assistant = await make.teacher({ personal_teacher_enabled: false });
    otherOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    otherSchool = await make.organization(otherOwner);
    await make.member(school, assistant, OrganizationMemberRoleEnum.ASSISTANT);
  });

  afterAll(async () => {
    await t.close();
  });

  it('saves up to 2 guardians with one primary (the first when none is marked) and audits each one', async () => {
    const { enrolment } = await enrolled('Class 1');
    expect((await getGuardians(enrolment.id)).body.payload).toEqual({ guardians: [], sms_locale: null, organization_sms_locale: 'bn' });

    const saved = await save(enrolment.id, { guardians: [FATHER, { ...MOTHER, phone: '+880 1800-000002' }] });
    expect(saved.status).toBe(200);
    expect(saved.body.payload.guardians).toEqual([
      expect.objectContaining({ ...FATHER, is_primary: true }),
      expect.objectContaining({ ...MOTHER, is_primary: false }),
    ]);

    await audit.flush();
    const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: school.id, action: 'guardian.create' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ actor_id: owner.id, entity_type: 'guardian' });
  });

  it('rejects a third guardian, a non-Bangladeshi number, the same number twice and two primaries', async () => {
    const { enrolment } = await enrolled('Class 2');
    const third = { name: 'Test Other', relation: 'OTHER', phone: '01900000003' };
    expect((await save(enrolment.id, { guardians: [FATHER, MOTHER, third] })).status).toBe(400);
    expect((await save(enrolment.id, { guardians: [{ ...FATHER, phone: '0170000000' }] })).status).toBe(400);
    expect((await save(enrolment.id, { guardians: [{ ...FATHER, phone: '01200000001' }] })).status).toBe(400);
    expect((await save(enrolment.id, { guardians: [FATHER, { ...MOTHER, phone: FATHER.phone }] })).status).toBe(400);
    expect((await save(enrolment.id, { guardians: [{ ...FATHER, is_primary: true }, { ...MOTHER, is_primary: true }] })).status).toBe(400);
    expect((await save(enrolment.id, { guardians: [{ ...FATHER, relation: 'UNCLE' }] })).status).toBe(400);
    expect(await t.dataSource.getRepository(GuardianEntity).countBy({ enrolment_id: enrolment.id })).toBe(0);
  });

  it('changes and removes guardians softly: the removed row stays with who and when, and its number can be used again', async () => {
    const { enrolment } = await enrolled('Class 3');
    const [father, mother] = (await save(enrolment.id, { guardians: [FATHER, MOTHER] })).body.payload.guardians;

    // Mother becomes primary with a new number; father is removed.
    const changed = await save(enrolment.id, { guardians: [{ ...MOTHER, id: mother.id, phone: '01800000009', is_primary: true }] });
    expect(changed.status).toBe(200);
    expect(changed.body.payload.guardians).toEqual([{ ...MOTHER, id: mother.id, phone: '01800000009', is_primary: true }]);

    const removed = await t.dataSource.getRepository(GuardianEntity).findOneByOrFail({ id: father.id });
    expect(removed).toMatchObject({ deleted_by: owner.id, is_primary: false });
    expect(removed.deleted_at).toBeInstanceOf(Date);

    // The removed father's number can be added again (as a new row).
    const again = await save(enrolment.id, { guardians: [{ ...MOTHER, id: mother.id, phone: '01800000009', is_primary: true }, FATHER] });
    expect(again.status).toBe(200);
    expect(again.body.payload.guardians.map((g) => g.id)).not.toContain(father.id);

    await audit.flush();
    const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: school.id, entity_id: mother.id } });
    const update = logs.find((log) => log.action === 'guardian.update');
    expect(update).toMatchObject({ before: { phone: MOTHER.phone, is_primary: false }, after: { phone: '01800000009', is_primary: true } });
    const deletes = await t.dataSource.getRepository(AuditLogEntity).find({ where: { entity_id: father.id, action: 'guardian.delete' } });
    expect(deletes).toHaveLength(1);
  });

  it("keeps the student's SMS language on both guardians; the organisation's defaults to its language and can be changed", async () => {
    const { enrolment, student } = await enrolled('Class 4');
    await save(enrolment.id, { guardians: [FATHER, MOTHER], sms_locale: 'en' });
    const rows = await t.dataSource.getRepository(GuardianEntity).findBy({ student_id: student.id, deleted_at: IsNull() });
    expect(rows.map((row) => row.sms_locale)).toEqual(['en', 'en']);
    // Saving without sms_locale keeps it.
    expect((await save(enrolment.id, { guardians: [FATHER, MOTHER] })).body.payload.sms_locale).toBe('en');

    const settings = await call<Payload<{ sms_locale: string }>>('PATCH', `/organizations/${school.id}/settings`, asOwner(), { sms_locale: 'en' });
    expect(settings.body.payload.sms_locale).toBe('en');
    expect((await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { sms_locale: 'fr' })).status).toBe(400);

    // The student follows the organisation again: senders get the organisation's language.
    await save(enrolment.id, { guardians: [FATHER], sms_locale: null });
    await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { sms_locale: 'bn' });
    const contacts = await t.app.get(GuardiansService).contactsForStudent(school.id, student.id);
    expect(contacts).toEqual([expect.objectContaining({ ...FATHER, is_primary: true, locale: 'bn' })]);
  });

  it("is open to owners, admins, assistants and the student's teachers only", async () => {
    const { enrolment, section } = await enrolled('Class 5');
    expect((await save(enrolment.id, { guardians: [FATHER] }, orgToken(assistant, school, OrganizationMemberRoleEnum.ASSISTANT))).status).toBe(200);

    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    const asTeacher = orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER);
    expect((await getGuardians(enrolment.id, asTeacher)).status).toBe(403);

    // A class teacher of the student's section may.
    expect((await call('PATCH', `/sections/${section.id}`, asOwner(), { class_teacher_id: teacher.id })).status).toBe(200);
    expect((await getGuardians(enrolment.id, asTeacher)).body.payload.guardians).toHaveLength(1);
    expect((await save(enrolment.id, { guardians: [FATHER, MOTHER] }, asTeacher)).status).toBe(200);

    // Students never; another organisation does not see the enrolment.
    const student = await t.dataSource.getRepository(UserEntity).findOneByOrFail({ id: enrolment.student_id as string });
    expect((await getGuardians(enrolment.id, t.tokenFor(student))).status).toBe(403);
    expect((await getGuardians(enrolment.id, orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER))).status).toBe(404);
  });

  it('shares guardians across the enrolments of the same student in the organisation', async () => {
    const { enrolment, student } = await enrolled('Class 6');
    await save(enrolment.id, { guardians: [FATHER] });
    const { classId } = await newClass('Class 6 Science');
    const second = await make.enrol({ id: classId }, student);
    expect((await getGuardians(second.id)).body.payload.guardians).toEqual([expect.objectContaining(FATHER)]);
  });

  it('keeps the guardians entered on an invitation when the student joins', async () => {
    const { classId, section } = await newClass('Class 7');
    const invited = await call<Payload<{ id: string; outcome: string }>>('POST', `/sections/${section.id}/enrolments`, asOwner(), { email: 'guardian-invitee@test.local' });
    expect(invited.body.payload.outcome).toBe('INVITED');
    expect((await save(invited.body.payload.id, { guardians: [FATHER, MOTHER] })).status).toBe(200);

    const student = await make.student({ email: 'guardian-invitee@test.local' });
    expect((await t.api.post(`/classes/${classId}/join`, {}, t.tokenFor(student))).status).toBe(201);

    const rows = await t.dataSource.getRepository(GuardianEntity).find({ where: { enrolment_id: invited.body.payload.id, deleted_at: IsNull() } });
    expect(rows.map((row) => row.student_id)).toEqual([student.id, student.id]);
    const claimed = await t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ class_id: classId, student_id: student.id });
    expect((await getGuardians(claimed.id)).body.payload.guardians.map((g) => g.phone).sort()).toEqual([FATHER.phone, MOTHER.phone]);
  });

  it("keeps the student's own guardians when an invitation with other guardians is claimed", async () => {
    const { enrolment, student } = await enrolled('Class 8');
    await save(enrolment.id, { guardians: [FATHER] });

    const { classId, section } = await newClass('Class 9');
    await t.dataSource.getRepository(UserEntity).update({ id: student.id }, { email: 'known-student@test.local' });
    const { session_id } = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ id: section.id });
    const invitation = await t.dataSource.getRepository(EnrolmentEntity).save({
      organization_id: school.id,
      session_id,
      class_id: classId,
      section_id: section.id,
      student_id: null,
      status: 'INVITED',
      invited_email: 'known-student@test.local',
    } as Partial<EnrolmentEntity>);
    expect((await save(invitation.id, { guardians: [MOTHER] })).status).toBe(200);

    expect((await t.api.post(`/classes/${classId}/join`, {}, t.tokenFor(student))).status).toBe(201);
    const invitationGuardian = await t.dataSource.getRepository(GuardianEntity).findOneByOrFail({ enrolment_id: invitation.id });
    expect(invitationGuardian.deleted_at).toBeInstanceOf(Date);
    expect((await getGuardians(enrolment.id)).body.payload.guardians).toEqual([expect.objectContaining(FATHER)]);
  });

  it('migration: a second run changes nothing and keeps the guardians', async () => {
    const before = await t.dataSource.getRepository(GuardianEntity).count();
    expect(before).toBeGreaterThan(0);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const runner = t.dataSource.createQueryRunner();
    try {
      await new Guardians1755600000000().up(runner);
    } finally {
      await runner.release();
    }
    expect(await t.dataSource.getRepository(GuardianEntity).count()).toBe(before);
  });
});
