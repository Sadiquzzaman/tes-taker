import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { HomeworkEntity } from 'src/homework/entities/homework.entity';
import { HomeworkService } from 'src/homework/homework.service';
import { IeltsProfilesService } from 'src/ielts/ielts-profiles.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService, PlagiarismThresholds } from 'src/organizations/org-settings.service';
import { IntegrityScopeDto, PlagiarismThresholdsDto, ReviewMatchDto } from './dto/integrity.dto';
import { SimilarityCheckEntity, SimilarityScopeEnum } from './entities/similarity-check.entity';
import { MatchSpans, ReviewDecisionEnum, SimilarityMatchEntity } from './entities/similarity-match.entity';
import { INTEGRITY_ERRORS } from './integrity-errors';
import { compare, Span, words } from './similarity';

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

export type SimilarityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
/** Why a submission was not compared: too short, no text, only a handwritten photo, or only files (Word/PDF reading comes later). */
export type NotChecked = 'TOO_SHORT' | 'NO_TEXT' | 'HANDWRITTEN_IMAGE' | 'FILE_NOT_READ';

/** A text to compare: a homework submission or an IELTS Writing script. */
interface Text {
  submission_id: string;
  student_id: string;
  /** IELTS Writing: scripts are compared task by task. */
  part_no: number | null;
  text: string;
  not_checked: NotChecked | null;
}

export interface IntegrityReport {
  check: { id: string; ran_at: Date; ran_by: string | null; submissions: number } | null;
  thresholds: PlagiarismThresholds;
  submissions: {
    submission_id: string;
    student: { id: string; full_name: string };
    part_no: number | null;
    words: number;
    not_checked: NotChecked | null;
    percent: number;
    level: SimilarityLevel | null;
    /** The classmates with the most shared text, most first. */
    most_similar: { match_id: string; student: { id: string; full_name: string }; percent: number }[];
  }[];
  matches: {
    id: string;
    part_no: number | null;
    a: { student: { id: string; full_name: string }; percent: number };
    b: { student: { id: string; full_name: string }; percent: number };
    score: number;
    level: SimilarityLevel;
    review_decision: ReviewDecisionEnum | null;
    review_note: string | null;
  }[];
}

