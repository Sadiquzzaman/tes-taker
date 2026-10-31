import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { normalizeEmail, normalizePhone } from 'src/common/utils/contact.util';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum } from 'src/notifications/notification.constants';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { LimitKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService, PlanLimitReachedException } from 'src/subscriptions/entitlements.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { AcademicSessionsService } from './academic-sessions.service';
import { GuardianInputDto } from './dto/guardian.dto';
import { StudentImportDto, StudentImportRowDto } from './dto/student-import.dto';
import { AcademicSessionEntity } from './entities/academic-session.entity';
import { EnrolmentEntity } from './entities/enrolment.entity';
import { GuardianEntity, GuardianRelationEnum } from './entities/guardian.entity';
import { SectionEntity } from './entities/section.entity';
import { CURRENT_ENROLMENT_STATUSES, openSessionCondition } from './enrolment-queries';
import { EnrolmentsService } from './enrolments.service';
import { GuardiansService } from './guardians.service';

interface Actor {
  id: string;
  full_name?: string | null;
}

/** Why a row cannot be imported; the web app shows each code in the user's language. */
export type ImportErrorCode =
  | 'NAME_REQUIRED'
  | 'NAME_TOO_LONG'
  | 'CONTACT_REQUIRED'
  | 'INVALID_PHONE'
  | 'INVALID_EMAIL'
  | 'SECTION_REQUIRED'
  | 'SECTION_NOT_FOUND'
  | 'ROLL_TOO_LONG'
  | 'ROLL_TAKEN'
  | 'DUPLICATE_IN_FILE'
  | 'ALREADY_IN_CLASS'
  | 'ALREADY_INVITED'
  | 'STAFF_ACCOUNT'
  | 'GUARDIAN_INCOMPLETE'
  | 'GUARDIAN_RELATION'
  | 'GUARDIAN_PHONE'
  | 'GUARDIAN_SAME_PHONE'
  | 'SAVE_FAILED';

/** Things that do not stop the row. GUARDIANS_KEPT: the student already has guardians here; the file's are not used. */
export type ImportWarningCode = 'GUARDIANS_KEPT';

export interface ImportIssue<C> {
  code: C;
  /** 1 or 2 when the issue is about a guardian. */
  guardian?: 1 | 2;
}

/** ENROL: an account that is verified; PENDING: an account waiting for verification; INVITE: no account yet. */
export type ImportPlan = 'ENROL' | 'PENDING' | 'INVITE';

export interface ImportRowResult {
  /** 1 = the first row under the header. */
  row: number;
  name: string;
  contact: string;
  section: string;
  roll_no: string | null;
  guardians: number;
  plan: ImportPlan | null;
  /** After the import only: what happened to the row. */
  outcome?: 'ENROLLED' | 'PENDING' | 'INVITED' | 'SKIPPED';
  errors: Array<ImportIssue<ImportErrorCode>>;
  warnings: Array<ImportIssue<ImportWarningCode>>;
}

export interface ImportSummary {
  session: { id: string; name: string };
  rows: ImportRowResult[];
  total: number;
  valid: number;
  invalid: number;
  /** The plan's max_students (0 = unlimited), the organisation's students now, and how many this adds. */
  limit: { max: number; current: number; adding: number; over: boolean };
  /** After the import only. */
  invitations_sent?: number;
}

/** A row that passed every check, ready to save. */
interface ValidRow {
  result: ImportRowResult;
  section: SectionEntity;
  student: UserEntity | null;
  name: string;
  phone: string | null;
  email: string | null;
  rollNo: string | null;
  guardians: GuardianInputDto[];
  keepGuardians: boolean;
}

const BD_MOBILE = /^01[3-9]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Relation words in a CSV, in English or Bangla. */
const RELATIONS: Record<string, GuardianRelationEnum> = {
  father: GuardianRelationEnum.FATHER,
  বাবা: GuardianRelationEnum.FATHER,
  পিতা: GuardianRelationEnum.FATHER,
  mother: GuardianRelationEnum.MOTHER,
  মা: GuardianRelationEnum.MOTHER,
  মাতা: GuardianRelationEnum.MOTHER,
  other: GuardianRelationEnum.OTHER,
  অন্যান্য: GuardianRelationEnum.OTHER,
  অন্য: GuardianRelationEnum.OTHER,
};

const cell = (value: string | undefined) => (value ?? '').trim();

/**
 * Student CSV import into a class's sections (FND-04): a preview that checks every row without
 * saving, then the import, which checks again and saves the rows that pass. Students with an
 * account are enrolled (pending until verified); anyone else becomes an INVITED enrolment that
 * their sign-up claims, with their name kept. Guardians in the file (FND-09) are saved with the
 * student. One section per class per session, roll numbers unique in a section, and the plan's
 * max_students limit (PLAN_LIMIT_REACHED; nothing is saved) are enforced. Invitations are sent
 * only when asked: by email, or by SMS from the organisation's credits (through the outbox).
 */
