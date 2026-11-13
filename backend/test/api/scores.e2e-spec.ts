import { DeepPartial } from 'typeorm';
import { AcademicSessionEntity } from '../../src/academics/entities/academic-session.entity';
import { AttendanceReportsService } from '../../src/attendance/attendance-reports.service';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { ExamSubmissionStatusEnum, StudentExamSubmissionEntity } from '../../src/exams/entities/student-exam-answer.entity';
import { HomeworkScoreEntity } from '../../src/homework/entities/homework-score.entity';
import { HomeworkEntity, HomeworkStatusEnum, HomeworkTypeEnum } from '../../src/homework/entities/homework.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { ScoresService } from '../../src/results/scores.service';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Line = { exams_pct: number | null; homework_pct: number | null; attendance_pct: number | null; behaviour_pct: number | null; score_pct: number | null; grade: { grade: string } | null; counts: { exams: number; homework: number; ratings: number } };
type Scores = {
  period: { from: string; to: string; term: { id: string } | null };
  weights: { exams_pct: number; is_default: boolean };
  students: { student: { id: string; full_name: string }; overall: Line; subjects: (Line & { subject: { name: string } })[]; missing_homework: number; at_risk: string[]; position: number | null }[];
};
type Weights = { session: { id: string }; classes: { class: { id: string; name: string }; weights: Record<string, number>; is_default: boolean }[] };

/**
 * Scores (P7-02, PRF-01, PRF-07, PRF-10): weights per class, the at-risk limits and the live
 * scores worked out from paper and online exams, homework, attendance and behaviour, for a term
 * or the whole session. Attendance comes from AttendanceReportsService.studentAttendance (its
 * own tests cover it); here it is given, so the numbers are easy to check by hand.
 */
