import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { normalizeEmail, normalizePhone } from 'src/common/utils/contact.util';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { OrganizationsService } from 'src/organizations/organization.service';
import { usesOrganizationRules } from 'src/organizations/organization-rules';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { AcademicSessionsService } from './academic-sessions.service';
import { AcademicSessionEntity } from './entities/academic-session.entity';
import { EnrolmentEntity, EnrolmentStatusEnum } from './entities/enrolment.entity';
import { SectionEntity } from './entities/section.entity';
import { GuardiansService } from './guardians.service';
import { CURRENT_ENROLMENT_STATUSES, openSessionCondition } from './enrolment-queries';
import { EnrolStudentDto, PromoteStudentsDto, UpdateEnrolmentDto } from './dto/enrolment.dto';

interface Actor {
  id: string;
  full_name?: string | null;
}

/** The class an enrolment write is for (callers have already checked access to it). */
export interface EnrolmentClass {
  id: string;
  organization_id: string | null;
}

/** Fields a class screen sets on an enrolment. */
export type EnrolmentFields = Partial<
  Pick<EnrolmentEntity, 'student_id' | 'status' | 'invited_email' | 'invited_phone' | 'invitation_token' | 'joined_at' | 'roll_no'>
>;

type PromotedStudent = { student_id: string; full_name: string | null };

export interface PromotionResult {
  promoted: PromotedStudent[];
  /** ALREADY_ENROLLED: the student is already in the target class for that session; nothing changed. */
  skipped: Array<PromotedStudent & { reason: 'ALREADY_ENROLLED' }>;
}

export interface EnrolResult {
  enrolment: EnrolmentEntity;
  /** INVITED: no account matches the contact yet; nothing is sent (messages go through the outbox, P2-08). */
  outcome: 'ENROLLED' | 'PENDING' | 'INVITED';
}

/**
 * Students in sections (FND-04): the only writer of `enrolments`. The class screens (invite, join,
 * approve, remove) and the section endpoints both come here. Nothing is ever hard-deleted: a
 * student who is removed is marked LEFT with `left_at` (owner decision), and adding them again in
 * the same session reuses that row.
 */
