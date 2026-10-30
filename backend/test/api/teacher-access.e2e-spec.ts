import { DeepPartial } from 'typeorm';
import { ClassService } from '../../src/classes/class.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationAccessService } from '../../src/organizations/organization-access.service';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Section = { id: string; name: string };
type Offering = { id: string; subject: { id: string } };

/**
 * Teacher access follows subject class teachers and section class teachers (P2-03 part 2b):
 * which classes a teacher sees, may open and may create tests for, and which subjects and
 * discussions are theirs. Only sections in sessions that are not closed count.
 */
describe('teacher access API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let owner: UserEntity;
  let school: OrganizationEntity;
  let math: SubjectEntity;
  let science: SubjectEntity;

  const orgToken = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: school.id, member_role: role });
  const asOwner = () => orgToken(owner, OrganizationMemberRoleEnum.OWNER);
  const asTeacher = (user: UserEntity) => orgToken(user, OrganizationMemberRoleEnum.TEACHER);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  const newTeacher = async () => {
    const user = await make.teacher({ personal_teacher_enabled: false });
    await make.member(school, user, OrganizationMemberRoleEnum.TEACHER);
    return user;
  };

  /** A class with Math and Science, its section A and their subject classes. */
  const newClass = async (name: string) => {
    const classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: name })).body.payload.id;
    for (const subject of [math, science]) await call('POST', `/classes/${classId}/subjects`, asOwner(), { subject_id: subject.id });
    const [section] = (await call<Payload<Section[]>>('GET', `/classes/${classId}/sections`, asOwner())).body.payload;
    const offerings = (await call<Payload<Offering[]>>('GET', `/sections/${section.id}/offerings`, asOwner())).body.payload;
    const offeringOf = (subject: SubjectEntity) => offerings.find((o) => o.subject.id === subject.id) as Offering;
    return { classId, section, offeringOf };
  };

  /** What the teacher can reach in the class. */
  const reach = async (teacher: UserEntity, classId: string) => {
    const token = asTeacher(teacher);
    const list = await call<Payload<Array<{ id: string }>>>('GET', '/classes', token);
    expect(list.status).toBe(200);
    const listed = list.body.payload.map((c) => c.id).includes(classId);
    const opens = (await call('GET', `/classes/${classId}`, token)).status === 200;
    const subjects = opens
      ? (await call<Payload<Array<{ subject_id: string }>>>('GET', `/classes/${classId}/subjects/assigned`, token)).body.payload.map((s) => s.subject_id).sort()
      : [];
    const discussions = opens
      ? (await call<Payload<Array<{ class_subject: { subject: { id: string } } }>>>('GET', `/classes/${classId}/discussion-subjects`, token)).body.payload
          .map((s) => s.class_subject.subject.id)
          .sort()
      : [];
    return { listed, opens, subjects, discussions };
  };
  const none = { listed: false, opens: false, subjects: [], discussions: [] };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    const subjects = t.dataSource.getRepository(SubjectEntity);
    math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: school.id } as DeepPartial<SubjectEntity>);
    science = await subjects.save({ name: 'Science', code: 'SCI', organization_id: school.id } as DeepPartial<SubjectEntity>);
  });

  afterAll(async () => {
    await t.close();
  });

  it('gives access to a teacher set on a subject class through the section API, and takes it away again', async () => {
    const { classId, offeringOf } = await newClass('Class 7');
    const teacher = await newTeacher();
    await call('PUT', `/offerings/${offeringOf(science).id}/teachers`, asOwner(), { teacher_ids: [teacher.id] });
    expect(await reach(teacher, classId)).toEqual({ listed: true, opens: true, subjects: [science.id], discussions: [science.id] });

    await call('PUT', `/offerings/${offeringOf(science).id}/teachers`, asOwner(), { teacher_ids: [] });
    expect(await reach(teacher, classId)).toEqual(none);
  });

  it("gives a section's class teacher the class but no subject they do not teach, while class teachers are on", async () => {
    const { classId, section } = await newClass('Class 9');
    const teacher = await newTeacher();
    await call('PATCH', `/sections/${section.id}`, asOwner(), { class_teacher_id: teacher.id });
    expect(await reach(teacher, classId)).toEqual({ listed: true, opens: true, subjects: [], discussions: [] });

    await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { class_teacher_enabled: false });
    expect(await reach(teacher, classId)).toEqual(none);
    await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { class_teacher_enabled: true });
    expect((await reach(teacher, classId)).opens).toBe(true);
  });

  it('counts only sections in sessions that are not closed', async () => {
    const { classId } = await newClass('Class 10');
    const past = (await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), { name: 'Old', start_date: '2025-01-01', end_date: '2025-12-31' })).body.payload;
    const oldSection = (await call<Payload<Section>>('POST', `/classes/${classId}/sections`, asOwner(), { name: 'Old', session_id: past.id })).body.payload;
    const [oldMath] = (await call<Payload<Offering[]>>('GET', `/sections/${oldSection.id}/offerings`, asOwner())).body.payload.filter(
      (o) => o.subject.id === math.id,
    );
    const teacher = await newTeacher();
    await call('PUT', `/offerings/${oldMath.id}/teachers`, asOwner(), { teacher_ids: [teacher.id] });
    expect((await reach(teacher, classId)).subjects).toEqual([math.id]);

    await call('POST', `/sessions/${past.id}/close`, asOwner());
    expect(await reach(teacher, classId)).toEqual(none);
  });

  it('decides who may create a test for the class and for a subject', async () => {
    const { classId, section, offeringOf } = await newClass('Class 11');
    const mathTeacher = await newTeacher();
    const classTeacher = await newTeacher();
    const outsider = await newTeacher();
    await call('PUT', `/offerings/${offeringOf(math).id}/teachers`, asOwner(), { teacher_ids: [mathTeacher.id] });
    await call('PATCH', `/sections/${section.id}`, asOwner(), { class_teacher_id: classTeacher.id });

    const access = t.app.get(OrganizationAccessService);
    const classes = t.app.get(ClassService);
    const mayTestSubject = (teacher: UserEntity, subject: SubjectEntity) =>
      classes.assertTeacherAssignedToClassSubject(classId, teacher.id, subject.id).then(
        () => true,
        () => false,
      );

    expect(await access.canCreateExam(mathTeacher.id, school.id, classId)).toBe(true);
    expect(await mayTestSubject(mathTeacher, math)).toBe(true);
    expect(await mayTestSubject(mathTeacher, science)).toBe(false);

    // The class teacher may set a class test, but not one for a subject they do not teach.
    expect(await access.canCreateExam(classTeacher.id, school.id, classId)).toBe(true);
    expect(await mayTestSubject(classTeacher, math)).toBe(false);

    expect(await access.canCreateExam(outsider.id, school.id, classId)).toBe(false);
  });
});