export interface MatchView {
  id: string;
  part_no: number | null;
  level: SimilarityLevel;
  score: number;
  a: { student: { id: string; full_name: string }; text: string; spans: Span[]; percent: number };
  b: { student: { id: string; full_name: string }; text: string; spans: Span[]; percent: number };
  review_decision: ReviewDecisionEnum | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

/** Plain text of a typed answer (the editor may send HTML). */
export const plainText = (value: string | null): string =>
  (value ?? '')
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Plagiarism checks (Epic 10, PLG-01–03): each text submission of a homework (the latest
 * version of each student) or of an IELTS opening's Writing (task by task) is compared with the
 * others; a pair's matching passages are kept for a side-by-side view, and teachers record
 * "Reviewed — OK" or "Copied" with a note. Staff only, never students; nothing changes a score.
 * Runs on demand, or by itself the first time results are opened after the due date.
 */
@Injectable()
export class IntegrityService {
  constructor(
    @InjectRepository(SimilarityCheckEntity) private readonly checks: Repository<SimilarityCheckEntity>,
    @InjectRepository(SimilarityMatchEntity) private readonly matches: Repository<SimilarityMatchEntity>,
    private readonly dataSource: DataSource,
    private readonly homework: HomeworkService,
    private readonly ielts: IeltsProfilesService,
    private readonly settings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Staff: the latest results for a scope; runs the check first when none exists and the due date has passed. */
  async latest(tenant: Tenant, userId: string, scope: IntegrityScopeDto): Promise<IntegrityReport> {
    const due = await this.access(tenant, userId, scope);
    let check = await this.checks.findOne({ where: { organization_id: tenant.organizationId, scope_type: scope.scope_type, scope_id: scope.scope_id }, order: { ran_at: 'DESC' } });
    if (!check && due && due.getTime() < Date.now()) check = await this.execute(tenant, scope, null);
    return this.report(tenant, scope, check);
  }

  /** Staff: compare the scope's submissions now. */
  async run(tenant: Tenant, userId: string, scope: IntegrityScopeDto): Promise<IntegrityReport> {
    await this.access(tenant, userId, scope);
    const check = await this.execute(tenant, scope, userId);
    return this.report(tenant, scope, check);
  }

  /** Staff: two submissions side by side with their matching passages. */
  async match(tenant: Tenant, userId: string, matchId: string): Promise<MatchView> {
    const { match, check } = await this.findMatch(tenant, userId, matchId);
    const texts = await this.texts(tenant, { scope_type: check.scope_type, scope_id: check.scope_id }, [match.submission_a, match.submission_b]);
    const text = (id: string) => texts.find((t) => t.submission_id === id)?.text ?? '';
    const names = await this.names([match.student_a, match.student_b]);
    const thresholds = await this.settings.getPlagiarism(tenant.organizationId);
    const score = Number(match.score);
    return {
      id: match.id,
      part_no: match.spans.part_no ?? null,
      level: this.level(score, thresholds) as SimilarityLevel,
      score,
      a: { student: { id: match.student_a, full_name: names.get(match.student_a) ?? '' }, text: text(match.submission_a), spans: match.spans.a, percent: match.spans.a_percent },
      b: { student: { id: match.student_b, full_name: names.get(match.student_b) ?? '' }, text: text(match.submission_b), spans: match.spans.b, percent: match.spans.b_percent },
      review_decision: match.review_decision,
      review_note: match.review_note,
      reviewed_by: match.reviewed_by,
      reviewed_at: match.reviewed_at,
    };
  }

  /** Staff: "Reviewed — OK" or "Copied" with a note (audited; scores are not touched). */
  async review(tenant: Tenant, userId: string, matchId: string, dto: ReviewMatchDto): Promise<MatchView> {
    const { match } = await this.findMatch(tenant, userId, matchId);
    await this.matches.update({ id: match.id }, { review_decision: dto.decision, review_note: dto.note?.trim() || null, reviewed_by: userId, reviewed_at: new Date() });
    this.audit.record({
      action: AUDIT_ACTIONS.INTEGRITY_REVIEW,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'similarity_match',
      entityId: match.id,
      before: { decision: match.review_decision, note: match.review_note },
      after: { decision: dto.decision, note: dto.note?.trim() || null },
    });
    return this.match(tenant, userId, matchId);
  }

  /** Staff: the thresholds. */
  async getSettings(tenant: Tenant): Promise<PlagiarismThresholds> {
    this.assertStaff(tenant);
    return this.settings.getPlagiarism(tenant.organizationId);
  }

  /** Owners and admins: set the thresholds (audited). */
  async updateSettings(tenant: Tenant, userId: string, dto: PlagiarismThresholdsDto): Promise<PlagiarismThresholds> {
    if (!MANAGERS.includes(tenant.memberRole) || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only owners and admins can change this', code: INTEGRITY_ERRORS.MANAGERS_ONLY });
    }
    if (dto.medium < 1 || dto.high > 100 || dto.medium >= dto.high || dto.min_words < 0 || dto.min_words > 1000) {
      throw new BadRequestException({ message: 'High must be above Medium (1 to 100); fewest words 0 to 1000', code: INTEGRITY_ERRORS.THRESHOLDS_INVALID });
    }
    const thresholds = { high: dto.high, medium: dto.medium, min_words: dto.min_words };
    const { before, after } = await this.settings.updatePlagiarism(tenant.organizationId, userId, thresholds);
    this.audit.record({ action: AUDIT_ACTIONS.INTEGRITY_SETTINGS, organizationId: tenant.organizationId, actorId: userId, entityType: 'org_settings', entityId: tenant.organizationId, before: { ...before }, after: { ...after } });
    return after;
  }

  // ------------------------------------------------------------------ helpers

  private assertStaff(tenant: Tenant): void {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can see plagiarism checks', code: INTEGRITY_ERRORS.STAFF_ONLY });
    }
  }

