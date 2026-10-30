import { DeepPartial } from 'typeorm';
import { currentYearIn } from '../../src/academics/academic-sessions.service';
import { ClassSubjectEntity } from '../../src/classes/entities/class-subject.entity';
import { ClassKindEnum } from '../../src/classes/enums/class-kind.enum';
import { AcademicStructure1755400000000 } from '../../src/migrations/1755400000000-AcademicStructure';
import { ExamSubjectClasses1755410000000 } from '../../src/migrations/1755410000000-ExamSubjectClasses';
import { DropLegacyClassTables1755420000000 } from '../../src/migrations/1755420000000-DropLegacyClassTables';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration M3 (P2-03) on data shaped like beta before the change: classes with students
 * (joined, pending, invited), class subjects, subject teachers and class teachers with and without
 * a subject, and exams. The new tables are dropped (down) and rebuilt from the legacy ones (up),
 * twice: the second run must change nothing.
 */
describe('AcademicStructure migration', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => t.dataSource.query(sql, params);

  it('builds sessions, sections, enrolments and subject classes from the legacy tables, once', async () => {
    // Before: a school and a solo teacher, as on beta.
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const [subjectTeacher, classTeacher, laterClassTeacher] = [await make.teacher(), await make.teacher(), await make.teacher()];
    for (const user of [subjectTeacher, classTeacher, laterClassTeacher]) await make.member(school, user, OrganizationMemberRoleEnum.TEACHER);
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'M-1', organization_id: school.id } as DeepPartial<SubjectEntity>);
    const physics = await subjects.save({ name: 'Physics', code: 'P-1', organization_id: school.id } as DeepPartial<SubjectEntity>);
    const schoolClass = await make.classOf(owner, { organization_id: school.id, class_kind: ClassKindEnum.ORGANIZATION });

    const solo = await make.teacher();
    const coTeacher = await make.teacher();
    const soloClass = await make.classOf(solo);
    const soloOrg = await make.soloOrganization(solo);

    // Back before P2-03's contract step: the legacy tables exist again (empty here).
    const runner = t.dataSource.createQueryRunner();
    const dropLegacy = new DropLegacyClassTables1755420000000();
    const examSubjectClasses = new ExamSubjectClasses1755410000000();
    const migration = new AcademicStructure1755400000000();
    await dropLegacy.down(runner);
    const insert = async (table: string, row: Record<string, unknown>): Promise<string> => {
      const columns = Object.keys(row);
      const [{ id }] = await runner.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
        Object.values(row),
      );
      return id;
    };

    const classSubjects = t.dataSource.getRepository(ClassSubjectEntity);
    const mathLink = await classSubjects.save({ class_id: schoolClass.id, subject_id: math.id });
    await classSubjects.save({ class_id: schoolClass.id, subject_id: physics.id });
    await classSubjects.save({ class_id: soloClass.id, subject_id: math.id });

    // Math has the same teacher twice (subject teacher and class teacher with that subject).
    await insert('class_subject_teachers', { class_subject_id: mathLink.id, teacher_id: subjectTeacher.id });
    await insert('class_teachers', { class_id: schoolClass.id, teacher_id: subjectTeacher.id, subject_id: math.id });
    // Two class teachers without a subject: the earlier one becomes section A's class teacher.
    await insert('class_teachers', { class_id: schoolClass.id, teacher_id: classTeacher.id, created_at: new Date(Date.now() - 60_000) });
    await insert('class_teachers', { class_id: schoolClass.id, teacher_id: laterClassTeacher.id, created_at: new Date() });
    // In a solo workspace class teachers are off: the co-teacher only teaches.
    await insert('class_teachers', { class_id: soloClass.id, teacher_id: coTeacher.id });

    const [joined, pending] = [await make.student(), await make.student()];
    // class_students.joined_at is a timestamp without time zone in the API process's zone.
    const joinedRow = {
      id: await insert('class_students', { class_id: schoolClass.id, student_id: joined.id, status: 'JOINED', joined_at: new Date('2026-03-01T04:00:00Z') }),
    };
    const pendingRow = { id: await insert('class_students', { class_id: schoolClass.id, student_id: pending.id, status: 'PENDING' }) };
    const invitedRow = {
      id: await insert('class_students', {
        class_id: soloClass.id,
        status: 'INVITED',
        invited_email: 'invitee@test.local',
        invitation_token: 'token-for-test',
      }),
    };
    const schoolExam = await make.openExam(owner, { organization_id: school.id, class_id: schoolClass.id });
    const soloExam = await make.openExam(solo);

    // Back to the shape before P2-03 (no new tables, no exams.session_id), then forward again, twice.
    try {
      await examSubjectClasses.down(runner);
      await migration.down(runner);
      const [{ exists }] = await runner.query(`SELECT to_regclass('public.enrolments') IS NOT NULL AS exists`);
      expect(exists).toBe(false);
      await migration.up(runner);
      await migration.up(runner);
      await examSubjectClasses.up(runner);
      await examSubjectClasses.up(runner);
    } finally {
      await runner.release();
    }

    // One default session per organisation: this year.
    const year = currentYearIn('Asia/Dhaka');
    const sessions = await q<{ id: string; organization_id: string; name: string; is_default: boolean }>(
      `SELECT id, organization_id, name, is_default FROM academic_sessions WHERE organization_id = ANY($1)`,
      [[school.id, soloOrg.id]],
    );
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.is_default && s.name === String(year))).toBe(true);
    const sessionOf = (organizationId: string) => sessions.find((s) => s.organization_id === organizationId)?.id;

    // Settings by kind.
    const settings = await q<{ organization_id: string; class_teacher_enabled: boolean }>(
      `SELECT organization_id, class_teacher_enabled FROM org_settings WHERE organization_id = ANY($1)`,
      [[school.id, soloOrg.id]],
    );
    expect(Object.fromEntries(settings.map((s) => [s.organization_id, s.class_teacher_enabled]))).toEqual({ [school.id]: true, [soloOrg.id]: false });

    // Section "A" per class; the earliest class teacher without a subject where class teachers are on.
    const sections = await q<{ id: string; class_id: string; name: string; session_id: string; class_teacher_id: string | null }>(
      `SELECT id, class_id, name, session_id, class_teacher_id FROM sections WHERE class_id = ANY($1)`,
      [[schoolClass.id, soloClass.id]],
    );
    expect(sections).toHaveLength(2);
    const schoolSection = sections.find((s) => s.class_id === schoolClass.id)!;
    const soloSection = sections.find((s) => s.class_id === soloClass.id)!;
    expect(schoolSection).toMatchObject({ name: 'A', session_id: sessionOf(school.id), class_teacher_id: classTeacher.id });
    expect(soloSection).toMatchObject({ name: 'A', session_id: sessionOf(soloOrg.id), class_teacher_id: null });

    // class_students -> enrolments: same ids, status kept (JOINED = ACTIVE), invitation kept.
    const enrolments = await q<{ id: string; section_id: string; student_id: string | null; status: string; invited_email: string | null; joined_at: Date | null }>(
      `SELECT id, section_id, student_id, status, invited_email, joined_at FROM enrolments WHERE class_id = ANY($1) ORDER BY status`,
      [[schoolClass.id, soloClass.id]],
    );
    expect(enrolments).toHaveLength(3);
    expect(enrolments.find((e) => e.id === joinedRow.id)).toMatchObject({ section_id: schoolSection.id, student_id: joined.id, status: 'ACTIVE' });
    expect(enrolments.find((e) => e.id === joinedRow.id)?.joined_at?.toISOString()).toBe('2026-03-01T04:00:00.000Z');
    expect(enrolments.find((e) => e.id === pendingRow.id)).toMatchObject({ student_id: pending.id, status: 'PENDING' });
    expect(enrolments.find((e) => e.id === invitedRow.id)).toMatchObject({
      section_id: soloSection.id,
      student_id: null,
      status: 'INVITED',
      invited_email: 'invitee@test.local',
    });

    // One subject class per section + class subject, teachers deduplicated; a class teacher
    // without a subject teaches every subject of the class.
    const teachers = await q<{ section_id: string; subject_id: string; teachers: string[] }>(
      `SELECT o.section_id, o.subject_id, COALESCE(array_agg(t.teacher_id::text ORDER BY t.teacher_id) FILTER (WHERE t.id IS NOT NULL), '{}') AS teachers
       FROM course_offerings o LEFT JOIN offering_teachers t ON t.offering_id = o.id
       WHERE o.section_id = ANY($1) GROUP BY o.section_id, o.subject_id`,
      [[schoolSection.id, soloSection.id]],
    );
    const teachersOf = (sectionId: string, subjectId: string) => teachers.find((row) => row.section_id === sectionId && row.subject_id === subjectId)?.teachers;
    expect(teachers).toHaveLength(3);
    expect(teachersOf(schoolSection.id, math.id)).toEqual([subjectTeacher.id, classTeacher.id, laterClassTeacher.id].sort());
    expect(teachersOf(schoolSection.id, physics.id)).toEqual([classTeacher.id, laterClassTeacher.id].sort());
    expect(teachersOf(soloSection.id, math.id)).toEqual([coTeacher.id]);

    // Exams belong to their organisation's default session.
    const exams = await q<{ id: string; session_id: string }>(`SELECT id, session_id FROM exams WHERE id = ANY($1)`, [[schoolExam.id, soloExam.id]]);
    expect(Object.fromEntries(exams.map((e) => [e.id, e.session_id]))).toEqual({
      [schoolExam.id]: sessionOf(school.id),
      [soloExam.id]: sessionOf(soloOrg.id),
    });

    // Count check, as the migration logs it: legacy rows = new rows.
    const [counts] = await q<{ class_students: number; enrolments: number }>(
      `SELECT (SELECT COUNT(*) FROM class_students)::int AS class_students, (SELECT COUNT(*) FROM enrolments)::int AS enrolments`,
    );
    expect(counts.enrolments).toBe(counts.class_students);
    expect(console.log).toHaveBeenCalledWith('[AcademicStructure] legacy:', expect.any(Object), '-> new:', expect.any(Object));

    // The contract step drops the legacy tables (twice is harmless) and keeps every enrolment.
    const contract = t.dataSource.createQueryRunner();
    try {
      await new DropLegacyClassTables1755420000000().up(contract);
      await new DropLegacyClassTables1755420000000().up(contract);
    } finally {
      await contract.release();
    }
    const [tables] = await q<{ students: boolean; teachers: boolean; subject_teachers: boolean }>(
      `SELECT to_regclass('public.class_students') IS NOT NULL AS students, to_regclass('public.class_teachers') IS NOT NULL AS teachers,
              to_regclass('public.class_subject_teachers') IS NOT NULL AS subject_teachers`,
    );
    expect(tables).toEqual({ students: false, teachers: false, subject_teachers: false });
    expect(await q(`SELECT id FROM enrolments WHERE id = ANY($1)`, [[joinedRow.id, pendingRow.id, invitedRow.id]])).toHaveLength(3);
  });

  it('refuses to drop the legacy tables while a class student has no enrolment', async () => {
    const teacher = await make.teacher();
    const classRow = await make.classOf(teacher);
    const runner = t.dataSource.createQueryRunner();
    const dropLegacy = new DropLegacyClassTables1755420000000();
    try {
      await dropLegacy.down(runner);
      const [{ id }] = await runner.query(`INSERT INTO class_students (class_id, status) VALUES ($1, 'INVITED') RETURNING id`, [classRow.id]);
      await expect(dropLegacy.up(runner)).rejects.toThrow(/have no enrolment; nothing dropped/);
      const [{ present }] = await runner.query(`SELECT to_regclass('public.class_students') IS NOT NULL AS present`);
      expect(present).toBe(true);

      // Once the row is accounted for, the drop goes through.
      await runner.query(`DELETE FROM class_students WHERE id = $1`, [id]);
      await dropLegacy.up(runner);
    } finally {
      await runner.release();
    }
  });
});
