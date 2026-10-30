import { getRepositoryToken } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { ExamQuestionEntity, QuestionTypeEnum } from '../../src/exams/entities/exam-question.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamAnswerEntity,
  StudentExamSubmissionEntity,
} from '../../src/exams/entities/student-exam-answer.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { OrganizationStatusEnum } from '../../src/organizations/enums/organization-status.enum';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Log = {
  id: string;
  action: string;
  organization: { id: string; name: string } | null;
  actor: { id: string; full_name: string | null } | null;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip?: string | null;
};
type Page = { payload: Log[]; meta: { total: number } };

/** The audit log (P2-09, design §8.10): what is recorded, who may read it, and that it never breaks a request. */
describe('audit log API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let auditRepo: Repository<AuditLogEntity>;
  let admin: UserEntity;
  let proPlanId: string;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  /** Runs an API call, then waits for the audit rows it started writing in the background. */
  const act = async <T>(call: Promise<T>): Promise<T> => {
    const result = await call;
    await audit.flush();
    return result;
  };

  const adminLogs = async (query: string) => {
    const response = await t.api.get<Page>(`/audit-logs/admin?${query}`, t.tokenFor(admin));
    expect(response.status).toBe(200);
    return response.body.payload;
  };

  /** A school with an owner and an active teacher member. */
  const school = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    const member = await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    return { owner, organization, teacher, member };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    auditRepo = t.app.get(getRepositoryToken(AuditLogEntity));
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    proPlanId = (await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'pro' })).id;
  });

  afterAll(async () => {
    await t.close();
  });

  describe('platform admin changes to plans and switches', () => {
    it('records the plan assignment, an override with its reason, and its removal, with who and from where', async () => {
      const { organization } = await school();
      const token = t.tokenFor(admin);

      await act(t.api.post('/subscriptions/admin/assign', { organization_id: organization.id, plan_id: proPlanId, notes: 'Agreed on the phone' }, token));
      await act(
        t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/max_exams_per_month`, {
          body: { value: 40, reason: 'Exam season' },
          token,
        }),
      );
      await act(t.api.request('DELETE', `/subscriptions/admin/organizations/${organization.id}/overrides/max_exams_per_month`, { token }));

      const logs = await adminLogs(`organization_id=${organization.id}&action=subscription.`);
      expect(logs.map((log) => log.action)).toEqual([
        'subscription.override_remove',
        'subscription.override_set',
        'subscription.plan_assign',
      ]);
      const [removed, set, assigned] = logs;
      expect(assigned).toMatchObject({
        organization: { id: organization.id },
        actor: { id: admin.id, full_name: admin.full_name },
        entity_type: 'account_subscription',
        after: { plan_slug: 'pro', status: 'ACTIVE' },
        reason: 'Agreed on the phone',
      });
      expect(assigned.ip).toEqual(expect.stringMatching(/127\.0\.0\.1|::1/));
      expect(set).toMatchObject({ before: null, after: { key: 'max_exams_per_month', value: 40 }, reason: 'Exam season' });
      expect(removed).toMatchObject({ actor: { id: admin.id }, before: { key: 'max_exams_per_month', value: 40 }, after: null });
    });

    it('records a plan edit with only the fields that changed', async () => {
      const slug = `audit-${Date.now()}`;
      const created = await act(
        t.api.post<{ payload: { id: string } }>('/subscriptions/admin/plans', { name: 'Audit plan', slug, price_monthly: 100 }, t.tokenFor(admin)),
      );
      const planId = created.body.payload.id;
      const patched = await act(
        t.api.request('PATCH', `/subscriptions/admin/plans/${planId}`, { body: { name: 'Audit plan', slug, price_monthly: 150 }, token: t.tokenFor(admin) }),
      );
      expect(patched.status).toBe(200);

      const logs = await adminLogs(`entity_id=${planId}`);
      expect(logs.map((log) => log.action)).toEqual(['plan.update', 'plan.create']);
      expect(logs[0]).toMatchObject({ organization: null, before: { price_monthly: 100 }, after: { price_monthly: 150 } });
      expect(Object.keys(logs[0].after ?? {})).toEqual(['price_monthly']);
    });

    it('records approvals and role changes without any secret in before/after', async () => {
      const owner = await make.teacher({ personal_teacher_enabled: false });
      const pending = await make.organization(owner, { status: OrganizationStatusEnum.PENDING });
      const student = await make.student();

      await act(t.api.request('PATCH', `/organizations/admin/${pending.id}/reject`, { body: { reason: 'Not a school' }, token: t.tokenFor(admin) }));
      await act(t.api.request('PATCH', `/user/admin/users/${student.id}/role`, { body: { role: RolesEnum.TEACHER }, token: t.tokenFor(admin) }));

      expect(await adminLogs(`organization_id=${pending.id}`)).toEqual([
        expect.objectContaining({ action: 'organization.reject', before: { status: 'pending' }, after: { status: 'rejected' }, reason: 'Not a school' }),
      ]);
      expect(await adminLogs(`entity_id=${student.id}`)).toEqual([
        expect.objectContaining({ action: 'user.role_change', before: { role: 'STUDENT' }, after: { role: 'TEACHER' } }),
      ]);

      const everything = JSON.stringify(await auditRepo.find());
      expect(everything).not.toMatch(/password|refresh_token|otp|google_id|\$2[aby]\$/i);
    });

    it('is only for platform admins', async () => {
      const { owner } = await school();
      expect((await t.api.get('/audit-logs/admin', t.tokenFor(owner))).status).toBe(403);
      expect((await t.api.get('/audit-logs/admin')).status).toBe(401);
    });
  });

  describe("an organisation's own log", () => {
    it('shows the owner their organisation only, including platform changes to it, without IP addresses', async () => {
      const { owner, organization, member } = await school();
      const other = await school();
      const token = orgSession(owner, organization);

      await act(t.api.request('PATCH', `/organizations/${organization.id}/members/${member.id}`, { body: { role: OrganizationMemberRoleEnum.ADMIN }, token }));
      await act(t.api.request('DELETE', `/organizations/${organization.id}/members/${member.id}`, { token }));
      await act(t.api.post('/subscriptions/admin/assign', { organization_id: organization.id, plan_id: proPlanId }, t.tokenFor(admin)));
      await act(t.api.request('DELETE', `/organizations/${other.organization.id}/members/${other.member.id}`, { token: orgSession(other.owner, other.organization) }));

      const response = await t.api.get<Page>('/audit-logs', token);
      expect(response.status).toBe(200);
      const logs = response.body.payload;
      expect(logs.map((log) => log.action)).toEqual(['subscription.plan_assign', 'member.remove', 'member.role_change']);
      expect(logs.every((log) => log.organization?.id === organization.id)).toBe(true);
      expect(logs.every((log) => !('ip' in log))).toBe(true);
      expect(logs[2]).toMatchObject({
        actor: { id: owner.id },
        entity_type: 'organization_member',
        entity_id: member.id,
        before: { role: 'TEACHER' },
        after: { role: 'ADMIN' },
      });
      expect(logs[1]).toMatchObject({ before: { role: 'ADMIN' }, after: { active: false } });

      // A filter cannot reach another organisation.
      const sneaky = await t.api.get<Page>(`/audit-logs?organization_id=${other.organization.id}`, token);
      expect(sneaky.body.payload.map((log) => log.organization?.id)).not.toContain(other.organization.id);
    });

    it('is open to admins, closed to teachers and students', async () => {
      const { organization, teacher } = await school();
      const orgAdmin = await make.teacher({ personal_teacher_enabled: false });
      await make.member(organization, orgAdmin, OrganizationMemberRoleEnum.ADMIN);

      expect((await t.api.get('/audit-logs', orgSession(orgAdmin, organization, OrganizationMemberRoleEnum.ADMIN))).status).toBe(200);
      expect((await t.api.get('/audit-logs', orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);
      expect((await t.api.get('/audit-logs', t.tokenFor(await make.student()))).status).toBe(403);
    });

    it("gives a solo teacher their own workspace's log", async () => {
      const teacher = await make.teacher();
      expect((await t.api.get('/audit-logs', t.tokenFor(teacher))).status).toBe(200);
    });
  });

  describe('results', () => {
    it('records publishing, and a mark changed after publishing with the old and new marks', async () => {
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
      const grade = (marks: number) =>
        act(t.api.request('PATCH', `/exams/grading/${exam.id}/submissions/${submission.id}`, { body: { grades: [{ question_id: question.id, marks_obtained: marks }] }, token }));

      expect((await grade(6)).status).toBe(200);
      expect((await act(t.api.post(`/exams/grading/${exam.id}/publish`, {}, token))).status).toBe(201);
      expect((await grade(6)).status).toBe(200); // unchanged: not recorded
      expect((await grade(8)).status).toBe(200);

      const logs = await adminLogs(`organization_id=${exam.organization_id}`);
      expect(logs.map((log) => log.action)).toEqual(['grade.update', 'exam.results_publish']);
      expect(logs[1]).toMatchObject({ entity_type: 'exam', entity_id: exam.id, after: { test_name: 'Essay test', submissions: 1 } });
      expect(logs[0]).toMatchObject({
        actor: { id: teacher.id },
        entity_type: 'student_exam_submission',
        entity_id: submission.id,
        before: { total_score: 6, marks: { [question.id]: 6 } },
        after: { total_score: 8, marks: { [question.id]: 8 }, exam_id: exam.id, student_id: student.id },
      });
      expect(await t.dataSource.getRepository(StudentExamAnswerEntity).countBy({ submission_id: submission.id })).toBe(1);
    });
  });

  describe('safety', () => {
    it('never fails or blocks the request it records', async () => {
      const { owner, organization, member } = await school();
      const insert = jest.spyOn(auditRepo, 'insert').mockRejectedValueOnce(new Error('audit table unavailable'));

      const response = await act(
        t.api.request('PATCH', `/organizations/${organization.id}/members/${member.id}`, {
          body: { role: OrganizationMemberRoleEnum.ASSISTANT },
          token: orgSession(owner, organization),
        }),
      );
      expect(response.status).toBe(200);
      expect(insert).toHaveBeenCalled();
      expect(await auditRepo.countBy({ organization_id: organization.id })).toBe(0);
    });

    it('is append-only, but keeps rows (without the actor) when a user row is deleted', async () => {
      const someone = await make.teacher();
      await auditRepo.insert({ action: 'plan.reorder', actor_id: someone.id });
      const row = await auditRepo.findOneByOrFail({ actor_id: someone.id });

      await expect(t.dataSource.query(`UPDATE audit_logs SET action = 'plan.delete' WHERE id = $1`, [row.id])).rejects.toThrow(/append-only/);

      await t.dataSource.query('DELETE FROM users WHERE id = $1', [someone.id]);
      expect(await auditRepo.findOneByOrFail({ id: row.id })).toMatchObject({ action: 'plan.reorder', actor_id: null });
    });
  });
});
