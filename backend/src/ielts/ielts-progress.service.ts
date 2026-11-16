import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { overallBand } from './bands';
import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsAttemptsService, totalOf } from './ielts-attempts.service';
import { IeltsTestsService } from './ielts-tests.service';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService, IeltsProfileView } from './ielts-profiles.service';
import { MODULE_ORDER } from './ielts-templates';

const FOUR = MODULE_ORDER;

export interface IeltsBandPoint {
  attempt_id: string;
  assignment_id: string;
  test_title: string;
  purpose: string;
  band: number;
  raw_score: number | null;
  /** What the score is out of (40 in a full test); null for Writing and Speaking. */
  raw_total: number | null;
  at: Date;
}

export interface IeltsProgress {
  profile: IeltsProfileView;
  /** Bands over time per module, oldest first. */
  modules: Record<IeltsModuleEnum, IeltsBandPoint[]>;
  /** Mocks with all four modules marked: the overall band. */
  mocks: { assignment_id: string; test_title: string; bands: Record<IeltsModuleEnum, number>; overall: number; at: Date }[];
  /** Listening and Reading question types, weakest first (marks out of the numbers they take). */
  question_types: { type: string; right: number; total: number; percent: number }[];
}

export interface IeltsStaffDashboard {
  batches: number;
  students: number;
  /** Openings of mocks starting in the next 7 days, or open now. */
  upcoming: { assignment_id: string; test_title: string; batch: string; opens_at: Date; closes_at: Date }[];
  waiting: { writing: number; speaking: number };
  /** Average band per module per batch over the last 90 days. */
  batch_bands: { section_id: string; batch: string; bands: Partial<Record<IeltsModuleEnum, number>> }[];
}

export interface IeltsStudentDashboard {
  profile: IeltsProfileView;
  latest: Partial<Record<IeltsModuleEnum, number>>;
  next: { assignment_id: string; test_title: string; purpose: string; opens_at: Date; closes_at: Date } | null;
  open_now: number;
}

export interface IeltsBandReport {
  student: { id: string; full_name: string; batch: string | null };
  test: { id: string; title: string; test_type: string; purpose: string };
  window: { opens_at: Date; closes_at: Date };
  modules: Partial<Record<IeltsModuleEnum, { band: number | null; raw_score: number | null; raw_total: number | null; status: string; criteria: Record<string, unknown> | null; feedback: string | null }>>;
  overall: number | null;
  targets: { overall: number | null; bands: Partial<Record<IeltsModuleEnum, number>> };
  test_date: string | null;
}

/**
 * IELTS progress and overviews (IEL-01, IEL-08, IEL-09, IEL-10): bands over time against the
 * target, the overall band of complete mocks, the weakest question types, the staff and student
 * dashboards, and the one-page band report (printed by the browser).
 */
