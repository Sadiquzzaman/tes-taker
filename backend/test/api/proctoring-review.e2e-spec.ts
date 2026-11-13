import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ExamAttemptReviewEntity } from '../../src/exams/entities/exam-attempt-review.entity';
import { ExamQuestionEntity, QuestionTypeEnum } from '../../src/exams/entities/exam-question.entity';
import { ProctoringEventSourceEnum } from '../../src/exams/entities/proctoring-event.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamAnswerEntity,
  StudentExamSubmissionEntity,
} from '../../src/exams/entities/student-exam-answer.entity';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { ProctoringEventsService } from '../../src/exams/proctoring-events.service';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Report = {
  summary: { students: number; flagged: number; disqualified: number; reviewed: number };
  by_check: { check: string; count: number; students: number }[];
  students: { student_id: string; flags: number; status: string; checks: { check: string; count: number }[]; last_review: { decision: string } | null }[];
};

/**
 * The integrity report and attempt review (P8-04, PRO-04, PRO-05): flags by check and by student,
 * one student's report, and the teacher's decision on a finished attempt: reinstate, retake or
 * confirm, recorded with the reason, audited and sent to the student.
 */
describe('integrity report and attempt review', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  /** A school: the exam's teacher, another teacher, and two students who finished the exam (one disqualified). */
  const school = async (examOverrides: DeepPartial<ExamEntity> = {}) => {
    const owner = await make.teacher();
    const organization = await make.organization(owner);
    const [teacher, other] = [await make.teacher(), await make.teacher()];
    for (const user of [teacher, other]) await make.member(organization, user, OrganizationMemberRoleEnum.TEACHER);
    const orgToken = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const exam = await make.openExam(teacher, { organization_id: organization.id, test_name: 'Physics', ...examOverrides });
    const question = await t.dataSource.getRepository(ExamQuestionEntity).save({
      exam: { id: exam.id },
      question: 'Explain gravity.',
      question_type: QuestionTypeEnum.SUBJECTIVE,
      points: 10,
    } as DeepPartial<ExamQuestionEntity>);
    const [flagged, clean] = [await make.student(), await make.student()];
    const submissions = t.dataSource.getRepository(StudentExamSubmissionEntity);
    const flaggedAttempt = await submissions.save({
      exam_id: exam.id,
      student_id: flagged.id,
      status: ExamSubmissionStatusEnum.DISQUALIFIED,
      started_at: new Date(Date.now() - 20 * 60_000),
      submitted_at: new Date(),
      total_score: 4,
      max_score: 10,
      disqualification_reason: 'Ended by the teacher: Phone on the desk',
    } as Partial<StudentExamSubmissionEntity>);
    await t.dataSource.getRepository(StudentExamAnswerEntity).save({
      submission_id: flaggedAttempt.id,
      question_id: question.id,
      text_answer: 'Things fall down.',
      marks_obtained: 4,
    } as Partial<StudentExamAnswerEntity>);
    await submissions.save({ exam_id: exam.id, student_id: clean.id, status: ExamSubmissionStatusEnum.SUBMITTED, total_score: 9, max_score: 10 } as Partial<StudentExamSubmissionEntity>);
    const now = Date.now();
    await t.app.get(ProctoringEventsService).record({ id: exam.id, organization_id: organization.id }, flagged.id, ProctoringEventSourceEnum.LIVE, [
      { client_id: 'f1', type: 'phone-detected', message: 'Phone', points: 3, occurred_at: new Date(now - 3000) },
      { client_id: 'f2', type: 'phone-detected', message: 'Phone', points: 3, occurred_at: new Date(now - 2000) },
      { client_id: 'f3', type: 'tab-switch', message: 'Left the tab', points: 1, occurred_at: new Date(now - 1000) },
    ]);
    await t.app.get(ProctoringEventsService).recordServerEvent(exam.id, flagged.id, 'teacher-ended', 'Phone on the desk');
    return {
      exam,
      flagged,
      clean,
      flaggedAttempt,
      teacher,
      teacherToken: orgToken(teacher, OrganizationMemberRoleEnum.TEACHER),
      ownerToken: orgToken(owner, OrganizationMemberRoleEnum.OWNER),
      otherToken: orgToken(other, OrganizationMemberRoleEnum.TEACHER),
      studentToken: orgToken(flagged, OrganizationMemberRoleEnum.STUDENT),
    };
  };
  const review = (s: { exam: ExamEntity; flagged: UserEntity }, token: string, decision: string, reason = 'Checked with the student.') =>
    t.api.post<{ payload: { status: string; decision: string }; code?: string }>(`/exams/${s.exam.id}/proctoring/students/${s.flagged.id}/review`, { decision, reason }, token);
  const attemptOf = (s: { exam: ExamEntity; flagged: UserEntity }) =>
    t.dataSource.getRepository(StudentExamSubmissionEntity).findOneByOrFail({ exam_id: s.exam.id, student_id: s.flagged.id });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  it('reports flags by check and the most flagged students first, to the exam’s teacher and the owner only', async () => {
    const s = await school();
    for (const token of [s.teacherToken, s.ownerToken]) {
      const res = await t.api.get<{ payload: Report }>(`/exams/${s.exam.id}/proctoring/integrity`, token);
      expect(res.status).toBe(200);
      expect(res.body.payload.summary).toEqual({ students: 2, flagged: 1, disqualified: 1, reviewed: 0 });
      expect(res.body.payload.by_check).toEqual([
        { check: 'proctoring_phone', count: 2, students: 1 },
        { check: 'proctoring_tab_switch', count: 1, students: 1 },
      ]);
      // Server events (the teacher ending the exam) are not flags.
      expect(res.body.payload.students.map((row) => [row.student_id, row.flags, row.status])).toEqual([
        [s.flagged.id, 3, 'DISQUALIFIED'],
        [s.clean.id, 0, 'SUBMITTED'],
      ]);
    }
    expect((await t.api.get(`/exams/${s.exam.id}/proctoring/integrity`, s.otherToken)).status).toBe(403);
    expect((await t.api.get(`/exams/${s.exam.id}/proctoring/integrity`, s.studentToken)).status).toBe(403);

    const one = await t.api.get<{ payload: { attempt: { status: string; total_score: number }; checks: unknown[]; timeline: { type: string }[] } }>(
      `/exams/${s.exam.id}/proctoring/students/${s.flagged.id}/report`,
      s.teacherToken,
    );
    expect(one.body.payload.attempt).toMatchObject({ status: 'DISQUALIFIED', total_score: 4 });
    expect(one.body.payload.checks).toEqual([
      { check: 'proctoring_phone', count: 2 },
      { check: 'proctoring_tab_switch', count: 1 },
    ]);
    expect(one.body.payload.timeline.map((e) => e.type)).toEqual(['phone-detected', 'phone-detected', 'tab-switch', 'teacher-ended']);
    expect((await t.api.get(`/exams/${s.exam.id}/proctoring/students/${s.flagged.id}/report`, s.otherToken)).status).toBe(403);
  });

  it('reinstates a disqualified attempt with a reason: recorded, audited and the student is told', async () => {
    const s = await school();
    const res = await review(s, s.teacherToken, 'REINSTATE', ' The phone was a calculator. ');
    expect([res.status, res.body.payload.status]).toEqual([200, 'SUBMITTED']);
    expect(await attemptOf(s)).toMatchObject({ status: 'SUBMITTED', disqualification_reason: null });
    const [row] = await t.dataSource.getRepository(ExamAttemptReviewEntity).findBy({ exam_id: s.exam.id, student_id: s.flagged.id });
    expect(row).toMatchObject({ decision: 'REINSTATE', reason: 'The phone was a calculator.', previous_status: 'DISQUALIFIED', previous_score: '4.00', decided_by: s.teacher.id });

    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).findOneBy({ entity_id: s.exam.id, action: 'exam.attempt_review' })).toMatchObject({
      after: expect.objectContaining({ decision: 'REINSTATE', status: 'SUBMITTED', student_id: s.flagged.id }),
    });
    const inbox = await t.dataSource.getRepository(NotificationOutboxEntity).findBy({ event_type: 'exam.review_decided', recipient_id: s.flagged.id });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].payload).toMatchObject({ exam_name: 'Physics', decision: 'REINSTATE', path: `/tests/${s.exam.id}/results` });

    // Now submitted: it cannot be reinstated again, but the result can be confirmed.
    const again = await review(s, s.teacherToken, 'REINSTATE');
    expect([again.status, again.body.code]).toEqual([409, 'EXAM_ATTEMPT_NOT_DISQUALIFIED']);
    const confirmed = await review(s, s.ownerToken, 'CONFIRM');
    expect([confirmed.status, confirmed.body.payload.status]).toEqual([200, 'SUBMITTED']);
    const report = await t.api.get<{ payload: Report }>(`/exams/${s.exam.id}/proctoring/integrity`, s.teacherToken);
    expect(report.body.payload.summary).toMatchObject({ disqualified: 0, reviewed: 1 });
    expect(report.body.payload.students[0].last_review).toMatchObject({ decision: 'CONFIRM' });
    expect((await review(s, s.otherToken, 'CONFIRM')).status).toBe(403);
  });

  it('opens a retake: the old answers and score are kept in the review, the student starts again with a fresh clock', async () => {
    const s = await school();
    const res = await review(s, s.teacherToken, 'RETAKE', 'Network dropped; let them sit it again.');
    expect([res.status, res.body.payload.status]).toEqual([200, 'IN_PROGRESS']);
    expect(await attemptOf(s)).toMatchObject({ status: 'IN_PROGRESS', started_at: null, effective_deadline: null, total_score: null, disqualification_reason: null });
    // The answer rows stay (no deletes); what was written is in the review.
    const [answer] = await t.dataSource.getRepository(StudentExamAnswerEntity).findBy({ submission_id: s.flaggedAttempt.id });
    expect(answer).toMatchObject({ text_answer: null, marks_obtained: null });
    const [row] = await t.dataSource.getRepository(ExamAttemptReviewEntity).findBy({ exam_id: s.exam.id, student_id: s.flagged.id });
    expect(row.previous_attempt).toMatchObject({ status: 'DISQUALIFIED', answers: [expect.objectContaining({ text_answer: 'Things fall down.', marks_obtained: '4.00' })] });
    const [notice] = await t.dataSource.getRepository(NotificationOutboxEntity).findBy({ event_type: 'exam.review_decided', recipient_id: s.flagged.id });
    expect(notice.payload).toMatchObject({ decision: 'RETAKE', path: '/tests' });

    // While it is open it is not a finished attempt.
    const early = await review(s, s.teacherToken, 'CONFIRM');
    expect([early.status, early.body.code]).toEqual([409, 'EXAM_ATTEMPT_NOT_FINISHED']);

    // The clock starts when the student presses Start.
    const before = Date.now();
    expect((await t.api.post(`/student/exams/${s.exam.id}/start`, {}, s.studentToken)).status).toBe(201);
    const started = await attemptOf(s);
    expect(started.started_at!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(started.effective_deadline!.getTime()).toBeGreaterThan(Date.now() + 25 * 60_000);
  });

  it('refuses a retake once the exam has ended', async () => {
    const s = await school({ exam_start_time: new Date(Date.now() - 3 * 60 * 60_000), exam_end_time: new Date(Date.now() - 60 * 60_000) });
    const res = await review(s, s.teacherToken, 'RETAKE');
    expect([res.status, res.body.code]).toEqual([409, 'EXAM_RETAKE_WINDOW_CLOSED']);
    expect((await attemptOf(s)).status).toBe('DISQUALIFIED');
    expect(await t.dataSource.getRepository(ExamAttemptReviewEntity).countBy({ exam_id: s.exam.id })).toBe(0);
    expect((await t.api.post(`/exams/${s.exam.id}/proctoring/students/${s.flagged.id}/review`, { decision: 'FORGIVE', reason: 'x' }, s.teacherToken)).status).toBe(400);
  });
});
