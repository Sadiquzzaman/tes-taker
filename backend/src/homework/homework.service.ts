import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { OfferingRosterService, RosterStudent } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { NOTIFICATION_EVENTS, NotificationEvent } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateHomeworkDto, ListHomeworkQueryDto, PublishHomeworkDto, UpdateHomeworkDto } from './dto/homework.dto';
import { HomeworkAttachmentEntity } from './entities/homework-attachment.entity';
import { HomeworkEntity, HomeworkStatusEnum } from './entities/homework.entity';
import { HomeworkTargetEntity } from './entities/homework-target.entity';
import { HomeworkClock } from './homework-clock';
import { HOMEWORK_ERRORS } from './homework-errors';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** Staff who manage every homework of the workspace; teachers manage those of subject classes they teach. */
const HOMEWORK_MANAGERS = [OWNER, ADMIN, ASSISTANT];

/** The 24-hour reminder before the due time (HW-02). */
const REMINDER_BEFORE_MS = 24 * 60 * 60_000;

type Actor = { id: string; full_name?: string | null };

export interface HomeworkTargetView {
  offering_id: string;
  /** "Class 8 A" */
  section_label: string;
  /** Chosen students; null = everyone taking the subject class. */
  student_ids: string[] | null;
}

export interface HomeworkAttachmentView {
  id: string;
  name: string | null;
  mime: string | null;
  size_bytes: number | null;
  url: string;
}

export interface HomeworkView {
  id: string;
  title: string;
  instructions: unknown;
  submission_type: HomeworkEntity['submission_type'];
  total_marks: number | null;
  due_at: Date | null;
  publish_at: Date | null;
  published_at: Date | null;
  status: HomeworkStatusEnum;
  session_id: string;
  subject: { id: string; name: string };
  targets: HomeworkTargetView[];
  attachments: HomeworkAttachmentView[];
  /** How many students it is for (today's rosters). */
  student_count: number;
  created_by: { id: string; full_name: string } | null;
  created_at: Date;
  /** Whether the caller may change it (staff only; false for students and closed sessions). */
  can_edit: boolean;
}

/** A subject class the caller may set homework for (the editor's choices). */
export interface HomeworkSubjectClass {
  offering_id: string;
  session_id: string;
  /** "Class 6 A" */
  section_label: string;
  subject: { id: string; name: string };
}

export interface HomeworkSweepResult {
  published: number;
  reminded: number;
}

/**
 * Homework (Epic 2, HW-01 and HW-02): staff write a homework for one subject and one or more of its
 * subject classes (or chosen students of them), save it as a draft, publish it now or schedule it,
 * and withdraw it (never deleted). Students see published homework set to them, soonest due first,
 * and are told in the inbox when it is given and 24 hours before it is due (the homework job).
 *
 * Who: owners, admins and assistants manage every homework of the workspace; a teacher those whose
 * subject classes they all teach. Homework of a closed session is read-only (FND-01).
 */
@Injectable()
export class HomeworkService {
  private readonly logger = new Logger(HomeworkService.name);

  constructor(
    @InjectRepository(HomeworkEntity)
    private readonly homeworkRepo: Repository<HomeworkEntity>,
    private readonly dataSource: DataSource,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
    private readonly clock: HomeworkClock,
  ) {}

  // ------------------------------------------------------------------ staff

