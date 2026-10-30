import { DeepPartial } from 'typeorm';
import { currentYearIn } from '../../src/academics/academic-sessions.service';
import { EnrolmentEntity, EnrolmentStatusEnum } from '../../src/academics/entities/enrolment.entity';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Session = { id: string; name: string; is_default: boolean; status: string; start_date: string; end_date: string };
type Section = { id: string; name: string; session_id: string; class_teacher: { id: string } | null; student_count: number };
type Offering = { id: string; subject: { id: string; name: string }; enrolment_mode: string; teachers: Array<{ id: string }> };
type RosterRow = { student_id: string };
type Enrolment = { id: string; status: string; student: { id: string } | null };

/**
 * Academic structure API (P2-03 part 1): sessions and terms (FND-01), sections and class teachers
 * (FND-02), subject classes with teachers and selected students (FND-19), and the mirror of the
 * legacy class screens into sections and enrolments (FND-04, migration M3).
 */
describe('academic structure API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let owner: UserEntity;
  let admin: UserEntity;
  let assistant: UserEntity;
  let teacherA: UserEntity;
  let teacherB: UserEntity;
  let outsider: UserEntity;
  let school: OrganizationEntity;
  let otherSchool: OrganizationEntity;
  let otherOwner: UserEntity;
  let math: SubjectEntity;
  let religion: SubjectEntity;

  const year = String(currentYearIn('Asia/Dhaka'));

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const asAdmin = () => orgToken(admin, school, OrganizationMemberRoleEnum.ADMIN);
  const asAssistant = () => orgToken(assistant, school, OrganizationMemberRoleEnum.ASSISTANT);
  const asTeacher = () => orgToken(teacherA, school, OrganizationMemberRoleEnum.TEACHER);

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  const orgSubject = (organization: OrganizationEntity, name: string, code: string) =>
    t.dataSource.getRepository(SubjectEntity).save({ name, code, organization_id: organization.id } as DeepPartial<SubjectEntity>);

  /** A school class made through the class screens, with its subjects. */
  const schoolClass = async (name: string, subjects: SubjectEntity[] = []) => {
    const created = await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: name });
    expect(created.status).toBe(201);
    for (const subject of subjects) {
      expect((await call('POST', `/classes/${created.body.payload.id}/subjects`, asOwner(), { subject_id: subject.id })).status).toBe(201);
    }
    return created.body.payload.id;
  };

  const sectionsOf = async (classId: string, token = asOwner(), query = '') => {
    const response = await call<Payload<Section[]>>('GET', `/classes/${classId}/sections${query}`, token);
    expect(response.status).toBe(200);
    return response.body.payload;
  };

  const offeringsOf = async (sectionId: string) => {
    const response = await call<Payload<Offering[]>>('GET', `/sections/${sectionId}/offerings`, asOwner());
    expect(response.status).toBe(200);
    return response.body.payload;
  };

  const sessions = async (token = asOwner()) => (await call<Payload<Session[]>>('GET', '/sessions', token)).body.payload;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    admin = await make.teacher({ personal_teacher_enabled: false });
    assistant = await make.teacher({ personal_teacher_enabled: false });
    teacherA = await make.teacher({ personal_teacher_enabled: false });
    teacherB = await make.teacher({ personal_teacher_enabled: false });
    outsider = await make.teacher({ personal_teacher_enabled: false });
    otherOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    otherSchool = await make.organization(otherOwner);
    await make.member(school, admin, OrganizationMemberRoleEnum.ADMIN);
    await make.member(school, assistant, OrganizationMemberRoleEnum.ASSISTANT);
    await make.member(school, teacherA, OrganizationMemberRoleEnum.TEACHER);
    await make.member(school, teacherB, OrganizationMemberRoleEnum.TEACHER);
    math = await orgSubject(school, 'Mathematics', 'MATH-6');
    religion = await orgSubject(school, 'Islam Shikkha', 'ISL-6');
  });

  afterAll(async () => {
    await t.close();
  });

  describe('sessions (FND-01)', () => {
    it('creates the default session on first use: this year, active', async () => {
      const list = await sessions(asTeacher());
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ name: year, is_default: true, status: 'ACTIVE', start_date: `${year}-01-01`, end_date: `${year}-12-31` });
      // A second call does not add another.
      expect(await sessions()).toHaveLength(1);
    });

    it('lets owners and admins add overlapping sessions and switch the default; teachers only read', async () => {
      const denied = await call('POST', '/sessions', asTeacher(), { name: 'Batch 2', start_date: '2027-01-01', end_date: '2027-06-30' });
      expect(denied.status).toBe(403);
      expect((await call('POST', '/sessions', asAssistant(), { name: 'Batch 2', start_date: '2027-01-01', end_date: '2027-06-30' })).status).toBe(403);

      const badDates = await call('POST', '/sessions', asAdmin(), { name: 'Backwards', start_date: '2027-06-30', end_date: '2027-01-01' });
      expect(badDates.status).toBe(400);

      const created = await call<Payload<Session>>('POST', '/sessions', asAdmin(), { name: 'Batch 2', start_date: '2027-01-01', end_date: '2027-06-30' });
      expect(created.status).toBe(201);
      expect(created.body.payload).toMatchObject({ is_default: false, status: 'ACTIVE' });

      const switched = await call<Payload<Session>>('POST', `/sessions/${created.body.payload.id}/default`, asAdmin());
      expect(switched.status).toBe(200);
      const list = await sessions();
      expect(list.filter((s) => s.is_default).map((s) => s.id)).toEqual([created.body.payload.id]);

      // Back to this year for the rest of the tests.
      const current = list.find((s) => s.name === year) as Session;
      expect((await call('POST', `/sessions/${current.id}/default`, asOwner())).status).toBe(200);
    });

    it('closes a session (not the default); only the owner reopens it', async () => {
      const list = await sessions();
      const current = list.find((s) => s.is_default) as Session;
      const other = list.find((s) => !s.is_default) as Session;

      expect((await call('POST', `/sessions/${current.id}/close`, asAdmin())).status).toBe(400);
      const closed = await call<Payload<Session>>('POST', `/sessions/${other.id}/close`, asAdmin());
      expect(closed.status).toBe(200);
      expect(closed.body.payload.status).toBe('CLOSED');

      // Closed means read-only: no renames, terms or default switch.
      expect((await call('PATCH', `/sessions/${other.id}`, asAdmin(), { name: 'Renamed' })).status).toBe(400);
      expect((await call('POST', `/sessions/${other.id}/terms`, asAdmin(), { name: 'Term 1' })).status).toBe(400);
      expect((await call('POST', `/sessions/${other.id}/default`, asAdmin())).status).toBe(400);

      expect((await call('POST', `/sessions/${other.id}/reopen`, asAdmin())).status).toBe(403);
      const reopened = await call<Payload<Session>>('POST', `/sessions/${other.id}/reopen`, asOwner());
      expect(reopened.status).toBe(200);
      expect(reopened.body.payload.status).toBe('ACTIVE');
    });

    it('manages the terms of a session', async () => {
      const current = (await sessions()).find((s) => s.is_default) as Session;
      const created = await call<Payload<{ id: string; name: string }>>('POST', `/sessions/${current.id}/terms`, asAdmin(), {
        name: 'অর্ধ বার্ষিক',
        start_date: `${year}-01-01`,
        end_date: `${year}-06-30`,
        sort_order: 1,
      });
      expect(created.status).toBe(201);
      expect((await call('POST', `/sessions/${current.id}/terms`, asTeacher(), { name: 'No' })).status).toBe(403);

      const renamed = await call<Payload<{ name: string }>>('PATCH', `/terms/${created.body.payload.id}`, asAdmin(), { name: 'Half-yearly' });
      expect(renamed.body.payload.name).toBe('Half-yearly');
      const terms = await call<Payload<Array<{ name: string }>>>('GET', `/sessions/${current.id}/terms`, asTeacher());
      expect(terms.body.payload.map((term) => term.name)).toEqual(['Half-yearly']);

      expect((await call('DELETE', `/terms/${created.body.payload.id}`, asAdmin())).status).toBe(200);
      expect((await call<Payload<unknown[]>>('GET', `/sessions/${current.id}/terms`, asAdmin())).body.payload).toHaveLength(0);
    });

    it("never shows or changes another organisation's sessions", async () => {
      const theirs = await sessions(orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER));
      expect(theirs).toHaveLength(1);
      const ours = await sessions();
      expect(ours.map((s) => s.id)).not.toContain(theirs[0].id);
      expect((await call('PATCH', `/sessions/${theirs[0].id}`, asOwner(), { name: 'Hijacked' })).status).toBe(404);
      expect((await call('POST', `/sessions/${theirs[0].id}/close`, asOwner())).status).toBe(404);
    });

    it('puts new exams in the default session', async () => {
      const exam = await make.openExam(owner, { organization_id: school.id });
      const current = (await sessions()).find((s) => s.is_default) as Session;
      expect((await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: exam.id })).session_id).toBe(current.id);
    });
  });

  describe('sections and class teachers (FND-02)', () => {
    it('gives a new class section "A" with a subject class per class subject', async () => {
      const classId = await schoolClass('Class 6', [math]);
      const [section] = await sectionsOf(classId, asTeacher());
      expect(section).toMatchObject({ name: 'A', class_teacher: null, student_count: 0 });
      expect((await offeringsOf(section.id)).map((o) => o.subject.id)).toEqual([math.id]);

      // A subject added later reaches the section too.
      await call('POST', `/classes/${classId}/subjects`, asOwner(), { subject_id: religion.id });
      expect((await offeringsOf(section.id)).map((o) => o.subject.name)).toEqual(['Islam Shikkha', 'Mathematics']);
    });

    it('adds sections with a shift, room and class teacher; one class teacher per section', async () => {
      const classId = await schoolClass('Class 9', [math]);
      const created = await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asAssistant(), {
        name: 'B',
        shift: 'MORNING',
        room: 'Room 204',
        class_teacher_id: teacherA.id,
      });
      expect(created.status).toBe(201);
      expect(created.body.payload).toMatchObject({ name: 'B', class_teacher: { id: teacherA.id } });
      expect((await offeringsOf(created.body.payload.id)).map((o) => o.subject.id)).toEqual([math.id]);

      expect((await call('POST', `/classes/${classId}/sections`, asAssistant(), { name: 'B' })).status).toBe(409);
      expect((await call('POST', `/classes/${classId}/sections`, asTeacher(), { name: 'C' })).status).toBe(403);

      // The owner's example: A is class teacher of 9-B, B of 8-A; each teaches in the other.
      const class8 = await schoolClass('Class 8', [math]);
      const [section8A] = await sectionsOf(class8);
      const updated = await call<Payload<Section>>('PATCH', `/sections/${section8A.id}`, asAdmin(), { class_teacher_id: teacherB.id });
      expect(updated.body.payload.class_teacher).toMatchObject({ id: teacherB.id });
      const [math9B] = await offeringsOf(created.body.payload.id);
      const [math8A] = await offeringsOf(section8A.id);
      await call('PUT', `/offerings/${math9B.id}/teachers`, asAdmin(), { teacher_ids: [teacherB.id] });
      await call('PUT', `/offerings/${math8A.id}/teachers`, asAdmin(), { teacher_ids: [teacherA.id] });
      expect((await offeringsOf(created.body.payload.id))[0].teachers.map((p) => p.id)).toEqual([teacherB.id]);

      // A teacher may be class teacher of several sections.
      const [section9A] = (await sectionsOf(classId)).filter((s) => s.name === 'A');
      expect((await call('PATCH', `/sections/${section9A.id}`, asAdmin(), { class_teacher_id: teacherA.id })).status).toBe(200);

      // Only teaching members of this organisation.
      expect((await call('PATCH', `/sections/${section9A.id}`, asAdmin(), { class_teacher_id: outsider.id })).status).toBe(400);
      expect((await call('PATCH', `/sections/${section9A.id}`, asAdmin(), { class_teacher_id: assistant.id })).status).toBe(400);
      // null removes the class teacher.
      const cleared = await call<Payload<Section>>('PATCH', `/sections/${section9A.id}`, asAdmin(), { class_teacher_id: null });
      expect(cleared.body.payload.class_teacher).toBeNull();
    });

    it('refuses class teachers when the organisation switched them off, and keeps the ones already set', async () => {
      const classId = await schoolClass('Class 7');
      const [section] = await sectionsOf(classId);
      await call('PATCH', `/sections/${section.id}`, asAdmin(), { class_teacher_id: teacherA.id });

      expect((await call('PATCH', `/organizations/${school.id}/settings`, asTeacher(), { class_teacher_enabled: false })).status).toBe(403);
      const off = await call<Payload<{ class_teacher_enabled: boolean }>>('PATCH', `/organizations/${school.id}/settings`, asAdmin(), {
        class_teacher_enabled: false,
      });
      expect(off.body.payload.class_teacher_enabled).toBe(false);
      expect((await call<Payload<{ class_teacher_enabled: boolean }>>('GET', `/organizations/${school.id}/settings`, asTeacher())).body.payload)
        .toMatchObject({ class_teacher_enabled: false });

      expect((await call('PATCH', `/sections/${section.id}`, asAdmin(), { class_teacher_id: teacherB.id })).status).toBe(400);
      // Turning it off keeps the saved class teacher, so turning it on again brings it back.
      expect((await sectionsOf(classId))[0].class_teacher).toMatchObject({ id: teacherA.id });

      await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { class_teacher_enabled: true });
      expect((await call('PATCH', `/sections/${section.id}`, asAdmin(), { class_teacher_id: teacherB.id })).status).toBe(200);
    });

    it('defaults class teachers off for a solo teacher', async () => {
      const solo = await make.teacher();
      const organization = await make.soloOrganization(solo);
      const settings = await call<Payload<{ class_teacher_enabled: boolean }>>('GET', `/organizations/${organization.id}/settings`, t.tokenFor(solo));
      expect(settings.body.payload.class_teacher_enabled).toBe(false);
    });

    it('keeps at least one section per class, and keeps sections that have students', async () => {
      const classId = await schoolClass('Class 10');
      const [sectionA] = await sectionsOf(classId);
      expect((await call('DELETE', `/sections/${sectionA.id}`, asAdmin())).status).toBe(400);

      const sectionB = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asAdmin(), { name: 'B' })).body.payload;
      const student = await make.student();
      expect((await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] })).status).toBe(201);
      // The new student went to section A, so A cannot go but B can.
      expect((await call('DELETE', `/sections/${sectionA.id}`, asAdmin())).status).toBe(400);
      expect((await call('DELETE', `/sections/${sectionB.id}`, asAdmin())).status).toBe(200);
    });

    it('adds nothing to a closed session', async () => {
      const classId = await schoolClass('Class 11');
      const created = await call<Payload<Session>>('POST', '/sessions', asOwner(), { name: 'Old year', start_date: '2025-01-01', end_date: '2025-12-31' });
      const old = created.body.payload;
      const section = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asAdmin(), { name: 'A', session_id: old.id })).body.payload;
      expect(section.session_id).toBe(old.id);
      expect((await sectionsOf(classId, asAdmin(), `?session_id=${old.id}`)).map((s) => s.id)).toEqual([section.id]);

      await call('POST', `/sessions/${old.id}/close`, asOwner());
      expect((await call('POST', `/classes/${classId}/sections`, asAdmin(), { name: 'B', session_id: old.id })).status).toBe(400);
      expect((await call('PATCH', `/sections/${section.id}`, asAdmin(), { room: '101' })).status).toBe(400);
      expect((await call('POST', `/sections/${section.id}/offerings`, asAdmin(), { subject_id: math.id })).status).toBe(400);
    });

    it("never reaches another organisation's classes or sections", async () => {
      const classId = await schoolClass('Class 12');
      const [section] = await sectionsOf(classId);
      const intruder = orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER);
      expect((await call('GET', `/classes/${classId}/sections`, intruder)).status).toBe(404);
      expect((await call('POST', `/classes/${classId}/sections`, intruder, { name: 'X' })).status).toBe(404);
      expect((await call('GET', `/sections/${section.id}/enrolments`, intruder)).status).toBe(404);
      expect((await call('PATCH', `/sections/${section.id}`, intruder, { name: 'X' })).status).toBe(404);
      expect((await call('GET', `/sections/${section.id}/offerings`, intruder)).status).toBe(404);
      // A subject from another organisation's catalogue cannot be taught here.
      const foreign = await orgSubject(otherSchool, 'Foreign', 'FRN-1');
      expect((await call('POST', `/sections/${section.id}/offerings`, asAdmin(), { subject_id: foreign.id })).status).toBe(404);
    });
  });

  describe('organisation-wide lists (Assignments page)', () => {
    it('lists every section and subject class of a session, scoped to the organisation', async () => {
      const classId = await schoolClass('Class 1', [math]);
      const [section] = await sectionsOf(classId);
      const [offering] = await offeringsOf(section.id);
      await call('PUT', `/offerings/${offering.id}/teachers`, asAdmin(), { teacher_ids: [teacherA.id] });

      const sections = await call<Payload<Section[]>>('GET', '/sections', asTeacher());
      expect(sections.status).toBe(200);
      expect(sections.body.payload.map((s) => s.id)).toContain(section.id);
      const offerings = await call<Payload<Array<Offering & { section_id: string }>>>('GET', `/offerings?session_id=${section.session_id}`, asTeacher());
      expect(offerings.body.payload.find((o) => o.id === offering.id)?.teachers.map((p) => p.id)).toEqual([teacherA.id]);

      // Another organisation sees none of them.
      const intruder = orgToken(otherOwner, otherSchool, OrganizationMemberRoleEnum.OWNER);
      expect((await call<Payload<Section[]>>('GET', '/sections', intruder)).body.payload.map((s) => s.id)).not.toContain(section.id);
      expect((await call<Payload<Offering[]>>('GET', '/offerings', intruder)).body.payload.map((o) => o.id)).not.toContain(offering.id);
    });
  });

  describe('subject classes (FND-19)', () => {
    it('teaches a subject to the whole section, or to selected students only', async () => {
      const classId = await schoolClass('Class 5', [math, religion]);
      const [section] = await sectionsOf(classId);
      const [ali, bina, chandra] = [await make.student(), await make.student(), await make.student()];
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [ali.email, bina.email, chandra.email] });

      const offerings = await offeringsOf(section.id);
      const mathOffering = offerings.find((o) => o.subject.id === math.id) as Offering;
      const religionOffering = offerings.find((o) => o.subject.id === religion.id) as Offering;

      const wholeRoster = await call<Payload<RosterRow[]>>('GET', `/offerings/${mathOffering.id}/roster`, asTeacher());
      expect(wholeRoster.body.payload.map((r) => r.student_id).sort()).toEqual([ali.id, bina.id, chandra.id].sort());

      // Picking students needs SELECTED mode first.
      expect((await call('PUT', `/offerings/${religionOffering.id}/students`, asAdmin(), { student_ids: [ali.id] })).status).toBe(400);
      const selected = await call<Payload<Offering & { is_optional: boolean }>>('PATCH', `/offerings/${religionOffering.id}`, asAdmin(), {
        enrolment_mode: 'SELECTED',
        is_optional: true,
      });
      expect(selected.body.payload).toMatchObject({ enrolment_mode: 'SELECTED', is_optional: true });
      expect((await call<Payload<RosterRow[]>>('GET', `/offerings/${religionOffering.id}/roster`, asAdmin())).body.payload).toHaveLength(0);

      const picked = await call<Payload<RosterRow[]>>('PUT', `/offerings/${religionOffering.id}/students`, asAssistant(), { student_ids: [ali.id, bina.id] });
      expect(picked.status).toBe(200);
      expect(picked.body.payload.map((r) => r.student_id).sort()).toEqual([ali.id, bina.id].sort());
      const repicked = await call<Payload<RosterRow[]>>('PUT', `/offerings/${religionOffering.id}/students`, asAssistant(), { student_ids: [bina.id] });
      expect(repicked.body.payload.map((r) => r.student_id)).toEqual([bina.id]);

      // Only students of this section.
      const stranger = await make.student();
      expect((await call('PUT', `/offerings/${religionOffering.id}/students`, asAdmin(), { student_ids: [stranger.id] })).status).toBe(400);
      expect((await call('PUT', `/offerings/${religionOffering.id}/students`, asTeacher(), { student_ids: [] })).status).toBe(403);
    });

    it('sets the teachers of a subject class, all equal', async () => {
      const classId = await schoolClass('Class 4', [math]);
      const [section] = await sectionsOf(classId);
      const [offering] = await offeringsOf(section.id);

      const set = await call<Payload<Offering>>('PUT', `/offerings/${offering.id}/teachers`, asAdmin(), { teacher_ids: [teacherA.id, teacherB.id] });
      expect(set.status).toBe(200);
      expect(set.body.payload.teachers.map((p) => p.id).sort()).toEqual([teacherA.id, teacherB.id].sort());
      const reduced = await call<Payload<Offering>>('PUT', `/offerings/${offering.id}/teachers`, asAdmin(), { teacher_ids: [teacherB.id] });
      expect(reduced.body.payload.teachers.map((p) => p.id)).toEqual([teacherB.id]);
      expect((await call('PUT', `/offerings/${offering.id}/teachers`, asAdmin(), { teacher_ids: [outsider.id] })).status).toBe(400);

      // A subject taught twice in one section is refused; removing and re-adding works.
      expect((await call('POST', `/sections/${section.id}/offerings`, asAdmin(), { subject_id: math.id })).status).toBe(409);
      expect((await call('DELETE', `/offerings/${offering.id}`, asAdmin())).status).toBe(200);
      expect((await call('POST', `/sections/${section.id}/offerings`, asAdmin(), { subject_id: math.id })).status).toBe(201);
    });
  });

  describe('the class screens', () => {
    it('add students straight into the default section; removing marks them LEFT and keeps the row', async () => {
      const classId = await schoolClass('Class 3');
      const [section] = await sectionsOf(classId);
      const student = await make.student();
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email, 'not-yet-registered@test.local'] });

      const enrolments = await call<Payload<Enrolment[]>>('GET', `/sections/${section.id}/enrolments`, asTeacher());
      expect(enrolments.body.payload).toHaveLength(2);
      const joined = enrolments.body.payload.find((e) => e.student?.id === student.id) as Enrolment;
      expect(joined.status).toBe(EnrolmentStatusEnum.ACTIVE);
      const invited = enrolments.body.payload.find((e) => !e.student) as Enrolment;
      expect(invited.status).toBe(EnrolmentStatusEnum.INVITED);

      expect((await call('DELETE', `/classes/${classId}/students`, asOwner(), { student_ids: [student.id] })).status).toBe(200);
      const left = await t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ id: joined.id });
      expect(left).toMatchObject({ status: EnrolmentStatusEnum.LEFT, updated_by: owner.id });
      expect(left.left_at).toBeInstanceOf(Date);
    });

    it('keeps subject classes in step with the class subjects; the class-level teacher endpoints are gone', async () => {
      const classId = await schoolClass('Class 2', [math, religion]);
      const [section] = await sectionsOf(classId);
      expect((await offeringsOf(section.id)).map((o) => o.subject.id).sort()).toEqual([math.id, religion.id].sort());

      const [religionLink] = await t.dataSource.query(`SELECT id FROM class_subjects WHERE class_id = $1 AND subject_id = $2`, [classId, religion.id]);
      expect((await call('DELETE', `/classes/${classId}/subjects/${religionLink.id}`, asOwner())).status).toBe(200);
      expect((await offeringsOf(section.id)).map((o) => o.subject.id)).toEqual([math.id]);

      // Teachers are set on subject classes only (P2-03 contract step).
      expect((await call('GET', `/classes/${classId}/teachers`, asOwner())).status).toBe(404);
      expect((await call('POST', `/classes/${classId}/teachers`, asOwner(), { teacher_id: teacherA.id })).status).toBe(404);
      expect((await call('POST', `/classes/${classId}/subjects/${religionLink.id}/teachers`, asOwner(), { teacher_id: teacherA.id })).status).toBe(404);
    });

    it('keeps a class that has student records, even of students who left', async () => {
      const classId = await schoolClass('Class 13');
      const student = await make.student();
      await call('POST', `/classes/${classId}/students`, asOwner(), { students: [student.email] });
      await call('DELETE', `/classes/${classId}/students`, asOwner(), { student_ids: [student.id] });
      const refused = await call<{ message: string }>('DELETE', `/classes/${classId}`, asOwner());
      expect(refused.status).toBe(400);
      expect(refused.body.message).toBe('This class has student records, so it cannot be deleted');

      const empty = await schoolClass('Class 14');
      expect((await call('DELETE', `/classes/${empty}`, asOwner())).status).toBe(200);
    });

    it('gives a solo teacher a section for each class they create', async () => {
      const solo = await make.teacher();
      const created = await call<Payload<{ id: string }>>('POST', '/classes', t.tokenFor(solo), { class_name: 'Physics batch' });
      const [section] = await sectionsOf(created.body.payload.id, t.tokenFor(solo));
      expect(section.name).toBe('A');
    });
  });
});
