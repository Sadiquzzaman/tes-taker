import { DeepPartial, IsNull } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ActiveStatusEnum } from '../../src/common/enums/active-status.enum';
import { ExamQuestionEntity, QuestionTypeEnum } from '../../src/exams/entities/exam-question.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from '../../src/exams/entities/student-exam-answer.entity';
import { GradingScales1755700000000 } from '../../src/migrations/1755700000000-GradingScales';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { GradingBandEntity } from '../../src/performance/entities/grading-band.entity';
import { GradingScaleEntity } from '../../src/performance/entities/grading-scale.entity';
import { BANGLADESH_NATIONAL_BANDS, GradeBand } from '../../src/performance/grading-scale.util';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Scale = { name: string; is_custom: boolean; bands: GradeBand[] };
type Body<T> = { payload: T; code?: string; message?: string };

const PASS_FAIL: GradeBand[] = [
  { min_pct: 0, max_pct: 49.99, grade: 'Fail', gpa: null },
  { min_pct: 50, max_pct: 100, grade: 'Pass', gpa: 1 },
];

/** The organisation grading scale (P2-06, FND-11): who sees and edits it, history, audit, and grades on results. */
describe('grading scale API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  const getScale = (token: string) => t.api.get<Body<Scale>>('/grading-scale', token);
  const putScale = (token: string, body: unknown) => t.api.request<Body<Scale>>('PUT', '/grading-scale', { body, token });
  const resetScale = (token: string) => t.api.request<Body<Scale>>('DELETE', '/grading-scale', { token });

  const school = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    return { owner, organization, token: orgSession(owner, organization) };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    // The test database is emptied between files; seed the platform default as the migration does.
    await new GradingScales1755700000000().up(t.dataSource.createQueryRunner());
  });

  afterAll(async () => {
    await t.close();
  });

  it('gives a new organisation the Bangladesh national scale', async () => {
    const { token } = await school();
    const response = await getScale(token);
    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({ name: 'Bangladesh national', is_custom: false, bands: BANGLADESH_NATIONAL_BANDS });
  });

  it('lets the owner or an admin save bands; members can read them; another organisation is unaffected', async () => {
    const { organization, token } = await school();
    const other = await school();
    const admin = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, admin, OrganizationMemberRoleEnum.ADMIN);
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const teacherToken = orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER);

    const saved = await putScale(token, { name: 'English medium', bands: PASS_FAIL });
    expect(saved.status).toBe(200);
    expect(saved.body.payload).toMatchObject({ name: 'English medium', is_custom: true, bands: [PASS_FAIL[1], PASS_FAIL[0]] });

    expect((await getScale(teacherToken)).body.payload.bands.map((b) => b.grade)).toEqual(['Pass', 'Fail']);
    expect((await putScale(teacherToken, { bands: BANGLADESH_NATIONAL_BANDS })).status).toBe(403);
    expect((await putScale(orgSession(admin, organization, OrganizationMemberRoleEnum.ADMIN), { bands: PASS_FAIL })).status).toBe(200);

    expect((await getScale(other.token)).body.payload.is_custom).toBe(false);
  });

  it('lets a solo teacher set the scale of their own workspace', async () => {
    const teacher = await make.teacher();
    const token = t.tokenFor(teacher);
    expect((await putScale(token, { bands: PASS_FAIL })).status).toBe(200);
    expect((await getScale(token)).body.payload.is_custom).toBe(true);
  });

  it('rejects bands with a gap, with a code the client translates', async () => {
    const { token } = await school();
    const gap = [{ ...PASS_FAIL[0], max_pct: 48 }, PASS_FAIL[1]];
    const response = await putScale(token, { bands: gap });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('GRADING_SCALE_GAP_OR_OVERLAP');
    expect((await putScale(token, { bands: [] })).status).toBe(400);
    expect((await getScale(token)).body.payload.is_custom).toBe(false);
  });

  it('keeps every earlier scale (soft delete) and records saves and resets in the audit log', async () => {
    const { owner, organization, token } = await school();
    expect((await putScale(token, { bands: PASS_FAIL })).status).toBe(200);
    expect((await putScale(token, { name: 'Strict', bands: [{ ...PASS_FAIL[0], max_pct: 59.99 }, { ...PASS_FAIL[1], min_pct: 60 }] })).status).toBe(200);
    const reset = await resetScale(token);
    expect(reset.status).toBe(200);
    expect(reset.body.payload).toMatchObject({ is_custom: false, bands: BANGLADESH_NATIONAL_BANDS });
    // A second reset changes nothing and records nothing.
    expect((await resetScale(token)).status).toBe(200);
    await audit.flush();

    const scales = await t.dataSource.getRepository(GradingScaleEntity).find({ where: { organization_id: organization.id }, order: { created_at: 'ASC' } });
    expect(scales).toHaveLength(2);
    expect(scales.every((scale) => scale.is_active === ActiveStatusEnum.INACTIVE && scale.deactivated_by === owner.id && scale.deactivated_at)).toBe(true);
    expect(await t.dataSource.getRepository(GradingBandEntity).countBy({ scale_id: scales[0].id })).toBe(2);

    const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: organization.id }, order: { id: 'ASC' } });
    expect(logs.map((log) => log.action)).toEqual(['grading_scale.update', 'grading_scale.update', 'grading_scale.reset']);
    expect(logs[0]).toMatchObject({
      actor_id: owner.id,
      entity_type: 'grading_scale',
      entity_id: scales[0].id,
      before: { is_custom: false, name: 'Bangladesh national' },
      after: { is_custom: true, name: 'Custom', bands: ['50–100 Pass (1)', '0–49.99 Fail'] },
    });
    expect(logs[2]).toMatchObject({ entity_id: scales[1].id, before: { name: 'Strict' }, after: { is_custom: false } });
  });

  describe('grades on results', () => {
    it('shows the grade beside the marks and regrades when the scale changes, without touching marks', async () => {
      const teacher = await make.teacher();
      const student = await make.student();
      const exam = await make.openExam(teacher, { test_name: 'Essay test' });
      const question = await t.dataSource.getRepository(ExamQuestionEntity).save({
        exam: { id: exam.id },
        question: 'Explain gravity.',
        question_type: QuestionTypeEnum.SUBJECTIVE,
        points: 10,
      } as DeepPartial<ExamQuestionEntity>);
      const submission = await t.dataSource.getRepository(StudentExamSubmissionEntity).save({
        exam_id: exam.id,
        student_id: student.id,
        status: ExamSubmissionStatusEnum.SUBMITTED,
      } as Partial<StudentExamSubmissionEntity>);
      const token = t.tokenFor(teacher);

      const graded = await t.api.request<Body<{ total_score: number; percentage: number; grade: unknown }>>(
        'PATCH',
        `/exams/grading/${exam.id}/submissions/${submission.id}`,
        { body: { grades: [{ question_id: question.id, marks_obtained: 8 }] }, token },
      );
      expect(graded.status).toBe(200);
      expect(graded.body.payload).toMatchObject({ total_score: 8, percentage: 80, grade: { grade: 'A+', gpa: 5 } });
      expect((await t.api.post(`/exams/grading/${exam.id}/publish`, {}, token)).status).toBe(201);

      type Summary = Body<{ submissions: Array<{ percentage: number; grade: unknown }> }>;
      const summary = await t.api.get<Summary>(`/exams/grading/${exam.id}`, token);
      expect(summary.body.payload.submissions[0]).toMatchObject({ percentage: 80, grade: { grade: 'A+', gpa: 5 } });

      const studentToken = t.tokenFor(student);
      type Result = Body<{ total_score: number; percentage: number; grade: unknown; submission: { grade: unknown } }>;
      const result = await t.api.get<Result>(`/student/exams/${exam.id}/result`, studentToken);
      expect(result.status).toBe(200);
      expect(result.body.payload).toMatchObject({ total_score: 8, percentage: 80, grade: { grade: 'A+' }, submission: { grade: { grade: 'A+' } } });

      // The teacher's workspace switches to pass/fail: the same marks now read "Pass".
      expect((await putScale(token, { bands: PASS_FAIL })).status).toBe(200);
      const regraded = await t.api.get<Result>(`/student/exams/${exam.id}/result`, studentToken);
      expect(regraded.body.payload).toMatchObject({ total_score: 8, percentage: 80, grade: { grade: 'Pass', gpa: 1 } });
      const history = await t.api.get<Body<Array<{ id: string; grade: unknown }>>>('/student/exams/history', studentToken);
      expect(history.body.payload.find((row) => row.id === exam.id)).toMatchObject({ grade: { grade: 'Pass' } });
      expect(Number((await t.dataSource.getRepository(StudentExamSubmissionEntity).findOneByOrFail({ id: submission.id })).total_score)).toBe(8);
    });

    it('grades exams without an organisation (pre-P2-01 rows) on the Bangladesh scale', async () => {
      const teacher = await make.teacher();
      const student = await make.student();
      const exam = await make.openExam(teacher, { organization_id: null, result_published_at: new Date() });
      await t.dataSource.getRepository(StudentExamSubmissionEntity).save({
        exam_id: exam.id,
        student_id: student.id,
        status: ExamSubmissionStatusEnum.SUBMITTED,
        total_score: 13,
        max_score: 20,
      } as Partial<StudentExamSubmissionEntity>);
      const history = await t.api.get<Body<Array<{ id: string; percentage: number; grade: unknown }>>>('/student/exams/history', t.tokenFor(student));
      expect(history.body.payload.find((row) => row.id === exam.id)).toMatchObject({ percentage: 65, grade: { grade: 'A-', gpa: 3.5 } });
    });
  });

  describe('migration', () => {
    it('seeds one platform default, is safe to run twice, and reverses', async () => {
      const migration = new GradingScales1755700000000();
      const runner = t.dataSource.createQueryRunner();
      try {
        await migration.up(runner);
        const defaults = () => t.dataSource.getRepository(GradingScaleEntity).find({ where: { organization_id: IsNull(), is_default: true }, relations: ['bands'] });
        expect(await defaults()).toHaveLength(1);
        expect((await defaults())[0].bands).toHaveLength(7);

        await migration.down(runner);
        expect(await runner.hasTable('grading_scales')).toBe(false);
        await migration.up(runner);
        expect(await defaults()).toHaveLength(1);
      } finally {
        await runner.release();
      }
    });
  });
});