@Injectable()
export class IeltsProgressService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly attempts: IeltsAttemptsService,
    private readonly tests: IeltsTestsService,
  ) {}

  /** A student's progress: staff for any student of the centre, a student for themselves. */
  async progress(tenant: Tenant, userId: string, studentId: string): Promise<IeltsProgress> {
    const profile = await this.profiles.get(tenant, userId, studentId);
    await this.attempts.finishExpired({ studentId });
    const rows: { id: string; test_id: string; assignment_id: string; module: IeltsModuleEnum; band: number; raw_score: number | null; at: Date; title: string; purpose: string }[] = await this.dataSource.query(
      `SELECT a.id, a.test_id, a.assignment_id, a.module, a.band::float AS band, a.raw_score, COALESCE(a.submitted_at, a.marked_at) AS at, t.title, t.purpose
         FROM ielts_attempts a JOIN ielts_tests t ON t.id = a.test_id
        WHERE a.organization_id = $1 AND a.student_id = $2 AND a.status = 'MARKED' AND a.band IS NOT NULL
        ORDER BY at ASC`,
      [tenant.organizationId, studentId],
    );
    const modules = Object.fromEntries(FOUR.map((m) => [m, [] as IeltsBandPoint[]])) as Record<IeltsModuleEnum, IeltsBandPoint[]>;
    const totals = await this.tests.numberTotals(rows.map((r) => r.test_id));
    for (const r of rows) {
      modules[r.module].push({ attempt_id: r.id, assignment_id: r.assignment_id, test_title: r.title, purpose: r.purpose, band: r.band, raw_score: r.raw_score, raw_total: totalOf(totals, r), at: r.at });
    }
    const byOpening = new Map<string, typeof rows>();
    for (const r of rows.filter((x) => x.purpose === 'MOCK')) byOpening.set(r.assignment_id, [...(byOpening.get(r.assignment_id) ?? []), r]);
    const mocks = [...byOpening.entries()]
      .filter(([, list]) => FOUR.every((m) => list.some((r) => r.module === m)))
      .map(([assignmentId, list]) => {
        const bands = Object.fromEntries(FOUR.map((m) => [m, (list.find((r) => r.module === m) as (typeof rows)[number]).band])) as Record<IeltsModuleEnum, number>;
        return { assignment_id: assignmentId, test_title: list[0].title, bands, overall: overallBand(Object.values(bands)), at: list.reduce((last, r) => (r.at > last ? r.at : last), list[0].at) };
      });
    const types: { type: string; right: string; total: string }[] = await this.dataSource.query(
      `SELECT g.type, SUM(ans.marks)::int AS right,
              SUM(CASE WHEN g.type = 'MCQ_MULTI' THEN jsonb_array_length(q.answer->'keys') ELSE 1 END)::int AS total
         FROM ielts_attempts a
         JOIN ielts_test_parts p ON p.test_id = a.test_id AND p.module = a.module
         JOIN ielts_question_groups g ON g.part_id = p.id AND g.deleted_at IS NULL
         JOIN ielts_questions q ON q.group_id = g.id AND q.deleted_at IS NULL
         LEFT JOIN ielts_answers ans ON ans.attempt_id = a.id AND ans.question_id = q.id
        WHERE a.organization_id = $1 AND a.student_id = $2 AND a.status = 'MARKED' AND a.module IN ('LISTENING', 'READING')
        GROUP BY g.type`,
      [tenant.organizationId, studentId],
    );
    const questionTypes = types
      .map((r) => {
        const right = Number(r.right ?? 0);
        const total = Number(r.total);
        return { type: r.type, right, total, percent: total ? Math.round((right / total) * 100) : 0 };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.percent - b.percent || b.total - a.total);
    return { profile, modules, mocks, question_types: questionTypes };
  }

  /** Staff: batches and students, upcoming mocks, Writing and Speaking waiting, average band per module per batch. */
  async staffDashboard(tenant: Tenant): Promise<IeltsStaffDashboard> {
    this.assertStaff(tenant);
    await this.profiles.assertIeltsCentre(tenant);
    await this.attempts.finishExpired({ organizationId: tenant.organizationId });
    const [counts]: { batches: number; students: number }[] = await this.dataSource.query(
      `SELECT count(DISTINCT s.id)::int AS batches, count(DISTINCT e.student_id)::int AS students
         FROM sections s JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
         LEFT JOIN enrolments e ON e.section_id = s.id AND e.status = 'ACTIVE'
        WHERE s.organization_id = $1`,
      [tenant.organizationId],
    );
    const upcoming: IeltsStaffDashboard['upcoming'] = await this.dataSource.query(
      `SELECT g.id AS assignment_id, t.title AS test_title, trim(concat(c.class_name, ' ', s.name)) AS batch, g.opens_at, g.closes_at
         FROM ielts_assignments g JOIN ielts_tests t ON t.id = g.test_id AND t.purpose = 'MOCK' AND t.deleted_at IS NULL
         JOIN sections s ON s.id = g.section_id JOIN classes c ON c.id = s.class_id
        WHERE g.organization_id = $1 AND g.deleted_at IS NULL AND g.closes_at > now() AND g.opens_at < now() + interval '7 days'
        ORDER BY g.opens_at ASC LIMIT 20`,
      [tenant.organizationId],
    );
    const waiting: { module: string; n: number }[] = await this.dataSource.query(
      `SELECT module, count(*)::int AS n FROM ielts_attempts WHERE organization_id = $1 AND status = 'SUBMITTED' AND module IN ('WRITING', 'SPEAKING') GROUP BY module`,
      [tenant.organizationId],
    );
    const bands: { section_id: string; batch: string; module: IeltsModuleEnum; band: number }[] = await this.dataSource.query(
      `SELECT g.section_id, trim(concat(c.class_name, ' ', s.name)) AS batch, a.module, avg(a.band)::float AS band
         FROM ielts_attempts a JOIN ielts_assignments g ON g.id = a.assignment_id
         JOIN sections s ON s.id = g.section_id JOIN classes c ON c.id = s.class_id
        WHERE a.organization_id = $1 AND a.status = 'MARKED' AND a.band IS NOT NULL AND COALESCE(a.submitted_at, a.marked_at) > now() - interval '90 days'
        GROUP BY g.section_id, batch, a.module
        ORDER BY batch`,
      [tenant.organizationId],
    );
    const batchBands = new Map<string, IeltsStaffDashboard['batch_bands'][number]>();
    for (const b of bands) {
      const row = batchBands.get(b.section_id) ?? { section_id: b.section_id, batch: b.batch, bands: {} };
      row.bands[b.module] = Math.round(b.band * 10) / 10;
      batchBands.set(b.section_id, row);
    }
    return {
      batches: counts?.batches ?? 0,
      students: counts?.students ?? 0,
      upcoming,
      waiting: { writing: waiting.find((w) => w.module === 'WRITING')?.n ?? 0, speaking: waiting.find((w) => w.module === 'SPEAKING')?.n ?? 0 },
      batch_bands: [...batchBands.values()],
    };
  }

  /** A student's own overview: targets against the latest band per module, the countdown, the next test. */
  async studentDashboard(tenant: Tenant, userId: string): Promise<IeltsStudentDashboard> {
    const profile = await this.profiles.get(tenant, userId, userId);
    const progress = await this.progress(tenant, userId, userId);
    const latest = Object.fromEntries(FOUR.filter((m) => progress.modules[m].length).map((m) => [m, progress.modules[m][progress.modules[m].length - 1].band]));
    const mine = await this.attempts.listMine(tenant, userId);
    const now = Date.now();
    const upcoming = mine
      .filter((a) => new Date(a.closes_at).getTime() > now && a.test.modules.some((m) => !a.attempts[m] || a.attempts[m]?.status === 'IN_PROGRESS'))
      .sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime());
    const next = upcoming[0];
    return {
      profile,
      latest,
      next: next ? { assignment_id: next.id, test_title: next.test.title, purpose: next.test.purpose, opens_at: next.opens_at, closes_at: next.closes_at } : null,
      open_now: upcoming.filter((a) => a.is_open).length,
    };
  }

  /** The one-page band report for a student and an opening (IEL-10): staff, or the student for themselves. */
  async report(tenant: Tenant, userId: string, assignmentId: string, studentId: string): Promise<IeltsBandReport> {
    const profile = await this.profiles.get(tenant, userId, studentId);
    await this.attempts.finishExpired({ studentId });
    const [opening]: { test_id: string; title: string; test_type: string; purpose: string; opens_at: Date; closes_at: Date; modules: IeltsModuleEnum[] }[] = await this.dataSource.query(
      `SELECT g.test_id, t.title, t.test_type, t.purpose, g.opens_at, g.closes_at, t.modules
         FROM ielts_assignments g JOIN ielts_tests t ON t.id = g.test_id
        WHERE g.id = $1 AND g.organization_id = $2`,
      [assignmentId, tenant.organizationId],
    );
    if (!opening) throw new NotFoundException({ message: 'Opening not found', code: IELTS_ERRORS.ASSIGNMENT_NOT_FOUND });
    const attempts: { module: IeltsModuleEnum; band: number | null; raw_score: number | null; status: string; criteria: Record<string, unknown> | null; feedback: string | null }[] = await this.dataSource.query(
      `SELECT module, band::float AS band, raw_score, status, criteria, feedback FROM ielts_attempts WHERE assignment_id = $1 AND student_id = $2`,
      [assignmentId, studentId],
    );
    const totals = await this.tests.numberTotals([opening.test_id]);
    const modules = Object.fromEntries(
      opening.modules.map((m) => {
        const a = attempts.find((x) => x.module === m);
        // Bands only once marked; criteria and comments with them.
        const marked = a?.status === 'MARKED';
        return [
          m,
          {
            band: marked ? a.band : null,
            raw_score: marked ? a.raw_score : null,
            raw_total: totalOf(totals, { test_id: opening.test_id, module: m }),
            status: a?.status ?? 'NOT_STARTED',
            criteria: marked ? a.criteria : null,
            feedback: marked ? a.feedback : null,
          },
        ];
      }),
    ) as IeltsBandReport['modules'];
    const all = FOUR.map((m) => modules[m]?.band);
    const overall = opening.modules.length === 4 && all.every((b): b is number => typeof b === 'number') ? overallBand(all) : null;
    return {
      student: profile.student,
      test: { id: opening.test_id, title: opening.title, test_type: opening.test_type, purpose: opening.purpose },
      window: { opens_at: opening.opens_at, closes_at: opening.closes_at },
      modules,
      overall,
      targets: { overall: profile.target_overall, bands: profile.target_bands },
      test_date: profile.test_date,
    };
  }

  private assertStaff(tenant: Tenant): void {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
  }
}
