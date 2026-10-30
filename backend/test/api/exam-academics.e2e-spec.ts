import { randomUUID } from 'crypto';
import { DeepPartial } from 'typeorm';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { AccountSubscriptionEntity, SubscriptionStatusEnum } from '../../src/subscriptions/entities/account-subscription.entity';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { TestAudienceEnum } from '../../src/exams/enums/exam-wizard.enums';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Eligibility = { payload: { can_access: boolean } };
const CLOSED = 'This test belongs to a closed session; the owner can reopen it';

/**
 * Tests and the academic structure (P2-03): a test can target one subject class (FND-19), and a
 * closed session's tests are read-only (FND-01).
 */
describe('tests and the academic structure', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let owner: UserEntity;
  let religionTeacher: UserEntity;
  let mathTeacher: UserEntity;
  let school: OrganizationEntity;
  let religion: SubjectEntity;
  let math: SubjectEntity;
  let classId: string;
  let religionOfferingId: string;
  let picked: UserEntity;
  let notPicked: UserEntity;

  const orgToken = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: school.id, member_role: role });
  const asOwner = () => orgToken(owner, OrganizationMemberRoleEnum.OWNER);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  /** A small wizard test for the class, optionally for one of its subject classes. */
  const wizard = (subjectId: string, selectedOfferingId?: string) => {
    const correct = randomUUID();
    return {
      formState: { testName: 'Quiz', duration: '30', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false },
      subjects: [
        {
          id: subjectId,
          questions: [
            {
              id: randomUUID(),
              type: 'graded',
              subType: 'multiple-choice',
              text: 'Pick one',
              instruction: '',
              image: null,
              answer: { type: 'optionId', value: [correct] },
              options: [
                { id: correct, text: 'A', image: null },
                { id: randomUUID(), text: 'B', image: null },
                { id: randomUUID(), text: 'C', image: null },
              ],
              points: 1,
              showValidation: false,
            },
          ],
        },
      ],
      publishState: {
        publishTiming: 'later',
        scheduleAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        endingAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        testAudience: 'selected_class',
        selectedClassId: classId,
        ...(selectedOfferingId ? { selectedOfferingId } : {}),
        excluded_students: [],
      },
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    owner = await make.teacher({ personal_teacher_enabled: false });
    religionTeacher = await make.teacher({ personal_teacher_enabled: false });
    mathTeacher = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    // Schools are on Pro (P2-02), so the Free plan's test limit does not apply.
    const pro = await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'pro' });
    await t.dataSource.getRepository(AccountSubscriptionEntity).save({
      organization_id: school.id,
      plan_id: pro.id,
      price_due: 0,
      amount_paid: 0,
      status: SubscriptionStatusEnum.ACTIVE,
      start_date: new Date(),
    } as DeepPartial<AccountSubscriptionEntity>);
    await make.member(school, religionTeacher, OrganizationMemberRoleEnum.TEACHER);
    await make.member(school, mathTeacher, OrganizationMemberRoleEnum.TEACHER);
    const subjects = t.dataSource.getRepository(SubjectEntity);
    religion = await subjects.save({ name: 'Islam Shikkha', code: 'ISL', organization_id: school.id } as DeepPartial<SubjectEntity>);
    math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: school.id } as DeepPartial<SubjectEntity>);

    classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [religion, math]) await call('POST', `/classes/${classId}/subjects`, asOwner(), { subject_id: subject.id });
    [picked, notPicked] = [await make.student(), await make.student()];
    await call('POST', `/classes/${classId}/students`, asOwner(), { students: [picked.email, notPicked.email] });

    const [section] = (await call<Payload<Array<{ id: string }>>>('GET', `/classes/${classId}/sections`, asOwner())).body.payload;
    const offerings = (await call<Payload<Array<{ id: string; subject: { id: string } }>>>('GET', `/sections/${section.id}/offerings`, asOwner()))
      .body.payload;
    religionOfferingId = offerings.find((o) => o.subject.id === religion.id)!.id;
    const mathOfferingId = offerings.find((o) => o.subject.id === math.id)!.id;
    await call('PUT', `/offerings/${religionOfferingId}/teachers`, asOwner(), { teacher_ids: [religionTeacher.id] });
    await call('PUT', `/offerings/${mathOfferingId}/teachers`, asOwner(), { teacher_ids: [mathTeacher.id] });
    // Religion is optional: only the picked student takes it.
    await call('PATCH', `/offerings/${religionOfferingId}`, asOwner(), { enrolment_mode: 'SELECTED' });
    await call('PUT', `/offerings/${religionOfferingId}/students`, asOwner(), { student_ids: [picked.id] });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('tests per subject class (FND-19)', () => {
    it('reach only the students who take the subject class', async () => {
      const exam = await make.openExam(owner, {
        organization_id: school.id,
        class_id: classId,
        offering_id: religionOfferingId,
        test_audience: TestAudienceEnum.SELECTED_CLASS,
      });
      const canSit = async (student: UserEntity) =>
        (await t.api.get<Eligibility>(`/student/exams/${exam.id}/eligibility`, t.tokenFor(student))).body.payload.can_access;
      expect(await canSit(picked)).toBe(true);
      expect(await canSit(notPicked)).toBe(false);

      const assigned = async (student: UserEntity) =>
        (await t.api.get<Payload<Array<{ id: string }>>>('/student/exams/assigned', t.tokenFor(student))).body.payload.map((e) => e.id);
      expect(await assigned(picked)).toContain(exam.id);
      expect(await assigned(notPicked)).not.toContain(exam.id);

      // A whole-class test still reaches both.
      const classExam = await make.openExam(owner, { organization_id: school.id, class_id: classId, test_audience: TestAudienceEnum.SELECTED_CLASS });
      expect(await assigned(notPicked)).toContain(classExam.id);
    });

    it('are created by a teacher of that subject class, for a subject class of the chosen class', async () => {
      const created = await t.api.post<Payload<{ id: string; publishState: { selectedOfferingId: string } }>>(
        '/exams',
        wizard(religion.id, religionOfferingId),
        orgToken(religionTeacher, OrganizationMemberRoleEnum.TEACHER),
      );
      expect(created.status).toBe(201);
      expect(created.body.payload.publishState.selectedOfferingId).toBe(religionOfferingId);
      const saved = await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: created.body.payload.id });
      expect(saved.offering_id).toBe(religionOfferingId);

      // The math teacher teaches the class, but not religion.
      const notTheirs = await t.api.post('/exams', wizard(math.id, religionOfferingId), orgToken(mathTeacher, OrganizationMemberRoleEnum.TEACHER));
      expect(notTheirs.status).toBe(403);

      // A subject class of another class is refused.
      const otherClass = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 7' })).body.payload.id;
      await call('POST', `/classes/${otherClass}/subjects`, asOwner(), { subject_id: religion.id });
      const [otherSection] = (await call<Payload<Array<{ id: string }>>>('GET', `/classes/${otherClass}/sections`, asOwner())).body.payload;
      const [otherOffering] = (await call<Payload<Array<{ id: string }>>>('GET', `/sections/${otherSection.id}/offerings`, asOwner())).body.payload;
      const wrongClass = await t.api.post<{ message: string }>(
        '/exams',
        wizard(religion.id, otherOffering.id),
        orgToken(religionTeacher, OrganizationMemberRoleEnum.TEACHER),
      );
      expect(wrongClass.status).toBe(400);
      expect(wrongClass.body.message).toBe('This subject class is not part of the selected class');
    });
  });

  describe('closed sessions (FND-01)', () => {
    it("make a session's tests read-only, but still viewable", async () => {
      // The math teacher creates (and so may edit and grade) a math test for the class.
      const asMathTeacher = orgToken(mathTeacher, OrganizationMemberRoleEnum.TEACHER);
      const created = await t.api.post<Payload<{ id: string }>>('/exams', wizard(math.id), asMathTeacher);
      expect(created.status).toBe(201);
      const examId = created.body.payload.id;
      const { session_id: sessionId } = await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: examId });

      // Close the exam's session (another session becomes the default first).
      const next = (await call<Payload<{ id: string }>>('POST', '/sessions', asOwner(), { name: 'Next', start_date: '2027-01-01', end_date: '2027-12-31', is_default: true }))
        .body.payload;
      expect(next.id).not.toBe(sessionId);
      expect((await call('POST', `/sessions/${sessionId}/close`, asOwner())).status).toBe(200);

      const refused = [
        await call<{ message: string }>('PUT', `/exams/${examId}`, asMathTeacher, wizard(math.id)),
        await call<{ message: string }>('PATCH', `/exams/${examId}/status`, asMathTeacher, { active: false }),
        await call<{ message: string }>('PATCH', `/exams/${examId}/excluded-students`, asMathTeacher, { student_ids: [] }),
        await call<{ message: string }>('POST', `/exams/grading/${examId}/publish`, asMathTeacher),
        await call<{ message: string }>('PATCH', `/exams/grading/${examId}/submissions/${randomUUID()}`, asMathTeacher, { grades: [] }),
        await call<{ message: string }>('DELETE', `/exams/${examId}`, asMathTeacher),
      ];
      for (const response of refused) {
        expect({ status: response.status, message: response.body.message }).toEqual({ status: 400, message: CLOSED });
      }
      expect((await call('GET', `/exams/${examId}`, asMathTeacher)).status).toBe(200);

      // Reopened, the test can be changed again.
      await call('POST', `/sessions/${sessionId}/reopen`, asOwner());
      expect((await call('PATCH', `/exams/${examId}/status`, asMathTeacher, { active: false })).status).toBe(200);
    });
  });
});
