import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { GuardiansService } from 'src/academics/guardians.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditEntry, AuditService } from 'src/audit/audit.service';
import { HolidaysService } from 'src/calendar/holidays.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { addDays, daysBetween, isSchoolDate, schoolDateIn } from 'src/common/utils/school-date.util';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, RecipientTypeEnum } from 'src/notifications/notification.constants';
import { NotificationsService, OutboxMessage } from 'src/notifications/notifications.service';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { AttendanceClock } from './attendance-clock';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { ApplyLeaveDto, ApproveLeaveDto, DECIDED_LEAVE_STATUSES, LeaveListFilter, RejectLeaveDto } from './dto/leave.dto';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import {
  AttendancePersonTypeEnum,
  AttendanceRecordEntity,
  AttendanceRecordSourceEnum,
  AttendanceStatusEnum,
} from './entities/attendance-record.entity';
import { LeaveRequestEntity, LeaveStatusEnum } from './entities/leave-request.entity';

const { OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT } = OrganizationMemberRoleEnum;
const STAFF = [OWNER, ADMIN, ASSISTANT, TEACHER];
/** Approve every request in the organisation, and teachers' leave (ATT-11: "an Org Admin or the Owner"). */
const LEAVE_MANAGERS = [OWNER, ADMIN];
/** Apply for any student of the organisation (office staff take the parents' calls). */
const APPLY_FOR_ANY_STUDENT = [OWNER, ADMIN, ASSISTANT];

/** At most this many days in one request; longer leave is two requests. */
export const LEAVE_MAX_DAYS = 60;
/** Leave can start at most this many days back (a sick note brought in afterwards). */
export const LEAVE_BACK_DAYS = 30;
/** And at most this many days ahead. */
export const LEAVE_AHEAD_DAYS = 365;
/** The reason kept on each Absent record that approved leave turns into Leave (ATT-12 trail). */
export const LEAVE_CORRECTION_REASON = 'Approved leave';
const LIST_LIMIT = 100;
const PEOPLE_LIMIT = 20;

export interface PersonRef {
  id: string;
  full_name: string;
}

/** A leave request as the API returns it. */
export interface LeaveView {
  id: string;
  person: PersonRef;
  person_type: AttendancePersonTypeEnum;
  /** Students: their class and section ("Class 8 A"); empty for teachers. */
  class_name: string;
  from_date: string;
  to_date: string;
  /** Days in the range that are not a weekly off day or holiday. */
  school_days: number;
  reason: string;
  file: { id: string; name: string | null; mime: string } | null;
  status: LeaveStatusEnum;
  applied_by: PersonRef | null;
  decided_by: PersonRef | null;
  decided_at: Date | null;
  decision_note: string | null;
  cancelled_by: PersonRef | null;
  cancelled_at: Date | null;
  created_at: Date;
  can_decide: boolean;
  can_cancel: boolean;
}

/** `GET /attendance/leave/mine`: the caller's requests and what they may do on the leave page. */
export interface MyLeaveView {
  today: string;
  /** Whether the caller can apply for themselves, and as whom. */
  can_apply: boolean;
  person_type: AttendancePersonTypeEnum | null;
  /** Staff who may apply for a student (or, owners and admins, a teacher). */
  can_apply_for_others: boolean;
  /** Whether the caller approves anyone's leave (shows the approvals list). */
  can_approve: boolean;
  requests: LeaveView[];
}

/** Whom a request is for, with what approval needs. */
interface Subject {
  personId: string;
  personType: AttendancePersonTypeEnum;
  /** Students: their sections (ACTIVE, open sessions). */
  sectionIds: string[];
  /** Teachers: their role (an owner's own leave needs nobody's approval). */
  role: OrganizationMemberRoleEnum | null;
}