  async create(tenant: Tenant, actor: Actor, dto: CreateHomeworkDto): Promise<HomeworkView> {
    this.assertStaff(tenant);
    const organizationId = tenant.organizationId;
    const { offerings, sessionId, subjectId } = await this.checkTargets(tenant, actor.id, dto.offering_ids, dto.student_ids);
    this.checkDue(dto.due_at ?? null, null);
    if (dto.attachment_ids?.length) await this.checkFiles(organizationId, actor.id, dto.attachment_ids);

    const saved = await this.dataSource.transaction(async (manager) => {
      const homework = await manager.save(
        manager.create(HomeworkEntity, {
          organization_id: organizationId,
          session_id: sessionId,
          subject_id: subjectId,
          title: dto.title,
          instructions: dto.instructions ?? null,
          submission_type: dto.submission_type,
          total_marks: dto.total_marks == null ? null : String(dto.total_marks),
          due_at: dto.due_at ? new Date(dto.due_at) : null,
          status: HomeworkStatusEnum.DRAFT,
          created_by: actor.id,
          created_user_name: actor.full_name ?? undefined,
          created_at: this.clock.now(),
        }),
      );
      await this.saveTargets(manager, homework.id, offerings, dto.student_ids);
      await this.saveAttachments(manager, homework.id, dto.attachment_ids ?? []);
      return homework;
    });
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_CREATE,
      organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: saved.id,
      after: { title: saved.title, submission_type: saved.submission_type, offering_ids: dto.offering_ids, student_ids: dto.student_ids ?? null },
    });
    return this.get(tenant, actor.id, saved.id);
  }

  async update(tenant: Tenant, actor: Actor, id: string, dto: UpdateHomeworkDto): Promise<HomeworkView> {
    const homework = await this.findManaged(tenant, actor.id, id);
    if (homework.status === HomeworkStatusEnum.CANCELLED) this.wrongStatus('A withdrawn homework cannot be changed');
    const published = homework.status === HomeworkStatusEnum.PUBLISHED;
    // Students already have a published homework: who it is for and how it is handed in stay.
    if (published && (dto.offering_ids || dto.student_ids || dto.submission_type)) {
      this.wrongStatus("A published homework's subject classes, students and type cannot change");
    }
    const organizationId = tenant.organizationId;
    let offerings: CourseOfferingEntity[] | null = null;
    if (dto.offering_ids || dto.student_ids) {
      const offeringIds = dto.offering_ids ?? (await this.targetsOf(homework.id)).map((t) => t.offering_id);
      const checked = await this.checkTargets(tenant, actor.id, [...new Set(offeringIds)], dto.student_ids);
      if (checked.sessionId !== homework.session_id) {
        throw new BadRequestException({ message: 'Keep the subject classes in the same session', code: HOMEWORK_ERRORS.TARGETS_MIXED });
      }
      offerings = checked.offerings;
      homework.subject_id = checked.subjectId;
    }
    if (dto.due_at !== undefined) this.checkDue(dto.due_at, homework.status === HomeworkStatusEnum.SCHEDULED ? homework.publish_at : null);
    if (dto.attachment_ids?.length) await this.checkFiles(organizationId, actor.id, dto.attachment_ids, homework.id);

    const before = summary(homework);
    if (dto.title !== undefined) homework.title = dto.title;
    if (dto.instructions !== undefined) homework.instructions = dto.instructions ?? null;
    if (dto.submission_type !== undefined) homework.submission_type = dto.submission_type;
    if (dto.total_marks !== undefined) homework.total_marks = dto.total_marks == null ? null : String(dto.total_marks);
    if (dto.due_at !== undefined) {
      const due = dto.due_at ? new Date(dto.due_at) : null;
      // A new due time gets its own 24-hour reminder.
      if (due?.getTime() !== homework.due_at?.getTime()) homework.reminder_sent_at = null;
      homework.due_at = due;
    }
    homework.updated_by = actor.id;
    homework.updated_user_name = actor.full_name ?? homework.updated_user_name;
    homework.updated_at = this.clock.now();

    await this.dataSource.transaction(async (manager) => {
      await manager.save(homework);
      if (offerings) {
        await manager.delete(HomeworkTargetEntity, { homework_id: homework.id });
        await this.saveTargets(manager, homework.id, offerings, dto.student_ids);
      }
      if (dto.attachment_ids) {
        await manager.delete(HomeworkAttachmentEntity, { homework_id: homework.id });
        await this.saveAttachments(manager, homework.id, dto.attachment_ids);
      }
    });
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_UPDATE,
      organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: homework.id,
      before,
      after: { ...summary(homework), ...(dto.offering_ids ? { offering_ids: dto.offering_ids } : {}), ...(dto.student_ids ? { student_ids: dto.student_ids } : {}) },
    });
    return this.get(tenant, actor.id, homework.id);
  }

  /** Publishes now (students are told at once) or schedules it for `publish_at` (the homework job publishes it). */
  async publish(tenant: Tenant, actor: Actor, id: string, dto: PublishHomeworkDto): Promise<HomeworkView> {
    const homework = await this.findManaged(tenant, actor.id, id);
    if (homework.status !== HomeworkStatusEnum.DRAFT && homework.status !== HomeworkStatusEnum.SCHEDULED) {
      this.wrongStatus('Only a draft or scheduled homework can be published');
    }
    const now = this.clock.now();
    const before = summary(homework);
    if (dto.publish_at) {
      const at = new Date(dto.publish_at);
      if (at.getTime() <= now.getTime()) {
        throw new BadRequestException({ message: 'Schedule it for a time in the future', code: HOMEWORK_ERRORS.PUBLISH_AT_INVALID });
      }
      if (homework.due_at && homework.due_at.getTime() <= at.getTime()) {
        throw new BadRequestException({ message: 'The due time must come after the publish time', code: HOMEWORK_ERRORS.DUE_INVALID });
      }
      homework.status = HomeworkStatusEnum.SCHEDULED;
      homework.publish_at = at;
      homework.updated_by = actor.id;
      homework.updated_at = now;
      await this.homeworkRepo.save(homework);
    } else {
      if (homework.due_at && homework.due_at.getTime() <= now.getTime()) {
        throw new BadRequestException({ message: 'The due time has passed; set a new one first', code: HOMEWORK_ERRORS.DUE_INVALID });
      }
      await this.dataSource.transaction((manager) => this.publishNow(manager, homework, now, actor.id));
    }
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_PUBLISH,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: homework.id,
      before,
      after: summary(homework),
    });
    return this.get(tenant, actor.id, homework.id);
  }

  /** Withdraws a homework (status CANCELLED, never deleted). Students no longer see it. */
  async cancel(tenant: Tenant, actor: Actor, id: string): Promise<HomeworkView> {
    const homework = await this.findManaged(tenant, actor.id, id);
    if (homework.status === HomeworkStatusEnum.CANCELLED) return this.get(tenant, actor.id, id);
    const before = summary(homework);
    homework.status = HomeworkStatusEnum.CANCELLED;
    homework.cancelled_at = this.clock.now();
    homework.cancelled_by = actor.id;
    homework.updated_by = actor.id;
    homework.updated_at = homework.cancelled_at;
    await this.homeworkRepo.save(homework);
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_CANCEL,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: homework.id,
      before,
      after: summary(homework),
    });
    return this.get(tenant, actor.id, id);
  }

  /** Homework the caller manages, newest first: every one for managers, those of their subject classes for teachers. */
  async list(tenant: Tenant, userId: string, query: ListHomeworkQueryDto): Promise<HomeworkView[]> {
    this.assertStaff(tenant);
    const organizationId = tenant.organizationId;
    const qb = this.homeworkRepo
      .createQueryBuilder('h')
      .where('h.organization_id = :organizationId', { organizationId })
      .orderBy('h.created_at', 'DESC')
      .take(200);
    const status = query.status ?? 'ACTIVE';
    if (status === 'ACTIVE') qb.andWhere('h.status <> :cancelled', { cancelled: HomeworkStatusEnum.CANCELLED });
    else qb.andWhere('h.status = :status', { status });
    if (query.offering_id) {
      qb.andWhere('EXISTS (SELECT 1 FROM homework_targets t WHERE t.homework_id = h.id AND t.offering_id = :offeringId)', { offeringId: query.offering_id });
    }
    if (!HOMEWORK_MANAGERS.includes(tenant.memberRole)) {
      const taught = await this.sections.offeringIdsTaughtBy(organizationId, userId);
      if (taught.length === 0) return [];
      qb.andWhere('EXISTS (SELECT 1 FROM homework_targets t WHERE t.homework_id = h.id AND t.offering_id = ANY(:taught))', { taught });
    }
    return this.views(tenant, userId, await qb.getMany());
  }

  /**
   * The subject classes the caller may set homework for, in open sessions: every one for owners,
   * admins and assistants, those they teach for a teacher. Sorted by section, then subject.
   */
  async subjectClasses(tenant: Tenant, userId: string): Promise<HomeworkSubjectClass[]> {
    this.assertStaff(tenant);
    const organizationId = tenant.organizationId;
    const ids = HOMEWORK_MANAGERS.includes(tenant.memberRole)
      ? await this.sections.openOfferingIds(organizationId)
      : await this.sections.offeringIdsTaughtBy(organizationId, userId);
    return (await this.sections.offeringsWithTeachers(organizationId, ids))
      .map(({ offering }) => ({
        offering_id: offering.id,
        session_id: offering.session_id,
        section_label: `${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim(),
        subject: { id: offering.subject_id, name: offering.subject?.name ?? '' },
      }))
      .sort((a, b) => a.section_label.localeCompare(b.section_label, 'en', { numeric: true }) || a.subject.name.localeCompare(b.subject.name));
  }

  /** One homework: for staff who may see it, or a student it is set to (published only). */
  async get(tenant: Tenant, userId: string, id: string): Promise<HomeworkView> {
    const homework = await this.homeworkRepo.findOne({ where: { id, organization_id: tenant.organizationId } });
    if (!homework) this.notFound();
    if (this.isStaff(tenant)) {
      if (!(await this.canSee(tenant, userId, homework))) this.notFound();
    } else if (homework.status !== HomeworkStatusEnum.PUBLISHED || !(await this.isSetTo(homework, userId))) {
      this.notFound();
    }
    const [view] = await this.views(tenant, userId, [homework]);
    return view;
  }

  // ------------------------------------------------------------------ students

  /**
   * The student's homework (HW-02 to-do list): published homework set to them in open sessions,
   * soonest due first (no due date last); withdrawn homework is left out.
   */
  async mine(tenant: Tenant, userId: string): Promise<HomeworkView[]> {
    const organizationId = tenant.organizationId;
    const offeringIds = await this.roster.offeringIdsOfStudent(organizationId, userId);
    if (offeringIds.length === 0) return [];
    const rows = await this.homeworkRepo
      .createQueryBuilder('h')
      .where('h.organization_id = :organizationId AND h.status = :published', { organizationId, published: HomeworkStatusEnum.PUBLISHED })
      .andWhere(
        // A whole subject class (student_id null), or the student chosen by name (then every row names one).
        `EXISTS (SELECT 1 FROM homework_targets t WHERE t.homework_id = h.id AND t.offering_id = ANY(:offeringIds)
           AND (t.student_id IS NULL OR t.student_id = :userId))`,
        { offeringIds, userId },
      )
      .orderBy('h.due_at', 'ASC', 'NULLS LAST')
      .addOrderBy('h.published_at', 'DESC')
      .take(200)
      .getMany();
    return this.views(tenant, userId, rows);
  }

  // ------------------------------------------------------------------ the homework job

  /**
   * The homework job (every minute, design §7): publishes scheduled homework whose time has come
   * and sends the 24-hour reminders (HW-02), for organisations with the `homework` feature. Safe to
   * run twice: each homework is claimed by its status or reminder time, and messages have keys.
   */
  async sweep(): Promise<HomeworkSweepResult> {
    const now = this.clock.now();
    const result: HomeworkSweepResult = { published: 0, reminded: 0 };

    const due = await this.homeworkRepo.find({
      where: { status: HomeworkStatusEnum.SCHEDULED, publish_at: LessThanOrEqual(now) },
      take: 200,
    });
    for (const homework of due) {
      if (!(await this.hasFeature(homework.organization_id))) continue;
      const published = await this.dataSource.transaction(async (manager) => {
        // Claim it: only one run publishes it.
        const claimed = await manager.update(
          HomeworkEntity,
          { id: homework.id, status: HomeworkStatusEnum.SCHEDULED },
          { status: HomeworkStatusEnum.PUBLISHED, published_at: now, updated_at: now },
        );
        if (!claimed.affected) return false;
        homework.status = HomeworkStatusEnum.PUBLISHED;
        homework.published_at = now;
        await this.notify(manager, homework, NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED, homework.created_by);
        return true;
      });
      if (published) result.published++;
    }

    const soon = await this.homeworkRepo
      .createQueryBuilder('h')
      .where('h.status = :published AND h.reminder_sent_at IS NULL AND h.due_at IS NOT NULL', { published: HomeworkStatusEnum.PUBLISHED })
      .andWhere('h.due_at > :now AND h.due_at <= :until', { now, until: new Date(now.getTime() + REMINDER_BEFORE_MS) })
      // A homework given less than a day before it is due was just announced: no reminder too.
      .andWhere('h.published_at <= :announcedBefore', { announcedBefore: new Date(now.getTime() - 60 * 60_000) })
      .take(200)
      .getMany();
    for (const homework of soon) {
      if (!(await this.hasFeature(homework.organization_id))) continue;
      const reminded = await this.dataSource.transaction(async (manager) => {
        const claimed = await manager.update(HomeworkEntity, { id: homework.id, reminder_sent_at: IsNull() }, { reminder_sent_at: now });
        if (!claimed.affected) return false;
        await this.notify(manager, homework, NOTIFICATION_EVENTS.HOMEWORK_DUE_SOON, null);
        return true;
      });
      if (reminded) result.reminded++;
    }
    if (result.published || result.reminded) this.logger.log(`Homework: published ${result.published}, reminded ${result.reminded}`);
    return result;
  }

  // ------------------------------------------------------------------ helpers

  private async publishNow(manager: EntityManager, homework: HomeworkEntity, now: Date, actorId: string): Promise<void> {
    homework.status = HomeworkStatusEnum.PUBLISHED;
    homework.published_at = now;
    homework.publish_at = null;
    homework.updated_by = actorId;
    homework.updated_at = now;
    await manager.save(homework);
    await this.notify(manager, homework, NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED, actorId);
  }

  /** In-app notices to every student the homework is set to, linked to it. */
  private async notify(manager: EntityManager, homework: HomeworkEntity, eventType: NotificationEvent, createdBy: string | null): Promise<void> {
    const studentIds = (await this.studentsOf(homework, manager)).map((s) => s.student_id);
    if (studentIds.length === 0) return;
    const [{ offering }] = await this.sections.offeringsWithTeachers(homework.organization_id, [
      (await manager.findOneOrFail(HomeworkTargetEntity, { where: { homework_id: homework.id } })).offering_id,
    ]);
    await this.notifications.notifyUsers(
      {
        eventType,
        organizationId: homework.organization_id,
        userIds: studentIds,
        variables: {
          title: homework.title,
          subject_name: offering.subject?.name ?? '',
          due_at: homework.due_at ? homework.due_at.toISOString() : 'NO_DUE_DATE',
          homework_id: homework.id,
          path: `/homework/${homework.id}`,
        },
        dedupeKey: `${eventType}:${homework.id}${eventType === NOTIFICATION_EVENTS.HOMEWORK_DUE_SOON ? `:${homework.due_at?.toISOString()}` : ''}`,
        createdBy,
      },
      manager,
    );
  }

  /** Every student the homework is set to, from today's rosters (chosen students, else the whole subject class). */
  async studentsOf(homework: Pick<HomeworkEntity, 'id' | 'organization_id'>, manager?: EntityManager): Promise<RosterStudent[]> {
    const targets = await (manager ?? this.dataSource.manager).find(HomeworkTargetEntity, { where: { homework_id: homework.id } });
    const offerings = await this.sections.offeringsWithTeachers(homework.organization_id, targets.map((t) => t.offering_id));
    const result = new Map<string, RosterStudent>();
    for (const { offering } of offerings) {
      const chosen = targets.filter((t) => t.offering_id === offering.id && t.student_id).map((t) => t.student_id as string);
      for (const student of await this.roster.students(offering)) {
        if (chosen.length === 0 || chosen.includes(student.student_id)) result.set(student.student_id, student);
      }
    }
    return [...result.values()];
  }

  private async isSetTo(homework: HomeworkEntity, userId: string): Promise<boolean> {
    return (await this.studentsOf(homework)).some((s) => s.student_id === userId);
  }

  /**
   * The subject classes are the organisation's, of one subject and one open session, each taught by
   * the caller unless they manage homework; chosen students must take one of them.
   */
  private async checkTargets(
    tenant: Tenant,
    userId: string,
    offeringIds: string[],
    studentIds?: string[],
  ): Promise<{ offerings: CourseOfferingEntity[]; sessionId: string; subjectId: string }> {
    const ids = [...new Set(offeringIds)];
    const found = await this.sections.offeringsWithTeachers(tenant.organizationId, ids);
    if (ids.length === 0 || found.length !== ids.length) {
      throw new BadRequestException({ message: 'Choose subject classes of this workspace', code: HOMEWORK_ERRORS.TARGETS_INVALID });
    }
    if (!HOMEWORK_MANAGERS.includes(tenant.memberRole) && found.some((f) => !f.teacherIds.includes(userId))) {
      throw new ForbiddenException({ message: 'You can set homework only for subject classes you teach', code: HOMEWORK_ERRORS.TARGETS_INVALID });
    }
    const sessions = new Set(found.map((f) => f.offering.session_id));
    const subjects = new Set(found.map((f) => f.offering.subject_id));
    if (sessions.size > 1 || subjects.size > 1) {
      throw new BadRequestException({ message: 'Choose subject classes of one subject and one session', code: HOMEWORK_ERRORS.TARGETS_MIXED });
    }
    if (found[0].offering.session?.status === AcademicSessionStatusEnum.CLOSED) {
      throw new ConflictException({ message: 'This session is closed; its homework is read-only', code: HOMEWORK_ERRORS.SESSION_CLOSED });
    }
    if (studentIds?.length) {
      const taking = new Set<string>();
      for (const { offering } of found) for (const s of await this.roster.students(offering)) taking.add(s.student_id);
      if (studentIds.some((id) => !taking.has(id))) {
        throw new BadRequestException({ message: 'A chosen student does not take these subject classes', code: HOMEWORK_ERRORS.STUDENT_NOT_IN_CLASS });
      }
    }
    return { offerings: found.map((f) => f.offering), sessionId: found[0].offering.session_id, subjectId: found[0].offering.subject_id };
  }

  /** Chosen students go to the subject class they take (one row each); otherwise one row per subject class. */
  private async saveTargets(manager: EntityManager, homeworkId: string, offerings: CourseOfferingEntity[], studentIds?: string[]): Promise<void> {
    const rows: { homework_id: string; offering_id: string; student_id: string | null }[] = [];
    if (!studentIds?.length) {
      for (const offering of offerings) rows.push({ homework_id: homeworkId, offering_id: offering.id, student_id: null });
    } else {
      const wanted = new Set(studentIds);
      for (const offering of offerings) {
        for (const student of await this.roster.students(offering)) {
          if (wanted.delete(student.student_id)) rows.push({ homework_id: homeworkId, offering_id: offering.id, student_id: student.student_id });
        }
      }
    }
    await manager.insert(HomeworkTargetEntity, rows);
  }

  private async saveAttachments(manager: EntityManager, homeworkId: string, fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    await manager.insert(
      HomeworkAttachmentEntity,
      [...new Set(fileIds)].map((file_id, sort_order) => ({ homework_id: homeworkId, file_id, sort_order })),
    );
  }

  /** Attachments are the caller's own uploads for homework (or already on this homework). */
  private async checkFiles(organizationId: string, userId: string, fileIds: string[], homeworkId?: string): Promise<void> {
    const ids = [...new Set(fileIds)];
    const files = await this.dataSource.getRepository(FileObjectEntity).find({
      where: { id: In(ids), organization_id: organizationId, purpose: FilePurposeEnum.HOMEWORK, status: Not(FileStatusEnum.FAILED), deleted_at: IsNull() },
    });
    const attached = homeworkId
      ? new Set((await this.dataSource.getRepository(HomeworkAttachmentEntity).find({ where: { homework_id: homeworkId } })).map((a) => a.file_id))
      : new Set<string>();
    const ok = files.filter((file) => file.owner_id === userId || attached.has(file.id));
    if (ok.length !== ids.length) {
      throw new BadRequestException({ message: 'Upload the attachments again', code: HOMEWORK_ERRORS.FILE_INVALID });
    }
  }

  /** A due time must be in the future (and after a scheduled publish time). */
  private checkDue(dueAt: string | null | undefined, publishAt: Date | null): void {
    if (!dueAt) return;
    const due = new Date(dueAt).getTime();
    if (due <= this.clock.now().getTime() || (publishAt && due <= publishAt.getTime())) {
      throw new BadRequestException({ message: 'The due time must be in the future', code: HOMEWORK_ERRORS.DUE_INVALID });
    }
  }

  /** A homework the caller may change: staff who may see it, in an open session. */
  private async findManaged(tenant: Tenant, userId: string, id: string): Promise<HomeworkEntity> {
    this.assertStaff(tenant);
    const homework = await this.homeworkRepo.findOne({ where: { id, organization_id: tenant.organizationId }, relations: ['session'] });
    if (!homework || !(await this.canSee(tenant, userId, homework))) this.notFound();
    if (homework.session?.status === AcademicSessionStatusEnum.CLOSED) {
      throw new ConflictException({ message: 'This session is closed; its homework is read-only', code: HOMEWORK_ERRORS.SESSION_CLOSED });
    }
    return homework;
  }

  /** Managers see every homework; a teacher those whose subject classes they all teach. */
  private async canSee(tenant: Tenant, userId: string, homework: HomeworkEntity): Promise<boolean> {
    if (HOMEWORK_MANAGERS.includes(tenant.memberRole)) return true;
    const taught = new Set(await this.sections.offeringIdsTaughtBy(tenant.organizationId, userId));
    const targets = await this.targetsOf(homework.id);
    return targets.length > 0 && targets.every((t) => taught.has(t.offering_id));
  }

  private targetsOf(homeworkId: string): Promise<HomeworkTargetEntity[]> {
    return this.dataSource.getRepository(HomeworkTargetEntity).find({ where: { homework_id: homeworkId } });
  }

  private async hasFeature(organizationId: string): Promise<boolean> {
    try {
      await this.entitlements.assertFeature(organizationId, FeatureKey.HOMEWORK);
      return true;
    } catch {
      return false;
    }
  }

  private isStaff(tenant: Tenant): boolean {
    return !tenant.viaEnrolment && [...HOMEWORK_MANAGERS, TEACHER].includes(tenant.memberRole);
  }

  private assertStaff(tenant: Tenant): void {
    if (!this.isStaff(tenant)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace manage homework', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Homework not found', code: HOMEWORK_ERRORS.NOT_FOUND });
  }

  private wrongStatus(message: string): never {
    throw new ConflictException({ message, code: HOMEWORK_ERRORS.WRONG_STATUS });
  }

  private async views(tenant: Tenant, userId: string, rows: HomeworkEntity[]): Promise<HomeworkView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [targets, attachments] = await Promise.all([
      this.dataSource.getRepository(HomeworkTargetEntity).find({ where: { homework_id: In(ids) } }),
      this.dataSource.getRepository(HomeworkAttachmentEntity).find({ where: { homework_id: In(ids) }, relations: ['file'], order: { sort_order: 'ASC' } }),
    ]);
    const offerings = new Map(
      (await this.sections.offeringsWithTeachers(tenant.organizationId, [...new Set(targets.map((t) => t.offering_id))])).map((f) => [f.offering.id, f.offering]),
    );
    const creators = new Map(
      (
        await this.dataSource.getRepository(UserEntity).find({
          where: { id: In([...new Set(rows.map((r) => r.created_by).filter((id): id is string => Boolean(id)))]) },
          select: ['id', 'full_name'],
        })
      ).map((u) => [u.id, u]),
    );
    const staff = this.isStaff(tenant);
    const result: HomeworkView[] = [];
    for (const row of rows) {
      const own = targets.filter((t) => t.homework_id === row.id);
      const byOffering = new Map<string, string[] | null>();
      for (const target of own) {
        const current = byOffering.get(target.offering_id);
        if (!target.student_id) byOffering.set(target.offering_id, null);
        else if (current !== null) byOffering.set(target.offering_id, [...(current ?? []), target.student_id]);
      }
      const first = offerings.get(own[0]?.offering_id ?? '');
      const creator = row.created_by ? creators.get(row.created_by) : undefined;
      result.push({
        id: row.id,
        title: row.title,
        instructions: row.instructions,
        submission_type: row.submission_type,
        total_marks: row.total_marks === null ? null : Number(row.total_marks),
        due_at: row.due_at,
        publish_at: row.publish_at,
        published_at: row.published_at,
        status: row.status,
        session_id: row.session_id,
        subject: { id: row.subject_id, name: first?.subject?.name ?? '' },
        targets: [...byOffering.entries()].map(([offeringId, studentIds]) => {
          const offering = offerings.get(offeringId);
          return {
            offering_id: offeringId,
            section_label: offering ? `${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim() : '',
            student_ids: staff ? studentIds : null,
          };
        }),
        attachments: attachments
          .filter((a) => a.homework_id === row.id)
          .map((a) => ({
            id: a.file_id,
            name: a.file?.original_name ?? null,
            mime: a.file?.mime ?? null,
            size_bytes: a.file?.size_bytes == null ? null : Number(a.file.size_bytes),
            url: `/files/${a.file_id}/content`,
          })),
        student_count: staff ? (await this.studentsOf(row)).length : 0,
        created_by: creator ? { id: creator.id, full_name: creator.full_name } : null,
        created_at: row.created_at,
        can_edit: staff && row.status !== HomeworkStatusEnum.CANCELLED && (await this.canSee(tenant, userId, row)),
      });
    }
    return result;
  }
}

/** The fields the audit log keeps. */
const summary = (homework: HomeworkEntity) => ({
  title: homework.title,
  submission_type: homework.submission_type,
  total_marks: homework.total_marks,
  due_at: homework.due_at,
  status: homework.status,
  publish_at: homework.publish_at,
});
