import { EnrolmentEntity, EnrolmentStatusEnum } from '../../src/academics/entities/enrolment.entity';
import { TestAudienceEnum } from '../../src/exams/enums/exam-wizard.enums';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type ClassStudent = { id: string; student_id: string | null; status: string; section: { id: string; name: string } | null };
type ClassDetail = { id: string; classStudents: ClassStudent[] };
type Section = { id: string; name: string; student_count: number };
type Enrolled = { id: string; status: string; section_id: string; student_id: string | null; roll_no: string | null; outcome: string };
type Eligibility = { payload: { can_access: boolean; reason_code: string } };

/**
 * Enrolments are the class roster (P2-03 part 2a, FND-04): the class screens write them, every
 * "is this student in the class" read uses them, and sections take students directly. Nothing is
 * hard-deleted (owner decision): a removed student is LEFT and comes back on the same row.
 */
describe('enrolments API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let owner: UserEntity;
  let assistant: UserEntity;
  let teacher: UserEntity;
  let school: OrganizationEntity;
  let otherSchool: OrganizationEntity;
  let otherOwner: UserEntity;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const asAssistant = () => orgToken(assistant, school, OrganizationMemberRoleEnum.ASSISTANT);
  const asTeacher = () => orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  const newClass = async (name: string) => {
    const created = await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: name });
    expect(created.status).toBe(201);
    return created.body.payload.id;
  };
  const classDetail = async (classId: string) => (await call<Payload<ClassDetail>>('GET', `/classes/${classId}`, asOwner())).body.payload;
  const sectionsOf = async (classId: string) => (await call<Payload<Section[]>>('GET', `/classes/${classId}/sections`, asOwner())).body.payload;
  const enrolmentOf = (classId: string, studentId: string) =>
    t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ class_id: classId, student_id: studentId });
  const studentClasses = async (student: UserEntity) =>
    (await t.api.get<Payload<Array<{ id: string }>>>('/student/classes', t.tokenFor(student))).body.payload.map((c) => c.id);

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    assistant = await make.teacher({ personal_teacher_enabled: false });
    teacher = await make.teacher({ personal_teacher_enabled: false });
    otherOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    otherSchool = await make.organization(otherOwner);
    await make.member(school, assistant, OrganizationMemberRoleEnum.ASSISTANT);
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('the class screens write enrolments', () => {
    it('adds a verified student as joined in section A, shown with its section', async () => {
      const classId = await newClass('Class 6');
      const student = await make.student();
      const added = await call<{ studentResults: { added: number } }>('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] });
      expect(added.status).toBe(201);

      const [row] = (await classDetail(classId)).classStudents;
      expect(row).toMatchObject({ student_id: student.id, status: 'JOINED', section: { name: 'A' } });
      expect((await sectionsOf(classId))[0].student_count).toBe(1);
      expect(await studentClasses(student)).toContain(classId);

      // A school student also becomes a STUDENT member of the school, as before.
      const [member] = await t.dataSource.query(`SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [school.id, student.id]);
      expect(member.role).toBe('STUDENT');
    });

    it('keeps an unverified student pending until approved', async () => {
      const classId = await newClass('Class 7');
      const student = await make.student({ is_verified: false });
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] });
      expect((await classDetail(classId)).classStudents[0]).toMatchObject({ student_id: student.id, status: 'PENDING' });
      expect(await studentClasses(student)).not.toContain(classId);

      await t.dataSource.getRepository(UserEntity).update({ id: student.id }, { is_verified: true });
      const approved = await call<Payload<ClassStudent>>('POST', `/classes/${classId}/students/${student.id}/approve`, asOwner());
      expect(approved.status).toBe(201);
      expect(approved.body.payload.status).toBe('JOINED');
      expect(await studentClasses(student)).toContain(classId);
    });

    it('lets an invited student join by the class link; the invitation row becomes theirs', async () => {
      const classId = await newClass('Class 8');
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: ['invited-later@test.local'] });
      const [invitation] = (await classDetail(classId)).classStudents;
      expect(invitation).toMatchObject({ student_id: null, status: 'INVITED' });

      const student = await make.student({ email: 'invited-later@test.local' });
      const joined = await t.api.post<Payload<ClassStudent>>(`/classes/${classId}/join`, {}, t.tokenFor(student));
      expect(joined.status).toBe(201);
      expect(joined.body.payload).toMatchObject({ id: invitation.id, student_id: student.id, status: 'JOINED' });
      expect(await studentClasses(student)).toEqual([classId]);
    });

    it('turns an uninvited join into a pending request', async () => {
      const classId = await newClass('Class 9');
      const student = await make.student();
      const joined = await t.api.post<Payload<ClassStudent>>(`/classes/${classId}/join`, {}, t.tokenFor(student));
      expect(joined.body.payload).toMatchObject({ student_id: student.id, status: 'PENDING' });
      expect((await t.api.post(`/classes/${classId}/join`, {}, t.tokenFor(student))).status).toBe(400);
    });

    it('removes a student softly: LEFT with who and when, gone from the class, back on the same row when re-added', async () => {
      const classId = await newClass('Class 10');
      const student = await make.student();
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] });
      const before = await enrolmentOf(classId, student.id);

      expect((await call('DELETE', `/classes/${classId}/students`, asOwner(), { student_ids: [student.id] })).status).toBe(200);
      const left = await enrolmentOf(classId, student.id);
      expect(left).toMatchObject({ id: before.id, status: EnrolmentStatusEnum.LEFT, updated_by: owner.id });
      expect(left.left_at).toBeInstanceOf(Date);
      expect((await classDetail(classId)).classStudents).toHaveLength(0);
      expect(await studentClasses(student)).not.toContain(classId);
      expect((await t.api.get(`/student/classes/${classId}`, t.tokenFor(student))).status).toBe(403);

      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] });
      const back = await enrolmentOf(classId, student.id);
      expect(back).toMatchObject({ id: before.id, status: EnrolmentStatusEnum.ACTIVE, left_at: null });
      expect(await t.dataSource.getRepository(EnrolmentEntity).countBy({ class_id: classId })).toBe(1);
    });
  });

  describe('reads use enrolments', () => {
    it('gives class exams to active students only, in the exam session', async () => {
      const classId = await newClass('Class 11');
      const [inClass, leftClass, outsider] = [await make.student(), await make.student(), await make.student()];
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [inClass.email, leftClass.email] });
      await call('DELETE', `/classes/${classId}/students`, asOwner(), { student_ids: [leftClass.id] });

      const exam = await make.openExam(owner, { organization_id: school.id, class_id: classId, test_audience: TestAudienceEnum.SELECTED_CLASS });
      const eligibility = (student: UserEntity) => t.api.get<Eligibility>(`/student/exams/${exam.id}/eligibility`, t.tokenFor(student));
      expect((await eligibility(inClass)).body.payload.can_access).toBe(true);
      expect((await eligibility(leftClass)).body.payload.can_access).toBe(false);
      expect((await eligibility(outsider)).body.payload.can_access).toBe(false);

      const assigned = await t.api.get<Payload<Array<{ id: string }>>>('/student/exams/assigned', t.tokenFor(inClass));
      expect(assigned.body.payload.map((e) => e.id)).toContain(exam.id);
      const notAssigned = await t.api.get<Payload<Array<{ id: string }>>>('/student/exams/assigned', t.tokenFor(leftClass));
      expect(notAssigned.body.payload.map((e) => e.id)).not.toContain(exam.id);
    });

    it("drops a closed session's students from the class screens", async () => {
      const classId = await newClass('Class 12');
      const past = (await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), { name: 'Last year', start_date: '2025-01-01', end_date: '2025-12-31' })).body.payload;
      const section = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asOwner(), { name: 'Old', session_id: past.id })).body.payload;
      const student = await make.student();
      expect((await call('POST', `/sections/${section.id}/enrolments`, asOwner(), { student_id: student.id })).status).toBe(201);
      expect(await studentClasses(student)).toContain(classId);

      await call('POST', `/sessions/${past.id}/close`, asOwner());
      expect(await studentClasses(student)).not.toContain(classId);
      expect((await classDetail(classId)).classStudents).toHaveLength(0);
    });
  });

  describe('section endpoints (for the student import, P2-05)', () => {
    it('enrols a student by account, phone or email, one section per class per session', async () => {
      const classId = await newClass('Class 5');
      const [sectionA] = await sectionsOf(classId);
      const student = await make.student();

      const enrolled = await call<Payload<Enrolled>>('POST', `/sections/${sectionA.id}/enrolments`, asAssistant(), { student_id: student.id, roll_no: '7' });
      expect(enrolled.status).toBe(201);
      expect(enrolled.body.payload).toMatchObject({ outcome: 'ENROLLED', status: 'ACTIVE', roll_no: '7', section_id: sectionA.id });
      expect((await classDetail(classId)).classStudents[0]).toMatchObject({ student_id: student.id, status: 'JOINED' });

      // Same class, same session: refused even in another section.
      const sectionB = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asOwner(), { name: 'B' })).body.payload;
      expect((await call('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), { student_id: student.id })).status).toBe(409);

      const byPhone = await make.student();
      const viaPhone = await call<Payload<Enrolled>>('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), { phone: byPhone.phone });
      expect(viaPhone.body.payload).toMatchObject({ outcome: 'ENROLLED', student_id: byPhone.id, section_id: sectionB.id });

      const invite = await call<Payload<Enrolled>>('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), { email: 'new-pupil@test.local' });
      expect(invite.body.payload).toMatchObject({ outcome: 'INVITED', status: 'INVITED', student_id: null });
      expect((await call('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), { email: 'new-pupil@test.local' })).status).toBe(409);

      // Staff accounts are not students.
      expect((await call('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), { email: teacher.email })).status).toBe(400);
      expect((await call('POST', `/sections/${sectionB.id}/enrolments`, asOwner(), {})).status).toBe(400);
    });

    it('moves a student between sections of the same class, sets the roll number, and marks them LEFT', async () => {
      const classId = await newClass('Class 4');
      const [sectionA] = await sectionsOf(classId);
      const sectionB = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asOwner(), { name: 'B' })).body.payload;
      const otherClass = await newClass('Class 3');
      const [otherSection] = await sectionsOf(otherClass);
      const student = await make.student();
      const enrolment = (await call<Payload<Enrolled>>('POST', `/sections/${sectionA.id}/enrolments`, asOwner(), { student_id: student.id })).body.payload;

      const moved = await call<Payload<Enrolled>>('PATCH', `/enrolments/${enrolment.id}`, asAssistant(), { section_id: sectionB.id, roll_no: '21' });
      expect(moved.status).toBe(200);
      expect(moved.body.payload).toMatchObject({ section_id: sectionB.id, roll_no: '21' });
      expect((await call('PATCH', `/enrolments/${enrolment.id}`, asOwner(), { section_id: otherSection.id })).status).toBe(400);

      const left = await call<Payload<Enrolled>>('PATCH', `/enrolments/${enrolment.id}`, asOwner(), { status: 'LEFT' });
      expect(left.body.payload.status).toBe('LEFT');
      expect((await call('PATCH', `/enrolments/${enrolment.id}`, asOwner(), { roll_no: '1' })).status).toBe(400);
      expect((await call('PATCH', `/enrolments/${enrolment.id}`, asOwner(), { status: 'ACTIVE' })).status).toBe(400);

      // Enrolling again reuses the LEFT row.
      const again = await call<Payload<Enrolled>>('POST', `/sections/${sectionA.id}/enrolments`, asOwner(), { student_id: student.id });
      expect(again.body.payload).toMatchObject({ id: enrolment.id, status: 'ACTIVE', section_id: sectionA.id });
    });

    it('feeds the subject class roster', async () => {
      const classId = await newClass('Class 2');
      const subject = await t.dataSource.query(
        `INSERT INTO subjects (name, code, organization_id) VALUES ('Science', 'SCI-2', $1) RETURNING id`,
        [school.id],
      );
      await call('POST', `/classes/${classId}/subjects`, asOwner(), { subject_id: subject[0].id });
      const [section] = await sectionsOf(classId);
      const student = await make.student();
      await call('POST', `/sections/${section.id}/enrolments`, asOwner(), { student_id: student.id });
      const [offering] = (await call<Payload<Array<{ id: string }>>>('GET', `/sections/${section.id}/offerings`, asOwner())).body.payload;
      const roster = await call<Payload<Array<{ student_id: string }>>>('GET', `/offerings/${offering.id}/roster`, asTeacher());
      expect(roster.body.payload.map((r) => r.student_id)).toEqual([student.id]);
    });

    it('is for owners, admins and assistants of this organisation only', async () => {
      const classId = await newClass('Class 1');
      const [section] = await sectionsOf(classId);
      const student = await make.student();
      expect((await call('POST', `/sections/${section.id}/enrolments`, asTeacher(), { student_id: student.id })).status).toBe(403);
      const intruder = orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER);
      expect((await call('POST', `/sections/${section.id}/enrolments`, intruder, { student_id: student.id })).status).toBe(404);
      const enrolment = (await call<Payload<Enrolled>>('POST', `/sections/${section.id}/enrolments`, asOwner(), { student_id: student.id })).body.payload;
      expect((await call('PATCH', `/enrolments/${enrolment.id}`, intruder, { status: 'LEFT' })).status).toBe(404);
    });

    it('adds nobody to a closed session', async () => {
      const classId = await newClass('Class 0');
      const past = (await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), { name: 'Closed one', start_date: '2024-01-01', end_date: '2024-12-31' })).body.payload;
      const section = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asOwner(), { name: 'A', session_id: past.id })).body.payload;
      const student = await make.student();
      const enrolment = (await call<Payload<Enrolled>>('POST', `/sections/${section.id}/enrolments`, asOwner(), { student_id: student.id })).body.payload;
      await call('POST', `/sessions/${past.id}/close`, asOwner());
      expect((await call('POST', `/sections/${section.id}/enrolments`, asOwner(), { student_id: (await make.student()).id })).status).toBe(400);
      expect((await call('PATCH', `/enrolments/${enrolment.id}`, asOwner(), { roll_no: '3' })).status).toBe(400);
    });
  });

  it("keeps solo teachers' students out of the teacher's organisation members", async () => {
    const solo = await make.teacher();
    const created = await call<Payload<{ id: string }>>('POST', '/classes', t.tokenFor(solo), { class_name: 'Batch' });
    const [section] = (await call<Payload<Section[]>>('GET', `/classes/${created.body.payload.id}/sections`, t.tokenFor(solo))).body.payload;
    const student = await make.student();
    expect((await call('POST', `/sections/${section.id}/enrolments`, t.tokenFor(solo), { student_id: student.id })).status).toBe(201);
    const [{ members }] = await t.dataSource.query(`SELECT COUNT(*)::int AS members FROM organization_members WHERE user_id = $1`, [student.id]);
    expect(members).toBe(0);
    expect(await studentClasses(student)).toContain(created.body.payload.id);
  });
});