/**
 * Leave requests and approvals for students and teachers (ATT-09, ATT-11). Whole school days from
 * one date to another, with a reason and an optional attachment. Rules:
 * - **Who applies:** students and staff for themselves (not in a solo teacher's own workspace,
 *   which has no teacher attendance); for a student, their approvers, owners, admins and office
 *   staff; for a teacher, owners and admins.
 * - **Who approves:** a student's leave, the class teacher of their section while the organisation
 *   uses class teachers, else the section's teachers (`followUpTeachers`), and always owners and
 *   admins (a solo teacher owns their workspace); a teacher's leave, owners and admins. Nobody
 *   approves their own, except an owner, whose own leave needs nobody. When the applicant may
 *   approve it, it is approved at once.
 * - **Dates:** at most 60 days, starting no more than 30 days back and 365 ahead, with at least one
 *   school day; no overlap with the person's other pending or approved leave.
 * - **Effect:** approved leave makes the closing job save LEAVE instead of Absent, and turns Absent
 *   records already saved in the range into LEAVE (a correction row each, ATT-12). Check-ins stand.
 *   Cancelling (the person, the applicant or an approver) is a status change: pending at any time,
 *   approved only before it starts. A rejection needs a comment.
 * - **Messages:** guardians get an SMS when a student's leave is applied for (`guardian_sms.leave`);
 *   approvers get an in-app notice; the person (and the applicant) get the decision in-app.
 * Every change is in the audit log.
 */
