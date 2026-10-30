import { DeepPartial } from 'typeorm';
import { EnrolmentEntity, EnrolmentStatusEnum } from '../../src/academics/entities/enrolment.entity';
import { TestAudienceEnum } from '../../src/exams/enums/exam-wizard.enums';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Section = { id: string; name: string; student_count: number };
type Promotion = {
  promoted: Array<{ student_id: string }>;
  skipped: Array<{ student_id: string; reason: string }>;
};

/** FND-05 (P2-04): moving a section's students into a section of the next session. */
describe('promoting students API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let owner: UserEntity;
  let admin: UserEntity;
  let assistant: UserEntity;
  let school: OrganizationEntity;
  let otherOwner: UserEntity;
  let otherSchool: OrganizationEntity;
  let [rina, karim, nadia, tanvir]: UserEntity[] = [];

  let class6: string;
  let class7: string;
  let nextYearId: string;
  let section6: Section;
  let section7Next: Section;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const asAdmin = () => orgToken(admin, school, OrganizationMemberRoleEnum.ADMIN);
  const asAssistant = () => orgToken(assistant, school, OrganizationMemberRoleEnum.ASSISTANT);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  const rowsOf = (student: UserEntity) =>
    t.dataSource.getRepository(EnrolmentEntity).find({ where: { student_id: student.id }, order: { created_at: 'ASC' } });
  const enrolmentIn = async (sectionId: string, student: UserEntity) =>
    (await t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ section_id: sectionId, student_id: student.id })).id;
  const promote = (body: { target_section_id: string; enrolment_ids: string[] }, token = asAdmin(), from = section6.id) =>
    call<Payload<Promotion>>('POST', `/sections/${from}/promotions`, token, body);
  const sectionsOf = async (classId: string, sessionId?: string) =>
    (await call<Payload<Section[]>>('GET', `/classes/${classId}/sections${sessionId ? `?session_id=${sessionId}` : ''}`, asOwner())).body.payload;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    admin = await make.teacher({ personal_teacher_enabled: false });
    assistant = await make.teacher({ personal_teacher_enabled: false });
    otherOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    otherSchool = await make.organization(otherOwner);
    await make.member(school, admin, OrganizationMemberRoleEnum.ADMIN);
    await make.member(school, assistant, OrganizationMemberRoleEnum.ASSISTANT);

    const math = await t.dataSource
      .getRepository(SubjectEntity)
      .save({ name: 'Math', code: 'MTH', organization_id: school.id } as DeepPartial<SubjectEntity>);
    class6 = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 6' })).body.payload.id;
    class7 = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 7' })).body.payload.id;
    await call('POST', `/classes/${class6}/subjects`, asOwner(), { subject_id: math.id });
    await call('POST', `/classes/${class7}/subjects`, asOwner(), { subject_id: math.id });

    [rina, karim, nadia, tanvir] = [await make.student(), await make.student(), await make.student(), await make.student()];
    await call('POST', `/classes/${class6}/students`, asOwner(), { students: [rina.email, karim.email, nadia.email, tanvir.email] });
    [section6] = await sectionsOf(class6);

    const nextYear = new Date().getFullYear() + 1;
    nextYearId = (
      await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), {
        name: String(nextYear),
        start_date: `${nextYear}-01-01`,
        end_date: `${nextYear}-12-31`,
      })
    ).body.payload.id;
    section7Next = (await call<Payload<Section>>('POST', `/classes/${class7}/sections`, asAdmin(), { name: 'A', session_id: nextYearId })).body.payload;
  });

  afterAll(async () => {
    await t.close();
  });

  it('moves the ticked students and keeps the others where they are', async () => {
    // Rina already has a roll number this year; it does not follow her.
    await t.dataSource.getRepository(EnrolmentEntity).update({ section_id: section6.id, student_id: rina.id }, { roll_no: '7' });
    const response = await promote({
      target_section_id: section7Next.id,
      enrolment_ids: [await enrolmentIn(section6.id, rina), await enrolmentIn(section6.id, karim)],
    });
    expect(response.status).toBe(200);
    expect(response.body.payload.promoted.map((s) => s.student_id).sort()).toEqual([rina.id, karim.id].sort());
    expect(response.body.payload.skipped).toEqual([]);

    const [old, next] = await rowsOf(rina);
    expect(old).toMatchObject({ section_id: section6.id, status: EnrolmentStatusEnum.PROMOTED, roll_no: '7' });
    expect(old.left_at).not.toBeNull();
    expect(next).toMatchObject({ section_id: section7Next.id, class_id: class7, session_id: nextYearId, status: EnrolmentStatusEnum.ACTIVE, roll_no: null });

    // Nadia and Tanvir were not ticked (held back or leaving).
    expect((await rowsOf(nadia)).map((r) => r.status)).toEqual([EnrolmentStatusEnum.ACTIVE]);
    expect((await sectionsOf(class6))[0].student_count).toBe(2);
    expect((await sectionsOf(class7, nextYearId))[0].student_count).toBe(2);
  });

  it('keeps the old year viewable: the section lists promoted students, and they keep its tests', async () => {
    const roster = await call<Payload<Array<{ student: { id: string } | null; status: string }>>>('GET', `/sections/${section6.id}/enrolments`, asOwner());
    expect(roster.body.payload.find((row) => row.student?.id === rina.id)?.status).toBe('PROMOTED');

    // A test of Class 6 in this year's session.
    const exam = await make.openExam(owner, { organization_id: school.id, class_id: class6, test_audience: TestAudienceEnum.SELECTED_CLASS });
    const eligibility = await t.api.get<{ payload: { can_access: boolean } }>(`/student/exams/${exam.id}/eligibility`, t.tokenFor(rina));
    expect(eligibility.body.payload.can_access).toBe(true);
    const assigned = await t.api.get<Payload<Array<{ id: string }>>>('/student/exams/assigned', t.tokenFor(rina));
    expect(assigned.body.payload.map((e) => e.id)).toContain(exam.id);
    const upcoming = await t.api.get<Payload<Array<{ id: string }>>>('/student/exams/upcoming?include_past=true', t.tokenFor(rina));
    expect(upcoming.body.payload.map((e) => e.id)).toContain(exam.id);
    const ofClass = await t.api.get<Payload<Array<{ id: string }>>>(`/student/exams/class/${class6}`, t.tokenFor(rina));
    expect(ofClass.body.payload.map((e) => e.id)).toContain(exam.id);

    // A student who simply left does not keep it.
    await call('PATCH', `/enrolments/${await enrolmentIn(section6.id, tanvir)}`, asAdmin(), { status: 'LEFT' });
    const left = await t.api.get<{ payload: { can_access: boolean } }>(`/student/exams/${exam.id}/eligibility`, t.tokenFor(tanvir));
    expect(left.body.payload.can_access).toBe(false);
  });

  it('skips students already in the target class, so a second run changes nothing', async () => {
    // Nadia was put in Class 7 for next year by hand already.
    expect((await call('POST', `/sections/${section7Next.id}/enrolments`, asAdmin(), { student_id: nadia.id })).status).toBe(201);
    const response = await promote({ target_section_id: section7Next.id, enrolment_ids: [await enrolmentIn(section6.id, nadia)] });
    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual({ promoted: [], skipped: [{ student_id: nadia.id, full_name: nadia.full_name, reason: 'ALREADY_ENROLLED' }] });
    expect((await rowsOf(nadia)).map((r) => r.status)).toEqual([EnrolmentStatusEnum.ACTIVE, EnrolmentStatusEnum.ACTIVE]);

    // Promoting Rina again: her old row is PROMOTED now, not active.
    const again = await promote({ target_section_id: section7Next.id, enrolment_ids: [await enrolmentIn(section6.id, rina)] });
    expect(again.status).toBe(400);
    expect(await rowsOf(rina)).toHaveLength(2);
  });

  it('brings back a student who had left the target class that year', async () => {
    const student = await make.student();
    await call('POST', `/classes/${class6}/students`, asOwner(), { students: [student.email] });
    expect((await call('POST', `/sections/${section7Next.id}/enrolments`, asAdmin(), { student_id: student.id })).status).toBe(201);
    const earlier = await enrolmentIn(section7Next.id, student);
    await call('PATCH', `/enrolments/${earlier}`, asAdmin(), { status: 'LEFT' });

    const response = await promote({ target_section_id: section7Next.id, enrolment_ids: [await enrolmentIn(section6.id, student)] });
    expect(response.body.payload.promoted).toHaveLength(1);
    const next = await t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ id: earlier });
    expect(next).toMatchObject({ status: EnrolmentStatusEnum.ACTIVE, left_at: null });
  });

  it('refuses a target in the same session, a closed session, or another school', async () => {
    const student = await make.student();
    await call('POST', `/classes/${class6}/students`, asOwner(), { students: [student.email] });
    const enrolmentId = await enrolmentIn(section6.id, student);

    const [section7ThisYear] = await sectionsOf(class7);
    expect((await promote({ target_section_id: section7ThisYear.id, enrolment_ids: [enrolmentId] })).status).toBe(400);

    const closedYear = (
      await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), { name: 'Old', start_date: '2020-01-01', end_date: '2020-12-31' })
    ).body.payload.id;
    const closedSection = (await call<Payload<Section>>('POST', `/classes/${class7}/sections`, asAdmin(), { name: 'A', session_id: closedYear }))
      .body.payload;
    await call('POST', `/sessions/${closedYear}/close`, asOwner());
    expect((await promote({ target_section_id: closedSection.id, enrolment_ids: [enrolmentId] })).status).toBe(400);

    const otherClass = (
      await call<Payload<{ id: string }>>('POST', '/classes', orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER), { class_name: 'Class 7' })
    ).body.payload.id;
    const [otherSection] = (
      await call<Payload<Section[]>>('GET', `/classes/${otherClass}/sections`, orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER))
    ).body.payload;
    expect((await promote({ target_section_id: otherSection.id, enrolment_ids: [enrolmentId] })).status).toBe(404);
    // ...and the other school cannot promote out of this one.
    const fromOther = await promote(
      { target_section_id: otherSection.id, enrolment_ids: [enrolmentId] },
      orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER),
    );
    expect(fromOther.status).toBe(404);

    expect((await rowsOf(student)).map((r) => r.status)).toEqual([EnrolmentStatusEnum.ACTIVE]);
  });

  it('refuses students of another section, an empty list, and staff other than owners and admins', async () => {
    const student = await make.student();
    await call('POST', `/classes/${class7}/students`, asOwner(), { students: [student.email] });
    const [section7ThisYear] = await sectionsOf(class7);
    const elsewhere = await enrolmentIn(section7ThisYear.id, student);
    expect((await promote({ target_section_id: section7Next.id, enrolment_ids: [elsewhere] })).status).toBe(400);
    expect((await promote({ target_section_id: section7Next.id, enrolment_ids: [] })).status).toBe(400);

    const own = await make.student();
    await call('POST', `/classes/${class6}/students`, asOwner(), { students: [own.email] });
    const body = { target_section_id: section7Next.id, enrolment_ids: [await enrolmentIn(section6.id, own)] };
    expect((await promote(body, asAssistant())).status).toBe(403);
    expect((await promote(body, asOwner())).status).toBe(200);
  });
});