@Injectable()
export class StudentImportService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    @InjectRepository(GuardianEntity)
    private readonly guardianRepo: Repository<GuardianEntity>,
    private readonly sessions: AcademicSessionsService,
    private readonly enrolments: EnrolmentsService,
    private readonly guardians: GuardiansService,
    private readonly userService: UserService,
    private readonly entitlements: EntitlementsService,
    private readonly orgSettings: OrgSettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async preview(classId: string, dto: StudentImportDto): Promise<ImportSummary> {
    const { summary } = await this.check(classId, dto);
    return summary;
  }

  async import(classId: string, dto: StudentImportDto, actor: Actor): Promise<ImportSummary> {
    const { summary, valid, classEntity, session } = await this.check(classId, dto);
    if (summary.limit.over) {
      throw new PlanLimitReachedException(
        LimitKey.MAX_STUDENTS,
        `This import would take the workspace to ${summary.limit.current + summary.limit.adding} students; the plan allows ${summary.limit.max}. Nothing was imported.`,
      );
    }

    const counts = { enrolled: 0, pending: 0, invited: 0, guardians: 0 };
    let invitationsSent = 0;
    const smsLocale = dto.send_invitations ? (await this.orgSettings.get(classEntity.organization_id as string)).sms_locale : null;
    const link = `${resolveFrontendUrl(this.configService)}/join/class/${classEntity.id}`;

    for (const row of valid) {
      try {
        const { enrolment, outcome } = await this.enrolments.enrol(
          row.section.id,
          row.student
            ? { student_id: row.student.id, roll_no: row.rollNo ?? undefined }
            : { email: row.email ?? undefined, phone: row.phone ?? undefined, roll_no: row.rollNo ?? undefined, name: row.name },
          actor,
        );
        row.result.outcome = outcome;
        if (outcome === 'ENROLLED') counts.enrolled++;
        else if (outcome === 'PENDING') counts.pending++;
        else counts.invited++;

        if (row.guardians.length > 0 && !row.keepGuardians) {
          const entries = await this.enrolmentRepo.manager.transaction((manager) =>
            this.guardians.replace(enrolment.id, { guardians: row.guardians }, actor, manager),
          );
          this.audit.recordMany(entries);
          counts.guardians += row.guardians.length;
        }

        if (outcome === 'INVITED' && dto.send_invitations) {
          const variables = { class_name: classEntity.class_name, inviter_name: actor.full_name || 'Your school', link, student_name: row.name };
          const sent = await this.notifications.enqueue({
            eventType: NOTIFICATION_EVENTS.CLASS_INVITATION,
            channel: row.email ? NotificationChannelEnum.EMAIL : NotificationChannelEnum.SMS,
            organizationId: classEntity.organization_id,
            address: (row.email ?? row.phone) as string,
            locale: row.email ? undefined : (smsLocale ?? undefined),
            variables,
            dedupeKey: `class-invite:${enrolment.id}`,
            createdBy: actor.id,
          });
          invitationsSent += sent.length;
        }
      } catch {
        row.result.outcome = 'SKIPPED';
        row.result.errors.push({ code: 'SAVE_FAILED' });
      }
    }
    for (const result of summary.rows) {
      if (!result.outcome) result.outcome = 'SKIPPED';
    }

    const saved = summary.rows.filter((r) => r.outcome !== 'SKIPPED').length;
    this.audit.record({
      action: AUDIT_ACTIONS.STUDENT_IMPORT,
      organizationId: classEntity.organization_id,
      actorId: actor.id,
      entityType: 'class',
      entityId: classEntity.id,
      after: {
        class_name: classEntity.class_name,
        session_name: session.name,
        rows: summary.total,
        imported: saved,
        skipped: summary.total - saved,
        enrolled: counts.enrolled,
        pending: counts.pending,
        invited: counts.invited,
        guardians: counts.guardians,
        invitations_sent: invitationsSent,
      },
    });
    return { ...summary, valid: saved, invalid: summary.total - saved, invitations_sent: invitationsSent };
  }

  // ------------------------------------------------------------------ checks

  private async check(classId: string, dto: StudentImportDto) {
    const classEntity = await tenantScoped(this.classRepo).findOne({ where: { id: classId } });
    if (!classEntity) throw new NotFoundException('Class not found');
    const organizationId = classEntity.organization_id as string;
    const session: AcademicSessionEntity = dto.session_id
      ? await this.sessions.findOne(dto.session_id)
      : await this.sessions.ensureDefault(organizationId);
    this.sessions.assertSessionOpen(session);

    const sections = await this.sectionRepo.find({ where: { class_id: classId, session_id: session.id } });
    const sectionByName = new Map(sections.map((section) => [section.name.trim().toLowerCase(), section]));

    // Who is already in this class this session (one section per class per session).
    const current = await this.enrolmentRepo.find({
      where: { class_id: classId, session_id: session.id, status: In(CURRENT_ENROLMENT_STATUSES) },
    });
    const enrolledStudents = new Set(current.map((row) => row.student_id).filter(Boolean));
    const invitedContacts = new Set(
      current.flatMap((row) => [row.invited_email, row.invited_phone]).filter((value): value is string => Boolean(value)),
    );
    const rollsTaken = new Set(current.filter((row) => row.roll_no).map((row) => `${row.section_id}:${row.roll_no?.trim().toLowerCase()}`));

    const seenContacts = new Set<string>();
    const results: ImportRowResult[] = [];
    const valid: ValidRow[] = [];

    for (const [index, raw] of dto.rows.entries()) {
      const row = await this.checkRow(index + 1, raw, {
        sectionByName,
        enrolledStudents,
        invitedContacts,
        rollsTaken,
        seenContacts,
        organizationId,
      });
      results.push(row.result);
      if (row.valid) valid.push(row.valid);
    }

    const limit = await this.limitFor(organizationId, valid);
    const summary: ImportSummary = {
      session: { id: session.id, name: session.name },
      rows: results,
      total: results.length,
      valid: valid.length,
      invalid: results.length - valid.length,
      limit,
    };
    return { summary, valid, classEntity, session };
  }

  private async checkRow(
    rowNumber: number,
    raw: StudentImportRowDto,
    context: {
      sectionByName: Map<string, SectionEntity>;
      enrolledStudents: Set<string | null>;
      invitedContacts: Set<string>;
      rollsTaken: Set<string>;
      seenContacts: Set<string>;
      organizationId: string;
    },
  ): Promise<{ result: ImportRowResult; valid: ValidRow | null }> {
    const name = cell(raw.name);
    const phoneText = cell(raw.phone);
    const emailText = cell(raw.email);
    const sectionText = cell(raw.section);
    const rollNo = cell(raw.roll_no) || null;
    const errors: Array<ImportIssue<ImportErrorCode>> = [];
    const warnings: Array<ImportIssue<ImportWarningCode>> = [];

    if (!name) errors.push({ code: 'NAME_REQUIRED' });
    else if (name.length > 150) errors.push({ code: 'NAME_TOO_LONG' });

    const phone = phoneText ? normalizePhone(phoneText) : null;
    const email = emailText ? normalizeEmail(emailText) : null;
    if (!phoneText && !emailText) errors.push({ code: 'CONTACT_REQUIRED' });
    if (phoneText && (!phone || !BD_MOBILE.test(phone))) errors.push({ code: 'INVALID_PHONE' });
    if (emailText && (!email || !EMAIL.test(email) || email.length > 100)) errors.push({ code: 'INVALID_EMAIL' });

    const section = sectionText ? context.sectionByName.get(sectionText.toLowerCase()) : undefined;
    if (!sectionText) errors.push({ code: 'SECTION_REQUIRED' });
    else if (!section) errors.push({ code: 'SECTION_NOT_FOUND' });

    if (rollNo && rollNo.length > 20) errors.push({ code: 'ROLL_TOO_LONG' });
    const rollKey = section && rollNo ? `${section.id}:${rollNo.toLowerCase()}` : null;
    if (rollKey && context.rollsTaken.has(rollKey)) errors.push({ code: 'ROLL_TAKEN' });

    const guardians = this.checkGuardians(raw, errors);

    // The same student twice in the file.
    const contacts = [phone, email].filter((value): value is string => Boolean(value) && !errors.some((e) => e.code === 'INVALID_PHONE' || e.code === 'INVALID_EMAIL'));
    if (contacts.some((contact) => context.seenContacts.has(contact))) errors.push({ code: 'DUPLICATE_IN_FILE' });

    // Who the student is: an account by email, then by phone.
    let student: UserEntity | null = null;
    const contactsValid = (phone || email) && !errors.some((e) => ['INVALID_PHONE', 'INVALID_EMAIL', 'CONTACT_REQUIRED'].includes(e.code));
    if (contactsValid) {
      const user = (email ? await this.userService.findByContactOrPublicId(email) : null) ?? (phone ? await this.userService.findByContactOrPublicId(phone) : null);
      if (user && user.role !== RolesEnum.STUDENT) errors.push({ code: 'STAFF_ACCOUNT' });
      else if (user) student = user;
      if (student && context.enrolledStudents.has(student.id)) errors.push({ code: 'ALREADY_IN_CLASS' });
      if (!student && contacts.some((contact) => context.invitedContacts.has(contact))) errors.push({ code: 'ALREADY_INVITED' });
    }

    let keepGuardians = false;
    if (student && guardians.length > 0 && errors.length === 0) {
      const existing = await this.guardianRepo.count({
        where: { organization_id: context.organizationId, student_id: student.id, deleted_at: IsNull() },
      });
      if (existing > 0) {
        keepGuardians = true;
        warnings.push({ code: 'GUARDIANS_KEPT' });
      }
    }

    const plan: ImportPlan | null =
      errors.length > 0 ? null : !student ? 'INVITE' : student.is_otp_verified && student.is_verified ? 'ENROL' : 'PENDING';
    const result: ImportRowResult = {
      row: rowNumber,
      name: student?.full_name || name,
      contact: email ?? phone ?? (emailText || phoneText),
      section: section?.name ?? sectionText,
      roll_no: rollNo,
      guardians: guardians.length,
      plan,
      errors,
      warnings,
    };
    if (errors.length > 0 || !section) return { result, valid: null };

    // Later rows see this one: its contacts, its roll number and its student.
    contacts.forEach((contact) => context.seenContacts.add(contact));
    if (rollKey) context.rollsTaken.add(rollKey);
    if (student) context.enrolledStudents.add(student.id);
    return { result, valid: { result, section, student, name, phone, email, rollNo, guardians, keepGuardians } };
  }

  /** Guardian 1 and 2 of a row; a guardian with every cell empty is left out. Guardian 1 is primary. */
  private checkGuardians(raw: StudentImportRowDto, errors: Array<ImportIssue<ImportErrorCode>>): GuardianInputDto[] {
    const guardians: GuardianInputDto[] = [];
    const phones = new Set<string>();
    for (const n of [1, 2] as const) {
      const name = cell(n === 1 ? raw.guardian1_name : raw.guardian2_name);
      const relationText = cell(n === 1 ? raw.guardian1_relation : raw.guardian2_relation);
      const phoneText = cell(n === 1 ? raw.guardian1_phone : raw.guardian2_phone);
      if (!name && !relationText && !phoneText) continue;

      const issues = errors.length;
      if (!name || name.length > 120 || !phoneText) errors.push({ code: 'GUARDIAN_INCOMPLETE', guardian: n });
      const relation = relationText ? RELATIONS[relationText.toLowerCase()] : GuardianRelationEnum.OTHER;
      if (!relation) errors.push({ code: 'GUARDIAN_RELATION', guardian: n });
      const phone = phoneText ? normalizePhone(phoneText) : null;
      if (phoneText && (!phone || !BD_MOBILE.test(phone))) errors.push({ code: 'GUARDIAN_PHONE', guardian: n });
      else if (phone && phones.has(phone)) errors.push({ code: 'GUARDIAN_SAME_PHONE', guardian: n });
      if (errors.length > issues || !phone) continue;
      phones.add(phone);
      guardians.push({ name, relation, phone, is_primary: guardians.length === 0 });
    }
    return guardians;
  }

  /**
   * The plan's max_students against the organisation's students in open sessions (an account
   * counts once; each invitation counts). Students already in another class here are not added again.
   */
  private async limitFor(organizationId: string, valid: ValidRow[]): Promise<ImportSummary['limit']> {
    const entitlements = await this.entitlements.getEntitlements(organizationId);
    const max = Number(entitlements.limits[LimitKey.MAX_STUDENTS] ?? 0);
    const [{ count }] = await this.enrolmentRepo
      .createQueryBuilder('e')
      .select('COUNT(DISTINCT COALESCE(e.student_id::text, e.id::text))', 'count')
      .where('e.organization_id = :organizationId', { organizationId })
      .andWhere('e.status IN (:...current)', { current: CURRENT_ENROLMENT_STATUSES })
      .andWhere(openSessionCondition('e'))
      .getRawMany<{ count: string }>();
    const studentIds = valid.map((row) => row.student?.id).filter((id): id is string => Boolean(id));
    const alreadyCounted = studentIds.length
      ? await this.enrolmentRepo
          .createQueryBuilder('e')
          .select('DISTINCT e.student_id', 'student_id')
          .where('e.organization_id = :organizationId AND e.student_id IN (:...studentIds)', { organizationId, studentIds })
          .andWhere('e.status IN (:...current)', { current: CURRENT_ENROLMENT_STATUSES })
          .andWhere(openSessionCondition('e'))
          .getRawMany<{ student_id: string }>()
      : [];
    const counted = new Set(alreadyCounted.map((row) => row.student_id));
    const adding = valid.filter((row) => !row.student || !counted.has(row.student.id)).length;
    const current = Number(count);
    return { max, current, adding, over: max > 0 && current + adding > max };
  }
}