  /** The caller may see the scope (the homework's teachers and managers; IELTS centre staff). Returns when it is due. */
  private async access(tenant: Tenant, userId: string, scope: IntegrityScopeDto): Promise<Date | null> {
    this.assertStaff(tenant);
    if (scope.scope_type === SimilarityScopeEnum.HOMEWORK) {
      const homework = await this.dataSource.getRepository(HomeworkEntity).findOne({ where: { id: scope.scope_id, organization_id: tenant.organizationId } });
      if (!homework || !(await this.homework.canSee(tenant, userId, homework))) this.notFound();
      return homework.due_at;
    }
    await this.ielts.assertIeltsCentre(tenant);
    const [opening]: { closes_at: Date }[] = await this.dataSource.query(`SELECT closes_at FROM ielts_assignments WHERE id = $1 AND organization_id = $2`, [scope.scope_id, tenant.organizationId]);
    if (!opening) this.notFound();
    return opening.closes_at;
  }

  /** The texts of a scope (or just some submissions of it). */
  private async texts(tenant: Tenant, scope: IntegrityScopeDto, only?: string[]): Promise<Text[]> {
    if (scope.scope_type === SimilarityScopeEnum.HOMEWORK) {
      const rows: { id: string; student_id: string; text_answer: string | null; images: number; files: number }[] = await this.dataSource.query(
        `SELECT s.id, s.student_id, s.text_answer,
                (SELECT count(*)::int FROM submission_files sf JOIN file_objects f ON f.id = sf.file_id WHERE sf.submission_id = s.id AND f.mime LIKE 'image/%') AS images,
                (SELECT count(*)::int FROM submission_files sf WHERE sf.submission_id = s.id) AS files
           FROM homework_submissions s
          WHERE s.homework_id = $1 AND s.organization_id = $2
            AND ($3::uuid[] IS NULL AND s.version = (SELECT max(v.version) FROM homework_submissions v WHERE v.homework_id = s.homework_id AND v.student_id = s.student_id)
                 OR s.id = ANY($3::uuid[]))`,
        [scope.scope_id, tenant.organizationId, only ?? null],
      );
      return rows.map((r) => {
        const text = plainText(r.text_answer);
        const notChecked: NotChecked | null = text ? null : r.files && r.images === r.files ? 'HANDWRITTEN_IMAGE' : r.files ? 'FILE_NOT_READ' : 'NO_TEXT';
        return { submission_id: r.id, student_id: r.student_id, part_no: null, text, not_checked: notChecked };
      });
    }
    const rows: { id: string; student_id: string; part_no: number; answer: string | null }[] = await this.dataSource.query(
      `SELECT ans.id, a.student_id, p.part_no, ans.answer
         FROM ielts_answers ans
         JOIN ielts_attempts a ON a.id = ans.attempt_id
         JOIN ielts_test_parts p ON p.id = ans.part_id
        WHERE a.assignment_id = $1 AND a.organization_id = $2 AND a.module = 'WRITING' AND a.status <> 'IN_PROGRESS' AND ans.question_id IS NULL
          AND ($3::uuid[] IS NULL OR ans.id = ANY($3::uuid[]))`,
      [scope.scope_id, tenant.organizationId, only ?? null],
    );
    return rows.map((r) => {
      const text = plainText(r.answer);
      return { submission_id: r.id, student_id: r.student_id, part_no: r.part_no, text, not_checked: text ? null : 'NO_TEXT' };
    });
  }