describe('scores API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  /** Each student's attendance % as AttendanceReportsService gives it. */
  const attendanceOf = new Map<string, number>();

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  /** Class 6 A: Math (Rina) and English (Karim), Mitu and Rafi, with marks in all four parts. */
  const school = async ({ performanceOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const override = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/performance`, {
      body: { value: performanceOn, reason: 'P7-02 test' },
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
    const [rina, karim, lina] = [await make.teacher({ full_name: 'Rina' }), await make.teacher({ full_name: 'Karim' }), await make.teacher({ full_name: 'Lina' })];
    for (const teacher of [rina, karim, lina]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathOffering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    await call('PUT', `/offerings/${englishOffering}/teachers`, ownerToken, { teacher_ids: [karim.id] });
    const session = await t.dataSource.getRepository(AcademicSessionEntity).findOneByOrFail({ id: section.session_id });
    const rinaToken = token(rina, OrganizationMemberRoleEnum.TEACHER);
    const karimToken = token(karim, OrganizationMemberRoleEnum.TEACHER);
    // The session's first day: never in the future, so behaviour can be rated on it.
    const day = session.start_date;
    const term = (await call<{ id: string }>('POST', `/sessions/${session.id}/terms`, ownerToken, { name: 'Half-yearly', start_date: day, end_date: session.start_date.replace(/-\d\d-\d\d$/, '-06-30') })).body.payload;
    attendanceOf.set(mitu.id, 95);
    attendanceOf.set(rafi.id, 70);
    const base = { organization, ownerToken, sectionId: section.id };
    if (!performanceOn) return { ...base, rinaToken, karimToken: '', linaToken: '', mituToken: '', mitu, rafi, classId, sessionId: session.id, term, englishTest: '' };

    const paperExam = async (offering: string, tokenOf: string, body: Record<string, unknown>, rows: Record<string, unknown>[]) => {
      const exam = await call<{ id: string }>('POST', '/offline-exams', tokenOf, { offering_id: offering, exam_date: day, total_marks: 100, ...body });
      expect(exam.status).toBe(201);
      expect((await call('PUT', `/offline-exams/${exam.body.payload.id}/marks`, tokenOf, { rows })).status).toBe(200);
      return exam.body.payload.id;
    };
    // Math half-yearly (in the term): Mitu 80%, Rafi absent (0%).
    await paperExam(mathOffering, rinaToken, { name: 'Math half-yearly', term_id: term.id }, [{ student_id: mitu.id, marks: 80 }, { student_id: rafi.id, is_absent: true }]);
    // English class test (no term, on the term's first day): Mitu 35/50 = 70%, Rafi 45/50 = 90%.
    const englishTest = await paperExam(englishOffering, karimToken, { name: 'English class test', total_marks: 50 }, [{ student_id: mitu.id, marks: 35 }, { student_id: rafi.id, marks: 45 }]);
    // Math final (no term, after the term): Mitu 40%; counts for the session only.
    await paperExam(mathOffering, rinaToken, { name: 'Math final', exam_date: session.end_date }, [{ student_id: mitu.id, marks: 40 }]);

    // An online Math quiz that ended on the term's first day: Mitu 18/20 = 90%, Rafi 12/20 = 60%.
    const quiz = await make.openExam(owner, {
      organization_id: organization.id,
      offering_id: mathOffering,
      session_id: session.id,
      test_name: 'Math quiz',
      exam_start_time: new Date(`${day}T04:00:00Z`),
      exam_end_time: new Date(`${day}T05:00:00Z`),
    });
    for (const [student, score] of [[mitu, 18], [rafi, 12]] as const) {
      await t.dataSource.getRepository(StudentExamSubmissionEntity).save({
        exam_id: quiz.id,
        student_id: student.id,
        status: ExamSubmissionStatusEnum.SUBMITTED,
        total_score: score,
        max_score: 20,
        is_graded: true,
      } as DeepPartial<StudentExamSubmissionEntity>);
    }

    // Math homework due on the term's first day: Mitu 10/10, Rafi missing.
    const homework = await t.dataSource.getRepository(HomeworkEntity).save({
      organization_id: organization.id,
      session_id: session.id,
      subject_id: math.id,
      title: 'Fractions',
      submission_type: HomeworkTypeEnum.PAPER,
      total_marks: '10',
      due_at: new Date(`${day}T10:00:00Z`),
      published_at: new Date(`${day}T02:00:00Z`),
      status: HomeworkStatusEnum.PUBLISHED,
    } as DeepPartial<HomeworkEntity>);
    await t.dataSource.getRepository(HomeworkScoreEntity).save([
      { organization_id: organization.id, homework_id: homework.id, student_id: mitu.id, raw_score: '10', final_score: '10', is_missing: false },
      { organization_id: organization.id, homework_id: homework.id, student_id: rafi.id, final_score: '0', is_missing: true },
    ] as DeepPartial<HomeworkScoreEntity>[]);

    // Behaviour in Math: Mitu 5 and 4 (90%), Rafi 2 (40%).
    const [participation, discipline] = (await call<{ id: string }[]>('GET', '/behaviour/criteria', rinaToken)).body.payload;
    const rated = await call('PUT', '/behaviour/grid', rinaToken, {
      offering_id: mathOffering,
      date: day,
      rows: [
        { student_id: mitu.id, ratings: { [participation.id]: 5, [discipline.id]: 4 } },
        { student_id: rafi.id, ratings: { [participation.id]: 2 } },
      ],
    });
    expect(rated.status).toBe(200);

    return {
      ...base,
      rinaToken,
      karimToken,
      linaToken: token(lina, OrganizationMemberRoleEnum.TEACHER),
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      mitu,
      rafi,
      classId,
      sessionId: session.id,
      term,
      englishTest,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.spyOn(t.app.get(AttendanceReportsService), 'studentAttendance').mockImplementation(async (_organizationId: string, ids: string[]) =>
      new Map(ids.map((id) => [id, { counts: { present: 0, late: 0, absent: 0, leave: 0 }, attendance_pct: attendanceOf.get(id) ?? null }])),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await t.close();
  });

  it("works out a term's scores from all four parts with the default weights, per subject and overall, with positions", async () => {
    const s = await school();
    const res = await call<Scores>('GET', `/scores/sections/${s.sectionId}?term_id=${s.term.id}`, s.rinaToken);
    expect(res.status).toBe(200);
    const { students, weights, period } = res.body.payload;
    expect(weights).toMatchObject({ exams_pct: 50, is_default: true });
    expect(period.term?.id).toBe(s.term.id);
    const mitu = students.find((x) => x.student.id === s.mitu.id)!;
    const rafi = students.find((x) => x.student.id === s.rafi.id)!;
    // Mitu: exams (80 + 70 + 90) ÷ 3 = 80; 0.5×80 + 0.2×100 + 0.2×95 + 0.1×90 = 88.
    expect(mitu.overall).toMatchObject({ exams_pct: 80, homework_pct: 100, attendance_pct: 95, behaviour_pct: 90, score_pct: 88, counts: { exams: 3, homework: 1, ratings: 2 } });
    expect(mitu.overall.grade?.grade).toBe('A+');
    // Rafi: exams (0 absent + 90 + 60) ÷ 3 = 50; 0.5×50 + 0 + 0.2×70 + 0.1×40 = 43.
    expect(rafi.overall).toMatchObject({ exams_pct: 50, homework_pct: 0, attendance_pct: 70, behaviour_pct: 40, score_pct: 43 });
    expect([mitu.position, rafi.position]).toEqual([1, 2]);
    expect([rafi.missing_homework, rafi.at_risk]).toEqual([1, ['ATTENDANCE']]);
    // Per subject: Math 0.5×85 + 0.2×100 + 0.2×95 + 0.1×90 = 90.5; English has only its exam and attendance: (70×50 + 95×20) ÷ 70.
    expect(mitu.subjects.map((x) => [x.subject.name, x.exams_pct, x.score_pct])).toEqual([
      ['English', 70, 77.14],
      ['Math', 85, 90.5],
    ]);

    // The whole session also counts the Math final (40%): exams (80 + 70 + 90 + 40) ÷ 4 = 70.
    const session = await call<Scores>('GET', `/scores/sections/${s.sectionId}`, s.ownerToken);
    expect(session.body.payload.students.find((x) => x.student.id === s.mitu.id)!.overall).toMatchObject({ exams_pct: 70, counts: { exams: 4 } });

    // What students can see: only the published paper exam (English) and the online quiz (no hand marking); homework scores unpublished.
    await call('POST', `/offline-exams/${s.englishTest}/publish`, s.karimToken);
    const published = await t.app.get(ScoresService).compute(s.organization.id, s.sectionId, s.term.id, true);
    expect(published.students.find((x) => x.student.id === s.mitu.id)!.overall).toMatchObject({ exams_pct: 80, homework_pct: null, counts: { exams: 2, homework: 0 } });
  });

  it('lets owners and admins set weights per class adding up to 100, logs it, and rescores', async () => {
    const s = await school();
    const list = await call<Weights>('GET', `/scores/weights?session_id=${s.sessionId}`, s.rinaToken);
    expect(list.body.payload.classes).toEqual([{ class: { id: s.classId, name: 'Class 6' }, weights: { exams_pct: 50, homework_pct: 20, attendance_pct: 20, behaviour_pct: 10 }, is_default: true }]);
    const body = { session_id: s.sessionId, class_id: s.classId, exams_pct: 100, homework_pct: 0, attendance_pct: 0, behaviour_pct: 0 };
    expect((await call('PUT', '/scores/weights', s.rinaToken, body)).status).toBe(403);
    const wrong = await call('PUT', '/scores/weights', s.ownerToken, { ...body, behaviour_pct: 10 });
    expect([wrong.status, wrong.body.code]).toEqual([400, 'RESULTS_WEIGHTS_INVALID']);
    const saved = await call<Weights>('PUT', '/scores/weights', s.ownerToken, body);
    expect(saved.body.payload.classes[0]).toMatchObject({ weights: { exams_pct: 100 }, is_default: false });

    const scores = (await call<Scores>('GET', `/scores/sections/${s.sectionId}?term_id=${s.term.id}`, s.ownerToken)).body.payload;
    expect(scores.weights).toMatchObject({ exams_pct: 100, is_default: false });
    expect(scores.students.map((x) => x.overall.score_pct)).toEqual([80, 50]);

    await t.app.get(AuditService).flush();
    const logged = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'score.weights' } });
    expect(logged.map((l) => [(l.before as Record<string, unknown>)?.exams_pct, (l.after as Record<string, unknown>)?.exams_pct])).toEqual([[50, 100]]);
  });

  it('keeps editable at-risk limits and the position setting', async () => {
    const s = await school();
    expect((await call('GET', '/scores/settings', s.rinaToken)).body.payload).toEqual({ at_risk: { score_pct: 40, attendance_pct: 75, missing_homework: 3 }, show_rank: false });
    expect((await call('PUT', '/scores/settings', s.rinaToken, { show_rank: true })).status).toBe(403);
    const bad = await call('PUT', '/scores/settings', s.ownerToken, { at_risk: { score_pct: 45, attendance_pct: 75, missing_homework: 0 } });
    expect(bad.status).toBe(400);
    const saved = await call('PUT', '/scores/settings', s.ownerToken, { at_risk: { score_pct: 45, attendance_pct: 75, missing_homework: 1 }, show_rank: true });
    expect(saved.body.payload).toEqual({ at_risk: { score_pct: 45, attendance_pct: 75, missing_homework: 1 }, show_rank: true });
    const rafi = (await call<Scores>('GET', `/scores/sections/${s.sectionId}?term_id=${s.term.id}`, s.rinaToken)).body.payload.students.find((x) => x.student.id === s.rafi.id)!;
    expect(rafi.at_risk).toEqual(['SCORE', 'ATTENDANCE', 'MISSING_HOMEWORK']);
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'performance.settings' } })).toBe(1);
  });

  it("shows a section's scores to its staff only, needs the performance feature, and keeps schools apart", async () => {
    const s = await school();
    const path = `/scores/sections/${s.sectionId}`;
    expect((await call('GET', path, s.karimToken)).status).toBe(200);
    expect((await call('GET', path, s.linaToken)).status).toBe(404);
    expect((await call('GET', path, s.mituToken)).status).toBe(403);
    expect((await call('GET', `${path}?term_id=${s.sessionId}`, s.ownerToken)).status).toBe(404);
    const other = await school();
    expect((await call('GET', path, other.ownerToken)).status).toBe(404);
    expect((await call('PUT', '/scores/weights', other.ownerToken, { session_id: s.sessionId, class_id: s.classId, exams_pct: 100, homework_pct: 0, attendance_pct: 0, behaviour_pct: 0 })).status).toBe(404);
    const off = await school({ performanceOn: false });
    expect((await call('GET', `/scores/sections/${off.sectionId}`, off.ownerToken)).status).toBe(403);
  });
});