@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly sessions: AcademicSessionsService,
    private readonly organizationsService: OrganizationsService,
    private readonly userService: UserService,
    private readonly guardians: GuardiansService,
  ) {}

  // ------------------------------------------------------------- class reads

  /** Current students of a class (not LEFT, in open sessions), with student and section. */
  async currentForClasses(classIds: string[]): Promise<Map<string, EnrolmentEntity[]>> {
    const byClass = new Map<string, EnrolmentEntity[]>(classIds.map((id) => [id, []]));
    if (classIds.length === 0) return byClass;
    const rows = await this.enrolmentRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.student', 'student')
      .leftJoinAndSelect('e.section', 'section')
      .where('e.class_id IN (:...classIds)', { classIds })
      .andWhere('e.status IN (:...current)', { current: CURRENT_ENROLMENT_STATUSES })
      .andWhere(openSessionCondition('e'))
      .orderBy('e.created_at', 'DESC')
      .getMany();
    for (const row of rows) byClass.get(row.class_id)?.push(row);
    return byClass;
  }

  async currentForClass(classId: string): Promise<EnrolmentEntity[]> {
    return (await this.currentForClasses([classId])).get(classId) ?? [];
  }

  /** The student's current enrolment in the class (any status but LEFT/PROMOTED), if any. */
  async currentOfStudent(classId: string, studentId: string): Promise<EnrolmentEntity | null> {
    return this.enrolmentRepo
      .createQueryBuilder('e')
      .where('e.class_id = :classId AND e.student_id = :studentId', { classId, studentId })
      .andWhere('e.status IN (:...current)', { current: CURRENT_ENROLMENT_STATUSES })
      .andWhere(openSessionCondition('e'))
      .orderBy('e.created_at', 'DESC')
      .getOne();
  }

  // ------------------------------------------------------- class screen writes

  /**
   * Adds a student or an invitation to a class from the class screens: into the class's first
   * section of the default session. A student who LEFT that session's class comes back on the same row.
   */
  async addToClass(classEntity: EnrolmentClass, fields: EnrolmentFields, actor: Actor): Promise<EnrolmentEntity> {
    if (!classEntity.organization_id) throw new BadRequestException('This class has no workspace');
    const section = await this.defaultSection(classEntity.id, classEntity.organization_id);
    return this.place(section, fields, actor);
  }

  /** Changes status, account or invitation fields of a current enrolment (approve, accept an invitation). */
  async update(id: string, fields: EnrolmentFields, actor: Actor | null): Promise<EnrolmentEntity> {
    await this.enrolmentRepo.update({ id }, { ...fields, updated_by: actor?.id ?? null, updated_at: new Date() });
    return this.enrolmentRepo.findOneOrFail({ where: { id } });
  }

  /**
   * A student claims an invitation (sign-up, join link). The student keeps one row per class per
   * session: if they already have one there (pending, or LEFT earlier), that row becomes ACTIVE in the
   * invitation's section and the invitation is marked LEFT; otherwise the invitation row becomes theirs.
   * Guardians entered on the invitation become the student's in the same transaction (FND-09).
   */
  async claimInvitation(invitation: EnrolmentEntity, studentId: string, actor: Actor | null): Promise<EnrolmentEntity> {
    const now = new Date();
    return this.enrolmentRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(EnrolmentEntity);
      const own = await repo.findOne({
        where: { session_id: invitation.session_id, class_id: invitation.class_id, student_id: studentId },
      });
      const stamp = { updated_by: actor?.id ?? studentId, updated_at: now };
      let claimedId = invitation.id;
      if (!own) {
        await repo.update(
          { id: invitation.id },
          {
            student_id: studentId,
            status: EnrolmentStatusEnum.ACTIVE,
            joined_at: now,
            invitation_token: null,
            invited_email: null,
            invited_phone: null,
            updated_by: actor?.id ?? null,
            updated_at: now,
          },
        );
      } else {
        await repo.update({ id: invitation.id }, { status: EnrolmentStatusEnum.LEFT, left_at: now, ...stamp });
        await repo.update(
          { id: own.id },
          { status: EnrolmentStatusEnum.ACTIVE, section_id: invitation.section_id, joined_at: now, left_at: null, ...stamp },
        );
        claimedId = own.id;
      }
      await this.guardians.linkInvitedStudent(invitation, studentId, manager);
      return repo.findOneOrFail({ where: { id: claimedId } });
    });
  }

  /** Soft removal: the rows stay as LEFT, with when and by whom. */
  async markLeft(ids: string[], actor: Actor): Promise<void> {
    if (ids.length === 0) return;
    await this.enrolmentRepo.update(
      { id: In(ids), status: In(CURRENT_ENROLMENT_STATUSES) },
      {
        status: EnrolmentStatusEnum.LEFT,
        left_at: new Date(),
        updated_by: actor.id,
        updated_user_name: actor.full_name ?? undefined,
        updated_at: new Date(),
      },
    );
  }

  /** The class's first section in the default session; section "A" when it has none. */
  async defaultSection(classId: string, organizationId: string, manager?: EntityManager): Promise<SectionEntity> {
    const session = await this.sessions.ensureDefault(organizationId, manager);
    const sections = (manager ?? this.sectionRepo.manager).getRepository(SectionEntity);
    const first = () => sections.findOne({ where: { class_id: classId, session_id: session.id }, order: { created_at: 'ASC', name: 'ASC' } });
    const existing = await first();
    if (existing) return existing;
    await sections
      .createQueryBuilder()
      .insert()
      .values({ organization_id: organizationId, class_id: classId, session_id: session.id, name: 'A', created_at: new Date() })
      .orIgnore()
      .execute();
    return (await first()) as SectionEntity;
  }

  // -------------------------------------------------------- section endpoints

  /**
   * Enrols one student in a section (Owner/Admin/Assistant; P2-05's import calls this per row).
   * A known student is ENROLLED (PENDING until their account is verified); an unknown phone or
   * email becomes an invitation that their sign-up claims.
   */
  async enrol(sectionId: string, dto: EnrolStudentDto, actor: Actor): Promise<EnrolResult> {
    const section = await tenantScoped(this.sectionRepo).findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Section not found');

    const student = await this.findStudent(dto);
    if (student) {
      const status = student.is_otp_verified && student.is_verified ? EnrolmentStatusEnum.ACTIVE : EnrolmentStatusEnum.PENDING;
      const enrolment = await this.place(section, { student_id: student.id, status, joined_at: new Date(), roll_no: dto.roll_no ?? null }, actor);
      if (status === EnrolmentStatusEnum.ACTIVE) await this.addSchoolMember(section, student.id);
      return { enrolment, outcome: status === EnrolmentStatusEnum.ACTIVE ? 'ENROLLED' : 'PENDING' };
    }

    const invited_email = dto.email ? normalizeEmail(dto.email) : null;
    const invited_phone = dto.phone ? normalizePhone(dto.phone) : null;
    if (!invited_email && !invited_phone) throw new BadRequestException('Give a valid phone number or email');
    const duplicate = await this.enrolmentRepo
      .createQueryBuilder('e')
      .where('e.class_id = :classId AND e.session_id = :sessionId AND e.status = :invited', {
        classId: section.class_id,
        sessionId: section.session_id,
        invited: EnrolmentStatusEnum.INVITED,
      })
      .andWhere('(e.invited_email = :email OR e.invited_phone = :phone)', { email: invited_email ?? '', phone: invited_phone ?? '' })
      .getCount();
    if (duplicate > 0) throw new ConflictException('This contact is already invited to this class');
    const enrolment = await this.place(
      section,
      { student_id: null, status: EnrolmentStatusEnum.INVITED, invited_email, invited_phone, roll_no: dto.roll_no ?? null },
      actor,
    );
    return { enrolment, outcome: 'INVITED' };
  }

  /** Moves a student to another section of the same class and session, sets the roll number, or marks them LEFT. */
  async updateFromSection(id: string, dto: UpdateEnrolmentDto, actor: Actor): Promise<EnrolmentEntity> {
    const enrolment = await tenantScoped(this.enrolmentRepo).findOne({ where: { id } });
    if (!enrolment) throw new NotFoundException('Student enrolment not found');
    this.sessions.assertSessionOpen(await this.sessions.findOne(enrolment.session_id));
    if (enrolment.status === EnrolmentStatusEnum.LEFT || enrolment.status === EnrolmentStatusEnum.PROMOTED) {
      throw new BadRequestException('This student is no longer in the class; enrol them again instead');
    }

    const patch: Partial<EnrolmentEntity> = { updated_by: actor.id, updated_at: new Date() };
    if (actor.full_name) patch.updated_user_name = actor.full_name;
    if (dto.section_id && dto.section_id !== enrolment.section_id) {
      const target = await tenantScoped(this.sectionRepo).findOne({ where: { id: dto.section_id } });
      if (!target || target.class_id !== enrolment.class_id || target.session_id !== enrolment.session_id) {
        throw new BadRequestException('Students can only move between sections of the same class and session');
      }
      patch.section_id = target.id;
    }
    if (dto.roll_no !== undefined) patch.roll_no = dto.roll_no;
    if (dto.status === EnrolmentStatusEnum.LEFT) {
      patch.status = EnrolmentStatusEnum.LEFT;
      patch.left_at = new Date();
    }
    await this.enrolmentRepo.update({ id }, patch);
    return this.enrolmentRepo.findOneOrFail({ where: { id }, relations: ['student', 'section'] });
  }

  /**
   * Promotes students (FND-05): each chosen ACTIVE student of the section gets an ACTIVE enrolment
   * in the target section (another session; any class), and their old enrolment becomes PROMOTED,
   * so the old year's records stay with it and the student still sees that year's tests. Roll
   * numbers and optional-subject choices are not carried over. Students already in the target class
   * for that session are skipped, so running it again changes nothing. The target session must be
   * open; the old one may already be closed. One transaction.
   */
  async promote(sourceSectionId: string, dto: PromoteStudentsDto, actor: Actor): Promise<PromotionResult> {
    const source = await tenantScoped(this.sectionRepo).findOne({ where: { id: sourceSectionId } });
    if (!source) throw new NotFoundException('Section not found');
    const target = await tenantScoped(this.sectionRepo).findOne({ where: { id: dto.target_section_id } });
    if (!target) throw new NotFoundException('Target section not found');
    if (target.session_id === source.session_id) {
      throw new BadRequestException('Choose a section in another session; to change sections in this session, move the student');
    }
    this.sessions.assertSessionOpen(await this.sessionOf(target));

    const ids = [...new Set(dto.enrolment_ids)];
    const rows = await this.enrolmentRepo.find({ where: { id: In(ids), section_id: source.id }, relations: ['student'] });
    if (rows.length !== ids.length) throw new BadRequestException('Some of these students are not in this section');
    if (rows.some((row) => row.status !== EnrolmentStatusEnum.ACTIVE || !row.student_id)) {
      throw new BadRequestException('Only active students can be promoted');
    }

    const result: PromotionResult = { promoted: [], skipped: [] };
    const now = new Date();
    const stamp = { updated_by: actor.id, updated_user_name: actor.full_name ?? undefined, updated_at: now };
    await this.enrolmentRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(EnrolmentEntity);
      for (const row of rows) {
        const student = { student_id: row.student_id as string, full_name: row.student?.full_name ?? null };
        const existing = await repo.findOne({
          where: { session_id: target.session_id, class_id: target.class_id, student_id: student.student_id },
        });
        if (existing && CURRENT_ENROLMENT_STATUSES.includes(existing.status)) {
          result.skipped.push({ ...student, reason: 'ALREADY_ENROLLED' });
          continue;
        }
        if (existing) {
          // A LEFT (or earlier PROMOTED) row of that class and session comes back, as place() does.
          await repo.update(
            { id: existing.id },
            { status: EnrolmentStatusEnum.ACTIVE, section_id: target.id, roll_no: null, joined_at: now, left_at: null, ...stamp },
          );
        } else {
          await repo.save(
            repo.create({
              organization_id: target.organization_id,
              session_id: target.session_id,
              class_id: target.class_id,
              section_id: target.id,
              student_id: student.student_id,
              status: EnrolmentStatusEnum.ACTIVE,
              roll_no: null,
              joined_at: now,
              invited_email: null,
              invited_phone: null,
              invitation_token: null,
              created_by: actor.id,
              created_user_name: actor.full_name ?? undefined,
              created_at: now,
            }),
          );
        }
        await repo.update({ id: row.id }, { status: EnrolmentStatusEnum.PROMOTED, left_at: now, ...stamp });
        result.promoted.push(student);
      }
    });
    return result;
  }

  // ------------------------------------------------------------------ helpers

  /**
   * Puts a row in a section: one section per class per session. A LEFT or PROMOTED row of the same
   * student in that session is reused, so the history stays one row per student per session.
   */
  private async place(section: SectionEntity, fields: EnrolmentFields, actor: Actor): Promise<EnrolmentEntity> {
    this.sessions.assertSessionOpen(await this.sessionOf(section));

    if (fields.student_id) {
      const existing = await this.enrolmentRepo.findOne({
        where: { session_id: section.session_id, class_id: section.class_id, student_id: fields.student_id },
      });
      if (existing && CURRENT_ENROLMENT_STATUSES.includes(existing.status)) {
        throw new ConflictException('This student is already in this class for this session');
      }
      if (existing) {
        await this.enrolmentRepo.update(
          { id: existing.id },
          {
            ...fields,
            section_id: section.id,
            left_at: null,
            updated_by: actor.id,
            updated_user_name: actor.full_name ?? undefined,
            updated_at: new Date(),
          },
        );
        return this.enrolmentRepo.findOneOrFail({ where: { id: existing.id } });
      }
    }

    return this.enrolmentRepo.save(
      this.enrolmentRepo.create({
        invited_email: null,
        invited_phone: null,
        invitation_token: null,
        joined_at: null,
        roll_no: null,
        ...fields,
        status: fields.status ?? EnrolmentStatusEnum.ACTIVE,
        organization_id: section.organization_id,
        session_id: section.session_id,
        class_id: section.class_id,
        section_id: section.id,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      }),
    );
  }

  /** A school's students are members (as on the class screens); a solo teacher's reach classes by enrolment only. */
  private async addSchoolMember(section: SectionEntity, studentId: string): Promise<void> {
    const classEntity = await this.sectionRepo.manager.getRepository(ClassEntity).findOneOrFail({ where: { id: section.class_id } });
    if (usesOrganizationRules(classEntity)) await this.organizationsService.upsertStudentMember(classEntity.organization_id, studentId);
  }

  private async sessionOf(section: SectionEntity): Promise<AcademicSessionEntity> {
    return this.sectionRepo.manager.getRepository(AcademicSessionEntity).findOneOrFail({ where: { id: section.session_id } });
  }

  private async findStudent(dto: EnrolStudentDto): Promise<UserEntity | null> {
    if (dto.student_id) {
      const student = await this.userRepo.findOne({ where: { id: dto.student_id, role: RolesEnum.STUDENT } });
      if (!student) throw new NotFoundException('Student not found');
      return student;
    }
    const contact = dto.email ?? dto.phone;
    if (!contact) throw new BadRequestException('Give a student, a phone number or an email');
    const user = await this.userService.findByContactOrPublicId(contact);
    if (user && user.role !== RolesEnum.STUDENT) throw new BadRequestException('This phone or email belongs to a staff account');
    return user;
  }
}