  /** Compares every pair of long-enough texts (same task for IELTS) and keeps the pairs that share passages. */
  private async execute(tenant: Tenant, scope: IntegrityScopeDto, userId: string | null): Promise<SimilarityCheckEntity> {
    const thresholds = await this.settings.getPlagiarism(tenant.organizationId);
    const texts = (await this.texts(tenant, scope)).filter((t) => !t.not_checked && words(t.text).length >= thresholds.min_words);
    return this.dataSource.transaction(async (manager) => {
      const check = await manager.getRepository(SimilarityCheckEntity).save(
        manager.getRepository(SimilarityCheckEntity).create({ organization_id: tenant.organizationId, scope_type: scope.scope_type, scope_id: scope.scope_id, submissions: texts.length, ran_by: userId }),
      );
      const found: SimilarityMatchEntity[] = [];
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const [a, b] = [texts[i], texts[j]];
          if (a.student_id === b.student_id || a.part_no !== b.part_no) continue;
          const result = compare(a.text, b.text);
          const score = Math.max(result.a_percent, result.b_percent);
          if (score <= 0) continue;
          const spans: MatchSpans = { a: result.a_spans, b: result.b_spans, a_percent: result.a_percent, b_percent: result.b_percent, ...(a.part_no !== null ? { part_no: a.part_no } : {}) };
          found.push(
            manager.getRepository(SimilarityMatchEntity).create({
              check_id: check.id,
              organization_id: tenant.organizationId,
              submission_a: a.submission_id,
              submission_b: b.submission_id,
              student_a: a.student_id,
              student_b: b.student_id,
              score: score.toFixed(2),
              spans,
            }),
          );
        }
      }
      if (found.length) await manager.getRepository(SimilarityMatchEntity).save(found);
      return check;
    });
  }

  private async report(tenant: Tenant, scope: IntegrityScopeDto, check: SimilarityCheckEntity | null): Promise<IntegrityReport> {
    const thresholds = await this.settings.getPlagiarism(tenant.organizationId);
    const texts = await this.texts(tenant, scope);
    const rows = check ? await this.matches.find({ where: { check_id: check.id }, order: { score: 'DESC' } }) : [];
    const names = await this.names([...texts.map((t) => t.student_id), ...rows.flatMap((m) => [m.student_a, m.student_b])]);
    const student = (id: string) => ({ id, full_name: names.get(id) ?? '' });
    const submissions = texts
      .map((t) => {
        const count = words(t.text).length;
        const notChecked: NotChecked | null = t.not_checked ?? (count < thresholds.min_words ? 'TOO_SHORT' : null);
        const mine = rows
          .filter((m) => m.submission_a === t.submission_id || m.submission_b === t.submission_id)
          .map((m) => {
            const isA = m.submission_a === t.submission_id;
            return { match_id: m.id, student: student(isA ? m.student_b : m.student_a), percent: isA ? m.spans.a_percent : m.spans.b_percent };
          })
          .sort((x, y) => y.percent - x.percent);
        const percent = mine[0]?.percent ?? 0;
        return {
          submission_id: t.submission_id,
          student: student(t.student_id),
          part_no: t.part_no,
          words: count,
          not_checked: notChecked,
          percent,
          level: notChecked || !check ? null : this.level(percent, thresholds),
          most_similar: mine.slice(0, 3),
        };
      })
      // Most similar first; texts that were not checked last.
      .sort((x, y) => Number(!!x.not_checked) - Number(!!y.not_checked) || y.percent - x.percent || x.student.full_name.localeCompare(y.student.full_name));
    return {
      check: check ? { id: check.id, ran_at: check.ran_at, ran_by: check.ran_by, submissions: check.submissions } : null,
      thresholds,
      submissions,
      matches: rows.map((m) => ({
        id: m.id,
        part_no: m.spans.part_no ?? null,
        a: { student: student(m.student_a), percent: m.spans.a_percent },
        b: { student: student(m.student_b), percent: m.spans.b_percent },
        score: Number(m.score),
        level: this.level(Number(m.score), thresholds),
        review_decision: m.review_decision,
        review_note: m.review_note,
      })),
    };
  }

  private level(percent: number, t: PlagiarismThresholds): SimilarityLevel {
    return percent >= t.high ? 'HIGH' : percent >= t.medium ? 'MEDIUM' : 'LOW';
  }

  private async findMatch(tenant: Tenant, userId: string, matchId: string): Promise<{ match: SimilarityMatchEntity; check: SimilarityCheckEntity }> {
    this.assertStaff(tenant);
    const match = await this.matches.findOne({ where: { id: matchId, organization_id: tenant.organizationId } });
    if (!match) throw new NotFoundException({ message: 'Match not found', code: INTEGRITY_ERRORS.MATCH_NOT_FOUND });
    const check = await this.checks.findOneOrFail({ where: { id: match.check_id } });
    await this.access(tenant, userId, { scope_type: check.scope_type, scope_id: check.scope_id });
    return { match, check };
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1::uuid[])`, [[...new Set(ids)]]);
    return new Map(rows.map((r) => [r.id, r.full_name]));
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Not found', code: INTEGRITY_ERRORS.SCOPE_NOT_FOUND });
  }
}
