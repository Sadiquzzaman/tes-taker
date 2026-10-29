import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { AcademicSessionsService } from './academic-sessions.service';
import { AcademicSessionEntity } from './entities/academic-session.entity';
import { CourseOfferingEntity, OfferingEnrolmentModeEnum } from './entities/course-offering.entity';
import { EnrolmentEntity, EnrolmentStatusEnum } from './entities/enrolment.entity';
import { OfferingEnrolmentEntity, OfferingEnrolmentStatusEnum } from './entities/offering-enrolment.entity';
import { OfferingTeacherEntity } from './entities/offering-teacher.entity';
import { SectionEntity } from './entities/section.entity';
import { OfferingRosterService, RosterStudent } from './offering-roster.service';
import {
  CreateOfferingDto,
  CreateSectionDto,
  SetOfferingStudentsDto,
  SetOfferingTeachersDto,
  UpdateOfferingDto,
  UpdateSectionDto,
} from './dto/section.dto';

interface Actor {
  id: string;
  full_name?: string | null;
}

type PersonView = { id: string; full_name: string };

export interface SectionView {
  id: string;
  class_id: string;
  session_id: string;
  name: string;
  shift: SectionEntity['shift'];
  room: string | null;
  class_teacher: PersonView | null;
  student_count: number;
}

export interface OfferingView {
  id: string;
  section_id: string;
  session_id: string;
  term_id: string | null;
  subject: { id: string; name: string; code: string | null };
  enrolment_mode: OfferingEnrolmentModeEnum;
  is_optional: boolean;
  teachers: PersonView[];
}

export interface EnrolmentView {
  id: string;
  student: (PersonView & { email: string | null; phone: string | null }) | null;
  roll_no: string | null;
  status: EnrolmentStatusEnum;
  invited_phone: string | null;
  invited_email: string | null;
  joined_at: Date | null;
}

const person = (user?: UserEntity | null): PersonView | null => (user ? { id: user.id, full_name: user.full_name } : null);

/**
 * Sections of a class in a session (FND-02) and their subject classes (FND-19): teachers per
 * section + subject, and the students of optional subjects. Writes only the academics tables.
 */
