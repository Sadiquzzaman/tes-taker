import { DeepPartial } from 'typeorm';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from '../../src/academics/entities/academic-session.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OfflineExamsService } from '../../src/exams/offline-exams.service';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Exam = {
  id: string;
  name: string;
  total_marks: number;
  parts: { name: string; marks: number }[] | null;
  term: { id: string; name: string } | null;
  offering: { id: string; subject: { name: string }; section: { name: string; class_name: string | null } };
  published_at: string | null;
  counts: { students: number; entered: number };
  can_edit: boolean;
};
type Grid = { exam: Exam; rows: { student: { id: string; full_name: string }; marks: number | null; part_marks: Record<string, number> | null; is_absent: boolean; percent: number | null; grade: { grade: string } | null }[] };

/**
 * Paper exams (P7-01, PRF-03): a subject teacher creates an exam taken on paper, with optional
 * parts adding up to the total, enters marks in a grid (or absent), and publishes them for the
 * students. Marks changes are in the audit log; removed exams stop counting.
 */
describe('paper exams API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  /** Class 6 A: Math (Rina) and English (Karim), with two students, and the performance feature on. */
  const school = async ({ performanceOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const override = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/performance`, {
      body: { value: performanceOn, reason: 'P7-01 test' },
      token: t.tokenFor(admin),
    });
    expect(override.status).toBe(200);
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const english = await subjects.save({ name: 'English', code: 'ENG', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [math, english]) await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: subject.id });
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const [section] = (await call<{ id: string; session_id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const offerings = (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${section.id}/offerings`, ownerToken)).body.payload;
    const mathOffering = offerings.find((o) => o.subject.id === math.id)!.id;
    const englishOffering = offerings.find((o) => o.subject.id === english.id)!.id;
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathOffering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    await call('PUT', `/offerings/${englishOffering}/teachers`, ownerToken, { teacher_ids: [karim.id] });
    return {
      organization,
      ownerToken,
      sessionId: section.session_id,
      rina,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      rafi,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      mathOffering,
      englishOffering,
    };
  };

  const halfYearly = (offeringId: string, extra: Record<string, unknown> = {}) => ({
    offering_id: offeringId,
    name: ' Half-yearly exam ',
    exam_date: '2026-12-10',
    total_marks: 100,
    parts: [
      { name: 'MCQ', marks: 30 },
      { name: 'Written', marks: 70 },
    ],
    ...extra,
  });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('lets the subject teacher make a paper exam with parts adding up to the total; others may not', async () => {
    const s = await school();
    const made = await call<Exam>('POST', '/offline-exams', s.rinaToken, halfYearly(s.mathOffering));
    expect(made.status).toBe(201);
    expect(made.body.payload).toMatchObject({
      name: 'Half-yearly exam',
      total_marks: 100,
      parts: [{ name: 'MCQ', marks: 30 }, { name: 'Written', marks: 70 }],
      offering: { subject: { name: 'Math' }, section: { name: 'A', class_name: 'Class 6' } },
      counts: { students: 2, entered: 0 },
      can_edit: true,
      published_at: null,
    });

    const badParts = await call('POST', '/offline-exams', s.rinaToken, halfYearly(s.mathOffering, { parts: [{ name: 'MCQ', marks: 30 }, { name: 'mcq', marks: 60 }] }));
    expect([badParts.status, badParts.body.code]).toEqual([400, 'OFFLINE_EXAM_PARTS_INVALID']);
    const notHers = await call('POST', '/offline-exams', s.rinaToken, halfYearly(s.englishOffering));
    expect([notHers.status, notHers.body.code]).toEqual([403, 'OFFLINE_EXAM_NOT_ALLOWED']);
    expect((await call('POST', '/offline-exams', s.mituToken, halfYearly(s.mathOffering))).status).toBe(403);

    // A term of the session is accepted; one of another session is not.
    const term = (await call<{ id: string }>('POST', `/sessions/${s.sessionId}/terms`, s.ownerToken, { name: 'Half-yearly', start_date: '2026-07-01', end_date: '2026-12-31' })).body.payload;
    expect((await call<Exam>('POST', '/offline-exams', s.ownerToken, halfYearly(s.englishOffering, { term_id: term.id, parts: null }))).body.payload.term).toMatchObject({ name: 'Half-yearly' });

    // The form's choices: a teacher's own subject classes, with the session's terms; everything for the owner.
    const choices = (await call<{ subject: { name: string }; section_label: string; terms: { name: string }[] }[]>('GET', '/offline-exams/subject-classes', s.rinaToken)).body.payload;
    expect(choices.map((c) => [c.section_label, c.subject.name, c.terms.map((x) => x.name)])).toEqual([['Class 6 A', 'Math', ['Half-yearly']]]);
    expect((await call<unknown[]>('GET', '/offline-exams/subject-classes', s.ownerToken)).body.payload).toHaveLength(2);

    // Teachers list their own subject classes' exams; the owner sees all.
    expect((await call<Exam[]>('GET', '/offline-exams', s.rinaToken)).body.payload.map((e) => e.offering.subject.name)).toEqual(['Math']);
    expect((await call<Exam[]>('GET', '/offline-exams', s.karimToken)).body.payload.map((e) => e.offering.subject.name)).toEqual(['English']);
    expect((await call<Exam[]>('GET', '/offline-exams', s.ownerToken)).body.payload).toHaveLength(2);
    expect((await call('GET', `/offline-exams/${made.body.payload.id}/marks`, s.karimToken)).status).toBe(404);
  });

  it('enters marks per part or absent, checks them against the parts, logs every change, and publishes', async () => {
    const s = await school();
    const exam = (await call<Exam>('POST', '/offline-exams', s.rinaToken, halfYearly(s.mathOffering))).body.payload;
    const grid = await call<Grid>('GET', `/offline-exams/${exam.id}/marks`, s.rinaToken);
    expect(grid.body.payload.rows.map((r) => r.student.full_name).sort()).toEqual(['Mitu', 'Rafi']);

    const tooHigh = await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, part_marks: { MCQ: 31, Written: 50 } }] });
    expect([tooHigh.status, tooHigh.body.code]).toEqual([400, 'OFFLINE_EXAM_MARKS_INVALID']);
    const half = await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, part_marks: { MCQ: 20 } }] });
    expect(half.body.code).toBe('OFFLINE_EXAM_MARKS_INVALID');
    const outsider = await make.student();
    const notInClass = await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: outsider.id, part_marks: { MCQ: 1, Written: 1 } }] });
    expect(notInClass.body.code).toBe('OFFLINE_EXAM_STUDENT_NOT_IN_CLASS');

    const saved = await call<Grid>('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, {
      rows: [
        { student_id: s.mitu.id, part_marks: { MCQ: 24.5, Written: 56 } },
        { student_id: s.rafi.id, is_absent: true },
      ],
    });
    expect(saved.status).toBe(200);
    const mitu = saved.body.payload.rows.find((r) => r.student.id === s.mitu.id)!;
    expect(mitu).toMatchObject({ marks: 80.5, part_marks: { MCQ: 24.5, Written: 56 }, is_absent: false, percent: 80.5, grade: { grade: 'A+' } });
    expect(saved.body.payload.rows.find((r) => r.student.id === s.rafi.id)).toMatchObject({ marks: null, is_absent: true, percent: null });
    expect(saved.body.payload.exam.counts).toEqual({ students: 2, entered: 2 });

    // Saving the same marks again changes nothing and logs nothing.
    await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, part_marks: { MCQ: 24.5, Written: 56 } }] });
    await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, part_marks: { MCQ: 25, Written: 56 } }] });
    await t.app.get(AuditService).flush();
    const logged = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'offline_exam.marks' }, order: { created_at: 'ASC' } });
    expect(logged.map((row) => [(row.after as { student_id: string }).student_id === s.mitu.id ? 'Mitu' : 'Rafi', (row.after as { marks: string | null }).marks])).toEqual([
      ['Mitu', '80.5'],
      ['Rafi', null],
      ['Mitu', '81'],
    ]);
    expect(logged[2].before).toMatchObject({ marks: '80.5' });

    // Students see nothing until the marks are published.
    expect((await call<unknown[]>('GET', '/offline-exams/mine', s.mituToken)).body.payload).toEqual([]);
    expect((await call('POST', `/offline-exams/${exam.id}/publish`, s.rinaToken)).status).toBe(200);
    const mine = (await call<{ exam: { name: string; subject: { name: string } }; marks: number; percent: number }[]>('GET', '/offline-exams/mine', s.mituToken)).body.payload;
    expect(mine).toEqual([expect.objectContaining({ exam: expect.objectContaining({ name: 'Half-yearly exam', subject: { id: expect.any(String), name: 'Math' } }), marks: 81, percent: 81 })]);
    expect((await call('GET', '/offline-exams', s.mituToken)).status).toBe(403);
  });

  it('keeps marks within a changed total, and stops counting a removed exam', async () => {
    const s = await school();
    const exam = (await call<Exam>('POST', '/offline-exams', s.rinaToken, halfYearly(s.mathOffering, { parts: null }))).body.payload;
    await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, marks: 60 }] });
    const below = await call('PATCH', `/offline-exams/${exam.id}`, s.rinaToken, { total_marks: 50 });
    expect([below.status, below.body.code]).toEqual([409, 'OFFLINE_EXAM_TOTAL_BELOW_MARKS']);
    expect((await call<Exam>('PATCH', `/offline-exams/${exam.id}`, s.rinaToken, { total_marks: 80, name: 'Class test' })).body.payload).toMatchObject({ total_marks: 80, name: 'Class test' });
    const withParts = await call('PATCH', `/offline-exams/${exam.id}`, s.rinaToken, { parts: [{ name: 'MCQ', marks: 40 }, { name: 'Written', marks: 40 }] });
    expect(withParts.status).toBe(200);
    expect((await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.rafi.id, marks: 10 }] })).body.code).toBe('OFFLINE_EXAM_MARKS_INVALID');

    const facts = t.app.get(OfflineExamsService);
    expect((await facts.marksOf(s.organization.id, [s.mitu.id], '2026-12-01', '2026-12-31')).map((f) => [f.percent, f.total_marks])).toEqual([[75, 80]]);
    expect(await facts.marksOf(s.organization.id, [s.mitu.id], '2026-12-01', '2026-12-31', true)).toEqual([]);

    expect((await call('DELETE', `/offline-exams/${exam.id}`, s.karimToken)).status).toBe(404);
    expect((await call('DELETE', `/offline-exams/${exam.id}`, s.rinaToken)).status).toBe(200);
    expect((await call<Exam[]>('GET', '/offline-exams', s.ownerToken)).body.payload).toEqual([]);
    expect((await call('GET', `/offline-exams/${exam.id}/marks`, s.ownerToken)).status).toBe(404);
    expect(await facts.marksOf(s.organization.id, [s.mitu.id], '2026-12-01', '2026-12-31')).toEqual([]);
  });

  it('is read-only in a closed session, needs the performance feature, and keeps schools apart', async () => {
    const s = await school();
    const exam = (await call<Exam>('POST', '/offline-exams', s.rinaToken, halfYearly(s.mathOffering))).body.payload;
    const other = await school();
    expect((await call('GET', `/offline-exams/${exam.id}/marks`, other.ownerToken)).status).toBe(404);
    expect((await call('POST', '/offline-exams', other.ownerToken, halfYearly(s.mathOffering))).status).toBe(404);

    await t.dataSource.getRepository(AcademicSessionEntity).update({ organization_id: s.organization.id }, { status: AcademicSessionStatusEnum.CLOSED });
    const closed = await call('PUT', `/offline-exams/${exam.id}/marks`, s.rinaToken, { rows: [{ student_id: s.mitu.id, is_absent: true }] });
    expect([closed.status, closed.body.code]).toEqual([409, 'OFFLINE_EXAM_SESSION_CLOSED']);
    expect((await call<Exam[]>('GET', '/offline-exams', s.ownerToken)).body.payload[0].can_edit).toBe(false);

    const off = await school({ performanceOn: false });
    const refused = await call('GET', '/offline-exams', off.ownerToken);
    expect([refused.status, refused.body.code]).toEqual([403, 'FEATURE_NOT_IN_PLAN']);
  });
});