@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRepo: Repository<LeaveRequestEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly sections: SectionsService,
    private readonly guardians: GuardiansService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly clock: AttendanceClock,
    private readonly dataSource: DataSource,
  ) {}

  async mine(tenant: Tenant, userId: string): Promise<MyLeaveView> {
    const organizationId = tenant.organizationId;
    const today = await this.today(organizationId);
    const self = await this.selfSubject(tenant, userId).catch(() => null);
    const rows = await this.leaveRepo.find({
      where: [
        { organization_id: organizationId, person_id: userId },
        { organization_id: organizationId, applied_by: userId },
      ],
      relations: RELATIONS,
      order: { from_date: 'DESC', created_at: 'DESC' },
      take: LIST_LIMIT,
    });
    const staff = isStaff(tenant);
    const follows = staff && (await this.followedSections(tenant, userId)).length > 0;
    return {
      today,
      can_apply: Boolean(self),
      person_type: self?.personType ?? null,
      can_apply_for_others: staff && (APPLY_FOR_ANY_STUDENT.includes(tenant.memberRole) || follows),
      can_approve: staff && (LEAVE_MANAGERS.includes(tenant.memberRole) || follows),
      requests: await this.views(tenant, userId, rows, today),
    };
  }

  /** Requests the caller approves: every request for owners and admins (but their own), else their students'. */
  async approvals(tenant: Tenant, userId: string, filter: LeaveListFilter = 'PENDING'): Promise<LeaveView[]> {
    const organizationId = tenant.organizationId;
    if (!isStaff(tenant)) return [];
    const today = await this.today(organizationId);
    const query = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.person', 'person')
      .leftJoinAndSelect('leave.applicant', 'applicant')
      .leftJoinAndSelect('leave.approver', 'approver')
      .leftJoinAndSelect('leave.canceller', 'canceller')
      .leftJoinAndSelect('leave.file', 'file')
      .where('leave.organization_id = :organizationId', { organizationId })
      .andWhere('leave.person_id <> :userId', { userId })
      .orderBy('leave.from_date', filter === 'PENDING' ? 'ASC' : 'DESC')
      .addOrderBy('leave.created_at', 'DESC')
      .take(LIST_LIMIT);
    if (filter === 'PENDING') query.andWhere('leave.status = :pending', { pending: LeaveStatusEnum.PENDING });
    else if (filter === 'DECIDED') query.andWhere('leave.status IN (:...decided)', { decided: DECIDED_LEAVE_STATUSES });
    if (!LEAVE_MANAGERS.includes(tenant.memberRole)) {
      const sectionIds = await this.followedSections(tenant, userId);
      const students = await this.sections.activeStudentsOfSections(organizationId, sectionIds);
      const ids = [...new Set([...students.values()].flat().map((row) => row.student_id))];
      if (ids.length === 0) return [];
      query.andWhere('leave.person_type = :student', { student: AttendancePersonTypeEnum.STUDENT }).andWhere('leave.person_id IN (:...ids)', { ids });
    }
    return this.views(tenant, userId, await query.getMany(), today);
  }

  async get(tenant: Tenant, userId: string, id: string): Promise<LeaveView> {
    const request = await this.visible(tenant, userId, id);
    return (await this.views(tenant, userId, [request], await this.today(tenant.organizationId)))[0];
  }

  /** Students (and, for owners and admins, staff) the caller may apply for, by name. */
  async people(tenant: Tenant, userId: string, search = ''): Promise<{ students: (PersonRef & { class_name: string })[]; staff: (PersonRef & { role: OrganizationMemberRoleEnum })[] }> {
    const organizationId = tenant.organizationId;
    if (!isStaff(tenant)) return { students: [], staff: [] };
    const sectionIds = APPLY_FOR_ANY_STUDENT.includes(tenant.memberRole) ? null : await this.followedSections(tenant, userId);
    const found = await this.sections.searchActiveStudents(organizationId, sectionIds, search, PEOPLE_LIMIT);
    const labels = await this.sectionLabels(organizationId, found.map((row) => row.section_id));
    const students = found.filter((row) => row.student_id !== userId).map((row) => ({ id: row.student_id, full_name: row.full_name, class_name: labels.get(row.section_id) ?? '' }));
    let staff: (PersonRef & { role: OrganizationMemberRoleEnum })[] = [];
    if (LEAVE_MANAGERS.includes(tenant.memberRole) && tenant.kind !== OrganizationKindEnum.SOLO) {
      const query = this.memberRepo
        .createQueryBuilder('member')
        .innerJoinAndSelect('member.user', 'user')
        .where('member.organization_id = :organizationId', { organizationId })
        .andWhere('member.removed_at IS NULL')
        .andWhere('member.role IN (:...roles)', { roles: STAFF })
        .andWhere('member.user_id <> :userId', { userId })
        .orderBy('lower(user.full_name)', 'ASC')
        .limit(PEOPLE_LIMIT);
      const term = search.trim().toLowerCase();
      if (term) query.andWhere('lower(user.full_name) LIKE :term', { term: `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });
      staff = (await query.getMany()).map((member) => ({ id: member.user_id, full_name: member.user.full_name, role: member.role }));
    }
    return { students, staff };
  }

  async apply(tenant: Tenant, userId: string, dto: ApplyLeaveDto): Promise<LeaveView> {
    const organizationId = tenant.organizationId;
    const personId = dto.person_id ?? userId;
    const subject = personId === userId ? await this.selfSubject(tenant, userId) : await this.otherSubject(tenant, userId, personId);
    const today = await this.today(organizationId);
    this.checkDates(dto.from_date, dto.to_date, today);
    const schoolDays = await this.schoolDays(organizationId, dto.from_date, dto.to_date);
    if (schoolDays === 0) {
      throw new BadRequestException({ message: 'Every day you chose is a weekly off day or a holiday', code: ATTENDANCE_ERRORS.LEAVE_NO_SCHOOL_DAYS });
    }
    if (dto.file_id) await this.checkFile(organizationId, userId, dto.file_id);

    const approvers = await this.approversOf(organizationId, subject);
    // An approver applying for someone else, and an owner applying for themselves, need nobody else.
    const approvedAtOnce = personId === userId ? subject.role === OWNER && subject.personType === AttendancePersonTypeEnum.TEACHER : approvers.all.has(userId);
    const now = new Date();
    const { request, converted } = await this.dataSource.transaction(async (manager) => {
      // One request at a time per person, so two at once cannot both pass the overlap check.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`leave:${organizationId}:${personId}`]);
      await this.checkOverlap(manager, organizationId, personId, dto.from_date, dto.to_date);
      const repo = manager.getRepository(LeaveRequestEntity);
      const request = await repo.save(
        repo.create({
          organization_id: organizationId,
          person_id: personId,
          person_type: subject.personType,
          from_date: dto.from_date,
          to_date: dto.to_date,
          reason: dto.reason,
          file_id: dto.file_id ?? null,
          status: approvedAtOnce ? LeaveStatusEnum.APPROVED : LeaveStatusEnum.PENDING,
          applied_by: userId,
          approver_id: approvedAtOnce ? userId : null,
          decided_at: approvedAtOnce ? now : null,
        }),
      );
      const converted = approvedAtOnce ? await this.absencesToLeave(manager, request, userId) : 0;
      await this.tellOnApply(manager, request, subject, userId, approvers.notify, approvedAtOnce);
      return { request, converted };
    });

    const entries: AuditEntry[] = [
      {
        action: AUDIT_ACTIONS.LEAVE_APPLY,
        organizationId,
        actorId: userId,
        entityType: 'leave_request',
        entityId: request.id,
        after: { person_id: personId, person_type: subject.personType, from_date: request.from_date, to_date: request.to_date, status: request.status, file_id: request.file_id },
      },
    ];
    if (approvedAtOnce) {
      entries.push({
        action: AUDIT_ACTIONS.LEAVE_APPROVE,
        organizationId,
        actorId: userId,
        entityType: 'leave_request',
        entityId: request.id,
        before: { status: LeaveStatusEnum.PENDING },
        after: { status: LeaveStatusEnum.APPROVED, absent_to_leave: converted, at_once: true },
      });
    }
    this.audit.recordMany(entries);
    return this.get(tenant, userId, request.id);
  }

  async approve(tenant: Tenant, userId: string, id: string, dto: ApproveLeaveDto): Promise<LeaveView> {
    return this.decide(tenant, userId, id, LeaveStatusEnum.APPROVED, dto.note?.trim() || null);
  }

  async reject(tenant: Tenant, userId: string, id: string, dto: RejectLeaveDto): Promise<LeaveView> {
    return this.decide(tenant, userId, id, LeaveStatusEnum.REJECTED, dto.note.trim());
  }

  async cancel(tenant: Tenant, userId: string, id: string): Promise<LeaveView> {
    const organizationId = tenant.organizationId;
    const found = await this.visible(tenant, userId, id);
    const today = await this.today(organizationId);
    const isApprover = (await this.approversOf(organizationId, await this.subjectOfRequest(found))).all.has(userId);
    if (!isApprover && userId !== found.person_id && userId !== found.applied_by) {
      throw new ForbiddenException({ message: 'You cannot withdraw this leave', code: ATTENDANCE_ERRORS.LEAVE_CANNOT_CANCEL });
    }
    const before = found.status;
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LeaveRequestEntity);
      const request = await repo.findOneOrFail({ where: { id, organization_id: organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!cancellable(request, today)) {
        throw new ConflictException({
          message: request.status === LeaveStatusEnum.APPROVED ? 'Leave that has started cannot be withdrawn' : 'This request is already closed',
          code: ATTENDANCE_ERRORS.LEAVE_CANNOT_CANCEL,
        });
      }
      const now = new Date();
      await repo.update({ id }, { status: LeaveStatusEnum.CANCELLED, cancelled_at: now, cancelled_by: userId, updated_at: now });
      const name = (await manager.getRepository(UserEntity).findOne({ where: { id: userId }, select: ['id', 'full_name'] }))?.full_name ?? '';
      await this.notifications.notifyUsers(
        {
          eventType: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_CANCELLED,
          organizationId,
          userIds: [request.person_id, request.applied_by, request.approver_id].filter((uid): uid is string => Boolean(uid) && uid !== userId),
          variables: { ...(await this.messageVariables(manager, request)), by_name: name },
          dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_CANCELLED}:${request.id}`,
          createdBy: userId,
        },
        manager,
      );
    });
    this.audit.record({
      action: AUDIT_ACTIONS.LEAVE_CANCEL,
      organizationId,
      actorId: userId,
      entityType: 'leave_request',
      entityId: id,
      before: { status: before },
      after: { status: LeaveStatusEnum.CANCELLED },
    });
    return this.get(tenant, userId, id);
  }

  private async decide(tenant: Tenant, userId: string, id: string, status: LeaveStatusEnum.APPROVED | LeaveStatusEnum.REJECTED, note: string | null): Promise<LeaveView> {
    const organizationId = tenant.organizationId;
    const found = await this.visible(tenant, userId, id);
    if (found.person_id === userId) {
      throw new ForbiddenException({ message: 'You cannot decide on your own leave', code: ATTENDANCE_ERRORS.LEAVE_OWN_REQUEST });
    }
    const approvers = await this.approversOf(organizationId, await this.subjectOfRequest(found));
    if (!approvers.all.has(userId)) {
      throw new ForbiddenException({ message: 'You do not approve this leave', code: ATTENDANCE_ERRORS.LEAVE_NOT_APPROVER });
    }
    const converted = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LeaveRequestEntity);
      const request = await repo.findOneOrFail({ where: { id, organization_id: organizationId }, lock: { mode: 'pessimistic_write' } });
      if (request.status !== LeaveStatusEnum.PENDING) {
        throw new ConflictException({ message: 'This request has already been decided or withdrawn', code: ATTENDANCE_ERRORS.LEAVE_NOT_PENDING });
      }
      const now = new Date();
      await repo.update({ id }, { status, approver_id: userId, decided_at: now, decision_note: note, updated_at: now });
      const converted = status === LeaveStatusEnum.APPROVED ? await this.absencesToLeave(manager, request, userId) : 0;
      const event = status === LeaveStatusEnum.APPROVED ? NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPROVED : NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REJECTED;
      await this.notifications.notifyUsers(
        {
          eventType: event,
          organizationId,
          userIds: [request.person_id, request.applied_by].filter((uid): uid is string => Boolean(uid) && uid !== userId),
          variables: { ...(await this.messageVariables(manager, request)), note: note ?? '' },
          dedupeKey: `${event}:${request.id}`,
          createdBy: userId,
        },
        manager,
      );
      return converted;
    });
    this.audit.record({
      action: status === LeaveStatusEnum.APPROVED ? AUDIT_ACTIONS.LEAVE_APPROVE : AUDIT_ACTIONS.LEAVE_REJECT,
      organizationId,
      actorId: userId,
      entityType: 'leave_request',
      entityId: id,
      before: { status: LeaveStatusEnum.PENDING },
      after: { status, ...(status === LeaveStatusEnum.APPROVED ? { absent_to_leave: converted } : {}) },
      reason: note ?? undefined,
    });
    return this.get(tenant, userId, id);
  }

  /**
   * Absent records already saved in the leave's range (the closing job ran before the approval)
   * become LEAVE, linked to the request, each with a correction row (ATT-12) by the approver.
   * Present and Late stay: the person came after all.
   */
  private async absencesToLeave(manager: EntityManager, request: LeaveRequestEntity, actorId: string): Promise<number> {
    const records = manager.getRepository(AttendanceRecordEntity);
    const absent = await records.find({
      where: {
        organization_id: request.organization_id,
        person_id: request.person_id,
        date: Between(request.from_date, request.to_date),
        status: AttendanceStatusEnum.ABSENT,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (absent.length === 0) return 0;
    const now = new Date();
    await records.update(
      { id: In(absent.map((record) => record.id)) },
      { status: AttendanceStatusEnum.LEAVE, late_minutes: null, source: AttendanceRecordSourceEnum.CORRECTION, leave_request_id: request.id, updated_by: actorId, updated_at: now },
    );
    await manager.getRepository(AttendanceCorrectionEntity).insert(
      absent.map((record) => ({
        organization_id: request.organization_id,
        record_id: record.id,
        old_status: AttendanceStatusEnum.ABSENT,
        new_status: AttendanceStatusEnum.LEAVE,
        reason: LEAVE_CORRECTION_REASON,
        corrected_by: actorId,
      })),
    );
    return absent.length;
  }

  /** On apply: the guardians' SMS (students, when switched on), and the approvers' notice or the person's approval. */
  private async tellOnApply(
    manager: EntityManager,
    request: LeaveRequestEntity,
    subject: Subject,
    userId: string,
    approverIds: string[],
    approvedAtOnce: boolean,
  ): Promise<void> {
    const organizationId = request.organization_id;
    const variables = await this.messageVariables(manager, request, subject.sectionIds);
    if (subject.personType === AttendancePersonTypeEnum.STUDENT && (await this.orgSettings.getAttendance(organizationId, manager)).guardian_sms.leave) {
      const contacts = await this.guardians.contactsForStudent(organizationId, request.person_id, manager);
      const organizationName = await this.orgSettings.organizationName(organizationId);
      await this.notifications.enqueue(
        contacts.map(
          (guardian): OutboxMessage => ({
            eventType: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPLIED,
            channel: NotificationChannelEnum.SMS,
            organizationId,
            address: guardian.phone,
            recipientType: RecipientTypeEnum.GUARDIAN,
            recipientId: guardian.id,
            locale: guardian.locale,
            variables: {
              student_id: request.person_id,
              student_name: variables.person_name,
              class_name: variables.section_label,
              from_on: request.from_date,
              to_on: request.to_date,
              organization_name: organizationName,
            },
            // One SMS per request and guardian, however often the request is saved.
            dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPLIED}:${request.id}:${guardian.id}`,
            createdBy: userId,
          }),
        ),
        manager,
      );
    }
    if (approvedAtOnce) {
      if (request.person_id === userId) return;
      await this.notifications.notifyUsers(
        {
          eventType: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPROVED,
          organizationId,
          userIds: [request.person_id],
          variables: { ...variables, note: '' },
          dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPROVED}:${request.id}`,
          createdBy: userId,
        },
        manager,
      );
      return;
    }
    await this.notifications.notifyUsers(
      {
        eventType: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REQUESTED,
        organizationId,
        userIds: approverIds.filter((id) => id !== userId && id !== request.person_id),
        variables,
        dedupeKey: `${NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REQUESTED}:${request.id}`,
        createdBy: userId,
      },
      manager,
    );
  }

  /** The variables every leave message uses. */
  private async messageVariables(manager: EntityManager, request: LeaveRequestEntity, sectionIds?: string[]) {
    const person = await manager.getRepository(UserEntity).findOne({ where: { id: request.person_id }, select: ['id', 'full_name'] });
    let label = '';
    if (request.person_type === AttendancePersonTypeEnum.STUDENT) {
      const ids = sectionIds ?? (await this.sections.activeSectionsOfStudents(request.organization_id, [request.person_id])).get(request.person_id) ?? [];
      label = [...(await this.sectionLabels(request.organization_id, ids)).values()][0] ?? '';
    }
    return {
      person_id: request.person_id,
      person_name: person?.full_name ?? '',
      section_label: label,
      // In the in-app text: "Rahim (Class 8 A) asks for leave …"; empty for teachers.
      class_name: label ? `(${label})` : '',
      from_on: request.from_date,
      to_on: request.to_date,
      leave_id: request.id,
      path: '/leave',
    };
  }

  /**
   * Who approves the subject's leave (`all`), and who is told of a new request (`notify`): for a
   * student their sections' class teacher (or teachers), else the organisation's owners and admins;
   * for a teacher, the owners and admins other than them.
   */
  private async approversOf(organizationId: string, subject: Subject): Promise<{ all: Set<string>; notify: string[] }> {
    const managers = (
      await this.memberRepo.find({
        where: { organization_id: organizationId, role: In(LEAVE_MANAGERS), removed_at: IsNull() },
        select: ['user_id'],
      })
    )
      .map((row) => row.user_id)
      .filter((id) => id !== subject.personId);
    if (subject.personType === AttendancePersonTypeEnum.TEACHER) return { all: new Set(managers), notify: managers };
    const teachers = [...new Set([...(await this.sections.followUpTeachers(organizationId, subject.sectionIds)).values()].flat())].filter(
      (id) => id !== subject.personId,
    );
    return { all: new Set([...managers, ...teachers]), notify: teachers.length > 0 ? teachers : managers };
  }

  /** The caller as the person on leave: a student with a class, or staff of an organisation. */
  private async selfSubject(tenant: Tenant, userId: string): Promise<Subject> {
    if (tenant.viaEnrolment || tenant.memberRole === STUDENT) {
      const sectionIds = (await this.sections.activeSectionsOfStudents(tenant.organizationId, [userId])).get(userId) ?? [];
      if (sectionIds.length === 0) {
        throw new ForbiddenException({ message: 'You are not in a class here yet', code: ATTENDANCE_ERRORS.LEAVE_NOT_ALLOWED });
      }
      return { personId: userId, personType: AttendancePersonTypeEnum.STUDENT, sectionIds, role: null };
    }
    if (tenant.kind === OrganizationKindEnum.SOLO || !STAFF.includes(tenant.memberRole)) {
      // A solo teacher's own workspace has no teacher attendance (P3-03), so no teacher leave.
      throw new ForbiddenException({ message: 'Leave is for students and teachers of an organisation', code: ATTENDANCE_ERRORS.LEAVE_NOT_ALLOWED });
    }
    return { personId: userId, personType: AttendancePersonTypeEnum.TEACHER, sectionIds: [], role: tenant.memberRole };
  }

  /** Someone else, when the caller may apply for them. */
  private async otherSubject(tenant: Tenant, userId: string, personId: string): Promise<Subject> {
    const organizationId = tenant.organizationId;
    if (!isStaff(tenant)) {
      throw new ForbiddenException({ message: 'Only staff can apply for someone else', code: ATTENDANCE_ERRORS.LEAVE_NOT_ALLOWED });
    }
    const sectionIds = (await this.sections.activeSectionsOfStudents(organizationId, [personId])).get(personId) ?? [];
    if (sectionIds.length > 0) {
      const followed = APPLY_FOR_ANY_STUDENT.includes(tenant.memberRole) ? sectionIds : await this.followedSections(tenant, userId);
      if (!sectionIds.some((id) => followed.includes(id))) {
        throw new ForbiddenException({ message: "You can apply only for your own students' leave", code: ATTENDANCE_ERRORS.LEAVE_NOT_ALLOWED });
      }
      return { personId, personType: AttendancePersonTypeEnum.STUDENT, sectionIds, role: null };
    }
    const member = tenant.kind === OrganizationKindEnum.SOLO
      ? null
      : await this.memberRepo.findOne({ where: { organization_id: organizationId, user_id: personId, role: In(STAFF), removed_at: IsNull() } });
    if (!member) throw new NotFoundException({ message: 'This person is not a student or teacher here', code: ATTENDANCE_ERRORS.LEAVE_PERSON_NOT_FOUND });
    if (!LEAVE_MANAGERS.includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: "Only owners and admins apply for a teacher's leave", code: ATTENDANCE_ERRORS.LEAVE_NOT_ALLOWED });
    }
    return { personId, personType: AttendancePersonTypeEnum.TEACHER, sectionIds: [], role: member.role };
  }

  /** The subject of a saved request, with today's sections (a student's approvers follow their class). */
  private async subjectOfRequest(request: LeaveRequestEntity): Promise<Subject> {
    if (request.person_type === AttendancePersonTypeEnum.STUDENT) {
      const sectionIds = (await this.sections.activeSectionsOfStudents(request.organization_id, [request.person_id])).get(request.person_id) ?? [];
      return { personId: request.person_id, personType: request.person_type, sectionIds, role: null };
    }
    const member = await this.memberRepo.findOne({ where: { organization_id: request.organization_id, user_id: request.person_id }, select: ['role'] });
    return { personId: request.person_id, personType: AttendancePersonTypeEnum.TEACHER, sectionIds: [], role: member?.role ?? null };
  }

  /** Sections whose students' leave the caller approves as their class teacher or teacher (open sessions). */
  private async followedSections(tenant: Tenant, userId: string): Promise<string[]> {
    if (!isStaff(tenant)) return [];
    const taught = [...(await this.sections.sectionIdsTaughtInOpenSessions(tenant.organizationId, userId))];
    const followUp = await this.sections.followUpTeachers(tenant.organizationId, taught);
    return taught.filter((id) => followUp.get(id)?.includes(userId));
  }

  /** The request when the caller is its person, its applicant or one of its approvers; else 404. */
  private async visible(tenant: Tenant, userId: string, id: string): Promise<LeaveRequestEntity> {
    const request = await this.leaveRepo.findOne({ where: { id, organization_id: tenant.organizationId }, relations: RELATIONS });
    if (request && (request.person_id === userId || request.applied_by === userId)) return request;
    if (request && isStaff(tenant) && (await this.approversOf(tenant.organizationId, await this.subjectOfRequest(request))).all.has(userId)) return request;
    throw new NotFoundException({ message: 'Leave request not found', code: ATTENDANCE_ERRORS.LEAVE_NOT_FOUND });
  }

  private checkDates(from: string, to: string, today: string): void {
    if (!isSchoolDate(from) || !isSchoolDate(to) || to < from) {
      throw new BadRequestException({ message: 'Choose a first and a last day, in order', code: ATTENDANCE_ERRORS.LEAVE_DATES_INVALID });
    }
    if (daysBetween(from, to) > LEAVE_MAX_DAYS) {
      throw new BadRequestException({ message: `Leave can be at most ${LEAVE_MAX_DAYS} days at a time`, code: ATTENDANCE_ERRORS.LEAVE_TOO_LONG, details: { days: LEAVE_MAX_DAYS } });
    }
    if (from < addDays(today, -LEAVE_BACK_DAYS)) {
      throw new BadRequestException({ message: `Leave can start at most ${LEAVE_BACK_DAYS} days back`, code: ATTENDANCE_ERRORS.LEAVE_TOO_OLD, details: { days: LEAVE_BACK_DAYS } });
    }
    if (from > addDays(today, LEAVE_AHEAD_DAYS)) {
      throw new BadRequestException({ message: `Leave can be applied for up to ${LEAVE_AHEAD_DAYS} days ahead`, code: ATTENDANCE_ERRORS.LEAVE_TOO_FAR, details: { days: LEAVE_AHEAD_DAYS } });
    }
  }

  private async checkOverlap(manager: EntityManager, organizationId: string, personId: string, from: string, to: string): Promise<void> {
    const clash = await manager.getRepository(LeaveRequestEntity).findOne({
      where: {
        organization_id: organizationId,
        person_id: personId,
        status: In([LeaveStatusEnum.PENDING, LeaveStatusEnum.APPROVED]),
        from_date: LessThanOrEqual(to),
        to_date: MoreThanOrEqual(from),
      },
    });
    if (clash) {
      throw new ConflictException({
        message: 'This leave overlaps another request',
        code: ATTENDANCE_ERRORS.LEAVE_OVERLAP,
        details: { id: clash.id, from_date: clash.from_date, to_date: clash.to_date, status: clash.status },
      });
    }
  }

  /** The attachment must be the caller's own upload in this organisation, for leave, and not failed. */
  private async checkFile(organizationId: string, userId: string, fileId: string): Promise<void> {
    const file = await this.dataSource.getRepository(FileObjectEntity).findOne({
      where: { id: fileId, organization_id: organizationId, owner_id: userId, purpose: FilePurposeEnum.LEAVE, status: Not(FileStatusEnum.FAILED), deleted_at: IsNull() },
    });
    if (!file) throw new BadRequestException({ message: 'Upload the attachment again', code: ATTENDANCE_ERRORS.LEAVE_FILE_INVALID });
  }

  private async schoolDays(organizationId: string, from: string, to: string): Promise<number> {
    const closed = await this.holidays.closedDays(organizationId, from, to);
    return daysBetween(from, to) - new Set(closed.map((day) => day.date)).size;
  }

  private async today(organizationId: string): Promise<string> {
    return schoolDateIn(await this.orgSettings.timeZone(organizationId), this.clock.now());
  }

  private async sectionLabels(organizationId: string, sectionIds: string[]): Promise<Map<string, string>> {
    const sections = await this.sections.findSectionsWithClasses(organizationId, [...new Set(sectionIds)]);
    return new Map(sections.map((section) => [section.id, `${section.class?.class_name ?? ''} ${section.name}`.trim()]));
  }

  private async views(tenant: Tenant, userId: string, rows: LeaveRequestEntity[], today: string): Promise<LeaveView[]> {
    if (rows.length === 0) return [];
    const organizationId = tenant.organizationId;
    const from = rows.reduce((a, row) => (row.from_date < a ? row.from_date : a), rows[0].from_date);
    const to = rows.reduce((a, row) => (row.to_date > a ? row.to_date : a), rows[0].to_date);
    const closed = new Set((await this.holidays.closedDays(organizationId, from, to)).map((day) => day.date));
    const studentIds = rows.filter((row) => row.person_type === AttendancePersonTypeEnum.STUDENT).map((row) => row.person_id);
    const sectionsOf = await this.sections.activeSectionsOfStudents(organizationId, [...new Set(studentIds)]);
    const labels = await this.sectionLabels(organizationId, [...sectionsOf.values()].flat());
    const result: LeaveView[] = [];
    for (const row of rows) {
      const subject: Subject =
        row.person_type === AttendancePersonTypeEnum.STUDENT
          ? { personId: row.person_id, personType: row.person_type, sectionIds: sectionsOf.get(row.person_id) ?? [], role: null }
          : await this.subjectOfRequest(row);
      const isApprover = isStaff(tenant) && row.person_id !== userId && (await this.approversOf(organizationId, subject)).all.has(userId);
      let schoolDays = 0;
      for (let i = 0; i < daysBetween(row.from_date, row.to_date); i++) if (!closed.has(addDays(row.from_date, i))) schoolDays++;
      result.push({
        id: row.id,
        person: ref(row.person) ?? { id: row.person_id, full_name: '' },
        person_type: row.person_type,
        class_name: subject.sectionIds.map((id) => labels.get(id)).filter(Boolean)[0] ?? '',
        from_date: row.from_date,
        to_date: row.to_date,
        school_days: schoolDays,
        reason: row.reason,
        file: row.file && !row.file.deleted_at ? { id: row.file.id, name: row.file.original_name, mime: row.file.mime } : null,
        status: row.status,
        applied_by: ref(row.applicant),
        decided_by: ref(row.approver),
        decided_at: row.decided_at,
        decision_note: row.decision_note,
        cancelled_by: ref(row.canceller),
        cancelled_at: row.cancelled_at,
        created_at: row.created_at,
        can_decide: isApprover && row.status === LeaveStatusEnum.PENDING,
        can_cancel: (isApprover || row.person_id === userId || row.applied_by === userId) && cancellable(row, today),
      });
    }
    return result;
  }
}

const RELATIONS = ['person', 'applicant', 'approver', 'canceller', 'file'];

const isStaff = (tenant: Tenant) => !tenant.viaEnrolment && STAFF.includes(tenant.memberRole);

/** Pending leave can be withdrawn at any time; approved leave only before its first day. */
const cancellable = (request: Pick<LeaveRequestEntity, 'status' | 'from_date'>, today: string) =>
  request.status === LeaveStatusEnum.PENDING || (request.status === LeaveStatusEnum.APPROVED && request.from_date > today);

const ref = (user: UserEntity | null | undefined): PersonRef | null => (user ? { id: user.id, full_name: user.full_name } : null);