@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    @InjectRepository(CourseOfferingEntity)
    private readonly offeringRepo: Repository<CourseOfferingEntity>,
    @InjectRepository(OfferingTeacherEntity)
    private readonly offeringTeacherRepo: Repository<OfferingTeacherEntity>,
    @InjectRepository(OfferingEnrolmentEntity)
    private readonly offeringEnrolmentRepo: Repository<OfferingEnrolmentEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    private readonly sessions: AcademicSessionsService,
    private readonly settings: OrgSettingsService,
    private readonly accessService: OrganizationAccessService,
    private readonly roster: OfferingRosterService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ sections

  async listForClass(classId: string, sessionId?: string): Promise<SectionView[]> {
    const classEntity = await this.findClass(classId);
    const session = await this.resolveSession(classEntity.organization_id as string, sessionId);
    const sections = await tenantScoped(this.sectionRepo).find({
      where: { class_id: classId, session_id: session.id },
      relations: ['class_teacher'],
      order: { name: 'ASC' },
    });
    return this.toSectionViews(sections);
  }

  async findSection(id: string): Promise<SectionEntity> {
    const section = await tenantScoped(this.sectionRepo).findOne({ where: { id }, relations: ['class_teacher'] });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async getSection(id: string): Promise<SectionView> {
    const [view] = await this.toSectionViews([await this.findSection(id)]);
    return view;
  }

  /** A new section gets a subject class for each of the class's subjects. */
  async createSection(classId: string, dto: CreateSectionDto, actor: Actor): Promise<SectionView> {
    const classEntity = await this.findClass(classId);
    const organizationId = classEntity.organization_id as string;
    const session = await this.resolveSession(organizationId, dto.session_id);
    this.sessions.assertSessionOpen(session);
    if (dto.class_teacher_id) await this.assertClassTeacher(organizationId, dto.class_teacher_id);
    await this.assertNameFree(classId, session.id, dto.name);

    const sectionId = await this.dataSource.transaction(async (manager) => {
      const section = await manager.getRepository(SectionEntity).save(
        manager.getRepository(SectionEntity).create({
          organization_id: organizationId,
          class_id: classId,
          session_id: session.id,
          name: dto.name.trim(),
          shift: dto.shift ?? null,
          room: dto.room?.trim() || null,
          class_teacher_id: dto.class_teacher_id ?? null,
          created_by: actor.id,
          created_user_name: actor.full_name ?? undefined,
          created_at: new Date(),
        }),
      );
      const subjects = await manager.getRepository(ClassSubjectEntity).find({ where: { class_id: classId } });
      if (subjects.length > 0) {
        await manager.getRepository(CourseOfferingEntity).save(
          subjects.map((cs) =>
            manager.getRepository(CourseOfferingEntity).create({
              organization_id: organizationId,
              session_id: session.id,
              section_id: section.id,
              subject_id: cs.subject_id,
              created_by: actor.id,
              created_user_name: actor.full_name ?? undefined,
              created_at: new Date(),
            }),
          ),
        );
      }
      return section.id;
    });
    return this.getSection(sectionId);
  }

  async updateSection(id: string, dto: UpdateSectionDto, actor: Actor): Promise<SectionView> {
    const section = await this.findSection(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(section.session_id));
    const patch: Partial<SectionEntity> = { updated_by: actor.id, updated_at: new Date() };
    if (actor.full_name) patch.updated_user_name = actor.full_name;
    if (dto.name !== undefined && dto.name.trim() !== section.name) {
      await this.assertNameFree(section.class_id, section.session_id, dto.name);
      patch.name = dto.name.trim();
    }
    if (dto.shift !== undefined) patch.shift = dto.shift;
    if (dto.room !== undefined) patch.room = dto.room?.trim() || null;
    if (dto.class_teacher_id !== undefined) {
      if (dto.class_teacher_id) await this.assertClassTeacher(section.organization_id, dto.class_teacher_id);
      patch.class_teacher_id = dto.class_teacher_id;
    }
    await this.sectionRepo.update({ id }, patch);
    return this.getSection(id);
  }

  /** A class keeps at least one section per session, and a section with students stays. */
  async removeSection(id: string): Promise<void> {
    const section = await this.findSection(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(section.session_id));
    const siblings = await tenantScoped(this.sectionRepo).count({ where: { class_id: section.class_id, session_id: section.session_id } });
    if (siblings <= 1) throw new BadRequestException('A class must have at least one section');
    const students = await tenantScoped(this.enrolmentRepo).count({ where: { section_id: id } });
    if (students > 0) throw new BadRequestException('Move or remove the students of this section first');
    await this.sectionRepo.delete({ id });
  }

  async listEnrolments(sectionId: string): Promise<EnrolmentView[]> {
    await this.findSection(sectionId);
    const rows = await tenantScoped(this.enrolmentRepo).find({
      where: { section_id: sectionId },
      relations: ['student'],
      order: { roll_no: 'ASC', created_at: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      student: row.student
        ? { id: row.student.id, full_name: row.student.full_name, email: row.student.email ?? null, phone: row.student.phone ?? null }
        : null,
      roll_no: row.roll_no,
      status: row.status,
      invited_phone: row.invited_phone,
      invited_email: row.invited_email,
      joined_at: row.joined_at,
    }));
  }

  // ----------------------------------------------------------- subject classes

  async listOfferings(sectionId: string): Promise<OfferingView[]> {
    await this.findSection(sectionId);
    const offerings = await tenantScoped(this.offeringRepo).find({ where: { section_id: sectionId }, relations: ['subject'] });
    return this.toOfferingViews(offerings);
  }

  async findOffering(id: string): Promise<CourseOfferingEntity> {
    const offering = await tenantScoped(this.offeringRepo).findOne({ where: { id }, relations: ['subject'] });
    if (!offering) throw new NotFoundException('Subject class not found');
    return offering;
  }

  async getOffering(id: string): Promise<OfferingView> {
    const [view] = await this.toOfferingViews([await this.findOffering(id)]);
    return view;
  }

  async createOffering(sectionId: string, dto: CreateOfferingDto, actor: Actor): Promise<OfferingView> {
    const section = await this.findSection(sectionId);
    this.sessions.assertSessionOpen(await this.sessions.findOne(section.session_id));
    const subject = await this.subjectRepo.findOne({ where: { id: dto.subject_id } });
    if (!subject || (subject.organization_id && subject.organization_id !== section.organization_id)) {
      throw new NotFoundException('Subject not found');
    }
    const exists = await tenantScoped(this.offeringRepo).count({ where: { section_id: sectionId, subject_id: dto.subject_id, term_id: IsNull() } });
    if (exists > 0) throw new ConflictException('This subject is already taught in this section');
    const saved = await this.offeringRepo.save(
      this.offeringRepo.create({
        organization_id: section.organization_id,
        session_id: section.session_id,
        section_id: sectionId,
        subject_id: dto.subject_id,
        enrolment_mode: dto.enrolment_mode ?? OfferingEnrolmentModeEnum.WHOLE_SECTION,
        is_optional: dto.is_optional ?? dto.enrolment_mode === OfferingEnrolmentModeEnum.SELECTED,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      }),
    );
    return this.getOffering(saved.id);
  }

  async updateOffering(id: string, dto: UpdateOfferingDto, actor: Actor): Promise<OfferingView> {
    const offering = await this.findOffering(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(offering.session_id));
    await this.offeringRepo.update(
      { id },
      {
        enrolment_mode: dto.enrolment_mode ?? offering.enrolment_mode,
        is_optional: dto.is_optional ?? offering.is_optional,
        updated_by: actor.id,
        updated_at: new Date(),
      },
    );
    return this.getOffering(id);
  }

  async removeOffering(id: string): Promise<void> {
    const offering = await this.findOffering(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(offering.session_id));
    await this.offeringRepo.delete({ id });
  }

  /** Replaces the teachers of a subject class. All of them are equal teachers of that subject. */
  async setTeachers(id: string, dto: SetOfferingTeachersDto, actor: Actor): Promise<OfferingView> {
    const offering = await this.findOffering(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(offering.session_id));
    const teacherIds = [...new Set(dto.teacher_ids)];
    for (const teacherId of teacherIds) {
      await this.assertTeachingMember(offering.organization_id, teacherId);
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OfferingTeacherEntity);
      const current = await repo.find({ where: { offering_id: id } });
      const removed = current.filter((row) => !teacherIds.includes(row.teacher_id));
      if (removed.length > 0) await repo.delete({ id: In(removed.map((row) => row.id)) });
      const added = teacherIds.filter((teacherId) => !current.some((row) => row.teacher_id === teacherId));
      if (added.length > 0) {
        await repo.save(
          added.map((teacher_id) =>
            repo.create({
              organization_id: offering.organization_id,
              offering_id: id,
              teacher_id,
              created_by: actor.id,
              created_user_name: actor.full_name ?? undefined,
              created_at: new Date(),
            }),
          ),
        );
      }
    });
    return this.getOffering(id);
  }

  /** Picks the students of an optional subject (SELECTED); they must be active in the section. */
  async setStudents(id: string, dto: SetOfferingStudentsDto, actor: Actor): Promise<RosterStudent[]> {
    const offering = await this.findOffering(id);
    this.sessions.assertSessionOpen(await this.sessions.findOne(offering.session_id));
    if (offering.enrolment_mode !== OfferingEnrolmentModeEnum.SELECTED) {
      throw new BadRequestException('Switch this subject class to selected students first');
    }
    const studentIds = [...new Set(dto.student_ids)];
    if (studentIds.length > 0) {
      const active = await tenantScoped(this.enrolmentRepo).count({
        where: { section_id: offering.section_id, status: EnrolmentStatusEnum.ACTIVE, student_id: In(studentIds) },
      });
      if (active !== studentIds.length) {
        throw new BadRequestException('Every selected student must be an active student of this section');
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OfferingEnrolmentEntity);
      const current = await repo.find({ where: { offering_id: id } });
      const removed = current.filter((row) => !studentIds.includes(row.student_id));
      if (removed.length > 0) await repo.delete({ id: In(removed.map((row) => row.id)) });
      const reactivated = current.filter((row) => studentIds.includes(row.student_id) && row.status !== OfferingEnrolmentStatusEnum.ACTIVE);
      if (reactivated.length > 0) {
        await repo.update({ id: In(reactivated.map((row) => row.id)) }, { status: OfferingEnrolmentStatusEnum.ACTIVE });
      }
      const added = studentIds.filter((studentId) => !current.some((row) => row.student_id === studentId));
      if (added.length > 0) {
        await repo.save(
          added.map((student_id) =>
            repo.create({
              organization_id: offering.organization_id,
              offering_id: id,
              student_id,
              status: OfferingEnrolmentStatusEnum.ACTIVE,
              created_by: actor.id,
              created_user_name: actor.full_name ?? undefined,
              created_at: new Date(),
            }),
          ),
        );
      }
    });
    return this.roster.students(offering);
  }

  async rosterOf(id: string): Promise<RosterStudent[]> {
    return this.roster.students(await this.findOffering(id));
  }

  // ------------------------------------------------------------------ helpers

  private async findClass(classId: string): Promise<ClassEntity> {
    const classEntity = await tenantScoped(this.classRepo).findOne({ where: { id: classId } });
    if (!classEntity) throw new NotFoundException('Class not found');
    return classEntity;
  }

  private async resolveSession(organizationId: string, sessionId?: string): Promise<AcademicSessionEntity> {
    return sessionId ? this.sessions.findOne(sessionId) : this.sessions.ensureDefault(organizationId);
  }

  private async assertNameFree(classId: string, sessionId: string, name: string): Promise<void> {
    const taken = await tenantScoped(this.sectionRepo).count({ where: { class_id: classId, session_id: sessionId, name: name.trim() } });
    if (taken > 0) throw new ConflictException('This class already has a section with that name in this session');
  }

  /** The class teacher: used only when the organisation has class teachers switched on. */
  private async assertClassTeacher(organizationId: string, teacherId: string): Promise<void> {
    const settings = await this.settings.get(organizationId);
    if (!settings.class_teacher_enabled) {
      throw new BadRequestException('Class teachers are switched off for this organisation');
    }
    await this.assertTeachingMember(organizationId, teacherId);
  }

  private async assertTeachingMember(organizationId: string, teacherId: string): Promise<void> {
    const membership = await this.accessService.getMembership(organizationId, teacherId);
    if (!this.accessService.isAssignableTeachingRole(membership?.role)) {
      throw new BadRequestException('The teacher must be a teaching member of this organisation');
    }
  }

  private async toSectionViews(sections: SectionEntity[]): Promise<SectionView[]> {
    if (sections.length === 0) return [];
    const counts: Array<{ section_id: string; count: string }> = await this.enrolmentRepo
      .createQueryBuilder('e')
      .select('e.section_id', 'section_id')
      .addSelect('COUNT(*)', 'count')
      .where('e.section_id IN (:...ids) AND e.status = :active', { ids: sections.map((s) => s.id), active: EnrolmentStatusEnum.ACTIVE })
      .groupBy('e.section_id')
      .getRawMany();
    return sections.map((section) => ({
      id: section.id,
      class_id: section.class_id,
      session_id: section.session_id,
      name: section.name,
      shift: section.shift,
      room: section.room,
      class_teacher: person(section.class_teacher),
      student_count: Number(counts.find((c) => c.section_id === section.id)?.count ?? 0),
    }));
  }

  private async toOfferingViews(offerings: CourseOfferingEntity[]): Promise<OfferingView[]> {
    if (offerings.length === 0) return [];
    const teachers = await this.offeringTeacherRepo.find({
      where: { offering_id: In(offerings.map((o) => o.id)) },
      relations: ['teacher'],
      order: { created_at: 'ASC' },
    });
    return offerings
      .map((offering) => ({
        id: offering.id,
        section_id: offering.section_id,
        session_id: offering.session_id,
        term_id: offering.term_id,
        subject: { id: offering.subject.id, name: offering.subject.name, code: offering.subject.code },
        enrolment_mode: offering.enrolment_mode,
        is_optional: offering.is_optional,
        teachers: teachers
          .filter((row) => row.offering_id === offering.id)
          .map((row) => person(row.teacher))
          .filter((p): p is PersonView => p !== null),
      }))
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name));
  }
}
