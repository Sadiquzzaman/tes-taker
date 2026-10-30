import { globalSubjects } from 'src/subjects/global-subjects';
import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { soloOrganizationOf, usesOrganizationRules } from 'src/organizations/organization-rules';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, WhereExpressionBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentStatusEnum, ClassStudentView, toClassStudentView } from './class-student-view';
import { EnrolmentEntity, EnrolmentStatusEnum } from 'src/academics/entities/enrolment.entity';
import { EnrolmentsService } from 'src/academics/enrolments.service';
import { activeEnrolmentCondition } from 'src/academics/enrolment-queries';
import { teachesClassCondition, teachesSubjectCondition } from 'src/academics/teacher-queries';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';

/** Public class card when GET class details is called without a token */
export type ClassPublicSummary = {
  id: string;
  class_name: string;
  description: string | null;
  created_user_name: string | null;
};
import { RolesEnum } from 'src/common/enums/roles.enum';
import { EmailService } from 'src/email/email.service';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { randomUUID } from 'crypto';
import {
  emailsMatch,
  normalizeEmail,
  normalizePhone,
  phonesMatch,
} from 'src/common/utils/contact.util';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { generatePublicId } from 'src/common/utils/public-id.util';
import { ClassKindEnum } from './enums/class-kind.enum';
import { OrganizationsService } from 'src/organizations/organization.service';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { UserService } from 'src/user/user.service';
import { OrgContext } from 'src/organizations/interfaces/org-context.interface';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly organizationsService: OrganizationsService,
    private readonly organizationAccessService: OrganizationAccessService,
    private readonly userService: UserService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  /**
   * Create a new class
   */
  async create(
    dto: CreateClassDto,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<{
    class: ClassEntity;
    studentResults?: {
      added: number;
      invited: number;
      pending: number;
      errors: string[];
    };
  }> {
    if (orgContext?.organizationId) {
      await this.organizationAccessService.requireApprovedMember(
        orgContext.organizationId,
        jwtPayload.id,
      );

      const canManage = await this.organizationAccessService.canManageAcademicStructure(
        orgContext.organizationId,
        jwtPayload.id,
      );
      if (!canManage) {
        throw new ForbiddenException(
          'Only organization owners, admins, and assistants can create classes in this organization',
        );
      }
      dto.class_kind = ClassKindEnum.ORGANIZATION;
    } else if (dto.class_kind === ClassKindEnum.ORGANIZATION) {
      throw new BadRequestException('Organization classes require X-Organization-Id');
    }

    const classKind = orgContext?.organizationId
      ? dto.class_kind ?? ClassKindEnum.PERSONAL
      : ClassKindEnum.PERSONAL;

    if (orgContext?.organizationId && classKind === ClassKindEnum.ORGANIZATION) {
      await this.organizationAccessService.requireAcademicManager(
        orgContext.organizationId,
        jwtPayload.id,
      );
    }

    const resolvedSubjectIds = await this.resolveSubjectIds(
      dto.subject_ids,
      dto.subject_names,
      jwtPayload,
      orgContext?.organizationId,
      dto.new_subjects,
    );

    const classEntity = this.classRepo.create({
      class_name: dto.class_name,
      description: dto.description,
      public_id: generatePublicId('CLS'),
      teacher_id: jwtPayload.id,
      // Personal classes live in the teacher's SOLO organisation (P2-01).
      organization_id: orgContext?.organizationId ?? TenantContext.requireOrganizationId(),
      class_kind: classKind,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const savedClass = await this.classRepo.save(classEntity);

    if (resolvedSubjectIds.length) {
      await this.attachSubjects(savedClass.id, resolvedSubjectIds, jwtPayload, orgContext);
    }

    // Add students if provided (using emails and phone numbers)
    let studentResults;
    if (dto.students && dto.students.length > 0) {
      studentResults = await this.addStudentsByPhoneOrEmail(
        savedClass.id,
        dto.students,
        jwtPayload,
        orgContext,
      );
    }

    const classWithDetails = await this.findOne(savedClass.id, jwtPayload, orgContext);

    return {
      class: classWithDetails,
      studentResults,
    };
  }

  /**
   * Find all classes for a teacher (scoped by org context; never merges org + individual).
   */
  async findAll(
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity[]> {
    let classes: ClassEntity[];

    if (orgContext?.organizationId) {
      await this.organizationAccessService.requireApprovedMember(
        orgContext.organizationId,
        jwtPayload.id,
      );

      if (
        orgContext.memberRole === OrganizationMemberRoleEnum.OWNER ||
        orgContext.memberRole === OrganizationMemberRoleEnum.ADMIN ||
        orgContext.memberRole === OrganizationMemberRoleEnum.ASSISTANT
      ) {
        classes = await this.classRepo.find({
          where: { organization_id: orgContext.organizationId },
          relations: [
            'teacher',
            'classSubjects',
            'classSubjects.subject',
          ],
          order: { created_at: 'DESC' },
        });
      } else {
        // Classes the teacher teaches in, or is a section's class teacher of (P2-03 part 2b).
        const assignedRows = await this.classRepo
          .createQueryBuilder('assignedClass')
          .select('assignedClass.id', 'class_id')
          .where('assignedClass.organization_id = :orgId', { orgId: orgContext.organizationId })
          .andWhere(teachesClassCondition('assignedClass'), { teacherId: jwtPayload.id })
          .getRawMany<{ class_id: string }>();
        const assignedIds = assignedRows.map((row) => row.class_id);

        const qb = this.classRepo
          .createQueryBuilder('class')
          .leftJoinAndSelect('class.teacher', 'teacher')
          .leftJoinAndSelect('class.classSubjects', 'classSubjects')
          .leftJoinAndSelect('classSubjects.subject', 'classSubject')
          .where('class.organization_id = :orgId', { orgId: orgContext.organizationId })
          .andWhere('class.id IN (:...assignedIds)', {
            assignedIds: assignedIds.length > 0 ? assignedIds : ['00000000-0000-0000-0000-000000000000'],
          })
          .orderBy('class.created_at', 'DESC');

        classes = await qb.getMany();
      }
    } else {
      // Personal workspace = the teacher's SOLO organisation.
      classes = await tenantScoped(this.classRepo).find({
        where: { teacher_id: jwtPayload.id },
        relations: [
          'teacher',
          'classSubjects',
          'classSubjects.subject',
        ],
        order: { created_at: 'DESC' },
      });
    }

    // Past-exam statistics (batch, avoids N+1)
    await this.attachConductedExamStatistics(classes);
    await this.attachStudents(classes);

    return classes;
  }

  /**
   * Find a class by ID (public: name and description only).
   */
  async findOne(id: string): Promise<ClassPublicSummary>;
  /**
   * Find a class by ID with auth: full details for the owning teacher or admin roles.
   */
  async findOne(
    id: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity>;
  async findOne(
    id: string,
    jwtPayload?: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity | ClassPublicSummary> {
    const classEntity = await this.classRepo.findOne({
      where: { id },
      relations: jwtPayload
        ? [
            'teacher',
            'classSubjects',
            'classSubjects.subject',
          ]
        : [],
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    if (!jwtPayload) {
      return {
        id: classEntity.id,
        class_name: classEntity.class_name,
        description: classEntity.description ?? null,
        created_user_name: classEntity.created_user_name ?? null,
      };
    }

    if (
      jwtPayload.role !== RolesEnum.TEACHER &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to access this class');
    }

    if (
      jwtPayload.role === RolesEnum.ADMIN ||
      jwtPayload.role === RolesEnum.SUPER_ADMIN
    ) {
      await this.attachConductedExamStatistics([classEntity]);
      await this.attachStudents([classEntity]);
      return classEntity;
    }

    this.assertClassMatchesOrgContext(classEntity, orgContext);

    const canManage = await this.organizationAccessService.canManageClass(
      classEntity,
      jwtPayload.id,
      orgContext,
    );
    if (!canManage) {
      throw new ForbiddenException('You do not have permission to access this class');
    }

    // Conducted-exam statistics for teacher/admin detail view
    await this.attachConductedExamStatistics([classEntity]);
    await this.attachStudents([classEntity]);

    return classEntity;
  }

  /** The classes' current students (enrolments in open sessions) in the class_students shape. */
  private async attachStudents(classEntities: ClassEntity[]): Promise<void> {
    const byClass = await this.enrolments.currentForClasses(classEntities.map((c) => c.id));
    for (const classEntity of classEntities) {
      classEntity.classStudents = await this.hydrateClassStudents(byClass.get(classEntity.id) ?? []);
    }
  }

  /**
   * Resolve registered users onto class-student rows so the UI can show names
   * (including when students were added by Student ID / phone / email). An invitation whose
   * contact now has a verified student account is claimed by that student.
   */
  private async hydrateClassStudents(rows: EnrolmentEntity[]): Promise<ClassStudentView[]> {
    const linkedStudentIds = new Set(
      rows.map((row) => row.student_id).filter((id): id is string => Boolean(id)),
    );

    const views: ClassStudentView[] = [];
    for (const row of rows) {
      let user = row.student ?? null;

      if (!user && row.student_id) {
        user = await this.userRepo.findOne({ where: { id: row.student_id } });
      }

      if (!user) {
        const identifier = row.invited_email || row.invited_phone;
        if (identifier) {
          user = await this.userService.findByContactOrPublicId(identifier);
        }
      }

      if (
        user &&
        user.role === RolesEnum.STUDENT &&
        !row.student_id &&
        !linkedStudentIds.has(user.id) &&
        row.status === EnrolmentStatusEnum.INVITED &&
        user.is_otp_verified &&
        user.is_verified
      ) {
        linkedStudentIds.add(user.id);
        const claimed = await this.enrolments.claimInvitation(row, user.id, null);
        views.push(toClassStudentView({ ...claimed, student: user, section: row.section }));
        continue;
      }
      views.push(toClassStudentView({ ...row, student: user ?? null }));
    }
    return views;
  }

  private assertClassMatchesOrgContext(
    classEntity: ClassEntity,
    orgContext?: OrgContext | null,
  ): void {
    if (orgContext?.organizationId) {
      if (classEntity.organization_id !== orgContext.organizationId) {
        throw new ForbiddenException('Class does not belong to the current organization context');
      }
    } else if (usesOrganizationRules(classEntity)) {
      throw new ForbiddenException(
        'This class belongs to an organization. Provide X-Organization-Id.',
      );
    } else {
      // A personal session works in the teacher's SOLO organisation only.
      const tenant = TenantContext.current();
      if (tenant && classEntity.organization_id && classEntity.organization_id !== tenant.organizationId) {
        throw new ForbiddenException('This class is outside your selected workspace');
      }
    }
  }

  /**
   * Count exams that have already been conducted (ended) per class.
   * Uses exam_end_time < now — future/ongoing exams are excluded.
   */
  private async attachConductedExamStatistics(classEntities: ClassEntity[]): Promise<void> {
    if (classEntities.length === 0) {
      return;
    }

    const classIds = classEntities.map((c) => c.id);
    const now = new Date();

    const rows = await this.examRepo
      .createQueryBuilder('exam')
      .select('exam.class_id', 'class_id')
      .addSelect('COUNT(*)', 'conducted_count')
      .addSelect('MAX(exam.exam_end_time)', 'last_exam_end_time')
      .where('exam.class_id IN (:...classIds)', { classIds })
      .andWhere('exam.exam_end_time < :now', { now })
      .groupBy('exam.class_id')
      .getRawMany<{ class_id: string; conducted_count: string; last_exam_end_time: Date | null }>();

    const byClassId = new Map(
      rows.map((r) => [
        r.class_id,
        {
          count: Number(r.conducted_count) || 0,
          lastEnd: r.last_exam_end_time ? new Date(r.last_exam_end_time) : null,
        },
      ]),
    );

    for (const classEntity of classEntities) {
      const stats = byClassId.get(classEntity.id);
      classEntity.total_test_taken = stats?.count ?? 0;
      classEntity.last_test_taken_date = stats?.lastEnd ?? null;
    }
  }

  /**
   * Update a class
   */
  async update(
    id: string,
    dto: UpdateClassDto,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(id, jwtPayload, orgContext);

    if (dto.class_name) classEntity.class_name = dto.class_name;
    if (dto.description !== undefined) classEntity.description = dto.description;

    classEntity.updated_by = jwtPayload.id;
    classEntity.updated_user_name = jwtPayload.full_name;
    classEntity.updated_at = new Date();

    await this.classRepo.save(classEntity);

    return this.findOne(id, jwtPayload, orgContext);
  }

  /**
   * Delete a class
   */
  async delete(
    id: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const classEntity = await this.findOne(id, jwtPayload, orgContext);
    // Deleting a class would delete its student records too, so a class with any (even students who
    // left) stays (owner decision, P2-03).
    if (await this.enrolmentRepo.exists({ where: { class_id: id } })) {
      throw new BadRequestException('This class has student records, so it cannot be deleted');
    }
    await this.classRepo.remove(classEntity);
  }

  /**
   * Add students to a class by IDs (backward compatibility)
   */
  async addStudentsToClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);

    const students = await this.userRepo.find({
      where: { id: In(studentIds), role: RolesEnum.STUDENT },
    });

    if (students.length !== studentIds.length) {
      const foundIds = students.map((s) => s.id);
      const missingIds = studentIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Some students not found or are not students: ${missingIds.join(', ')}`,
      );
    }

    // Students already in the class
    const existingStudentIds = (await this.enrolments.currentForClass(classId))
      .map((row) => row.student_id)
      .filter((id): id is string => id !== null);

    // Filter out duplicates
    const newStudents = students.filter((s) => !existingStudentIds.includes(s.id));

    if (newStudents.length === 0) {
      throw new BadRequestException('All provided students are already in this class');
    }

    for (const student of newStudents) {
      await this.enrolments.addToClass(
        classEntity,
        { student_id: student.id, status: EnrolmentStatusEnum.ACTIVE, joined_at: new Date() },
        jwtPayload,
      );
    }

    if (usesOrganizationRules(classEntity)) {
      for (const student of newStudents) {
        await this.organizationsService.upsertStudentMember(
          classEntity.organization_id,
          student.id,
        );
      }
    }

    return this.findOne(classId, jwtPayload, orgContext);
  }

  /**
   * Add students by phone or email (bulk)
   */
  async addStudentsByPhoneOrEmail(
    classId: string,
    contacts: string[],
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<{
    added: number;
    invited: number;
    pending: number;
    errors: string[];
  }> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    const frontendUrl = resolveFrontendUrl(this.configService);

    let added = 0;
    let invited = 0;
    let pending = 0;
    const errors: string[] = [];

    // Current class students (enrolments in open sessions)
    const existingClassStudents = await this.enrolments.currentForClass(classId);

    const existingStudentIds = existingClassStudents
      .map(cs => cs.student_id)
      .filter(id => id !== null) as string[];
    const existingInvitedEmails = existingClassStudents
      .map(cs => cs.invited_email)
      .filter(email => email !== null) as string[];
    const existingInvitedPhones = existingClassStudents
      .map(cs => cs.invited_phone)
      .filter(phone => phone !== null) as string[];

    /** An invitation row (no account yet, or a staff account) and its email. */
    const invite = async (email: string, phone: string | null): Promise<void> => {
      await this.enrolments.addToClass(
        classEntity,
        {
          student_id: null,
          status: EnrolmentStatusEnum.INVITED,
          invited_email: email,
          invited_phone: phone,
          invitation_token: randomUUID(),
        },
        jwtPayload,
      );
      try {
        await this.emailService.sendInvitationEmail(
          email,
          `${frontendUrl}/join/class/${classId}`,
          classEntity.class_name,
          jwtPayload.full_name,
        );
        invited++;
      } catch (error) {
        errors.push(`Failed to send email to ${email}: ${error.message}`);
      }
    };

    /** A student account: joined when verified, otherwise pending approval. */
    const addStudent = async (student: UserEntity): Promise<void> => {
      if (student.is_otp_verified && student.is_verified) {
        await this.enrolments.addToClass(
          classEntity,
          { student_id: student.id, status: EnrolmentStatusEnum.ACTIVE, joined_at: new Date() },
          jwtPayload,
        );
        if (usesOrganizationRules(classEntity)) {
          await this.organizationsService.upsertStudentMember(
            classEntity.organization_id,
            student.id,
          );
        }
        added++;
      } else {
        await this.enrolments.addToClass(
          classEntity,
          { student_id: student.id, status: EnrolmentStatusEnum.PENDING, joined_at: new Date() },
          jwtPayload,
        );
        pending++;
      }
    };

    for (const contact of contacts) {
      const trimmedContact = contact.trim();
      if (!trimmedContact) continue;

      const isEmail = trimmedContact.includes('@');
      const normalizedEmail = isEmail ? normalizeEmail(trimmedContact) : null;
      const normalizedPhone = !isEmail ? normalizePhone(trimmedContact) : null;
      const isPhone = Boolean(normalizedPhone);

      if (!isEmail && !isPhone) {
        errors.push(`Invalid contact format: ${trimmedContact}`);
        continue;
      }

      try {
        if (isEmail && normalizedEmail) {
          // Check if already invited
          if (existingInvitedEmails.includes(normalizedEmail)) {
            continue;
          }

          // Find student by email
          const student = await this.userService.findByContactOrPublicId(trimmedContact);

          if (student && student.role === RolesEnum.STUDENT) {
            // Check if already in class
            if (existingStudentIds.includes(student.id)) {
              continue;
            }
            await addStudent(student);
          } else {
            // Not onboarded, or the email belongs to a teacher or admin: send an invitation
            await invite(normalizedEmail, null);
          }
        } else if (isPhone && normalizedPhone) {
          // Check if already invited
          if (existingInvitedPhones.includes(normalizedPhone)) {
            continue;
          }

          // Find student by phone
          const student = await this.userService.findByContactOrPublicId(trimmedContact);

          if (!student) {
            // Not onboarded — invitations require a resolvable email (no SMS)
            errors.push(
              `Cannot invite ${normalizedPhone}: no account email found. Invite using an email address instead.`,
            );
          } else if (student.role !== RolesEnum.STUDENT) {
            // User exists but is not a student - still send invitation via email
            const inviteEmail = normalizeEmail(student.email);
            if (!inviteEmail) {
              errors.push(
                `Cannot invite ${normalizedPhone}: no email on file. Provide an email contact instead.`,
              );
              continue;
            }
            await invite(inviteEmail, normalizedPhone);
          } else if (!existingStudentIds.includes(student.id)) {
            await addStudent(student);
          }
        }
      } catch (error) {
        errors.push(`Error processing ${normalizedEmail ?? normalizedPhone ?? trimmedContact}: ${error.message}`);
      }
    }

    return { added, invited, pending, errors };
  }

  /**
   * Approve a pending student
   */
  async approveStudent(
    classId: string,
    studentId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassStudentView> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);

    const classStudent = await this.enrolments.currentOfStudent(classId, studentId);

    if (!classStudent) {
      throw new NotFoundException('Student not found in this class');
    }

    if (classStudent.status !== EnrolmentStatusEnum.PENDING) {
      throw new BadRequestException(`Student status is ${toClassStudentView(classStudent).status}, cannot approve`);
    }

    const saved = await this.enrolments.update(
      classStudent.id,
      { status: EnrolmentStatusEnum.ACTIVE, joined_at: classStudent.joined_at ?? new Date() },
      jwtPayload,
    );

    if (usesOrganizationRules(classEntity)) {
      await this.organizationsService.upsertStudentMember(
        classEntity.organization_id,
        studentId,
      );
    }

    return toClassStudentView(saved);
  }

  /**
   * Generate share link for class
   */
  async generateShareLink(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<string> {
    await this.findOne(classId, jwtPayload, orgContext);
    const frontendUrl = resolveFrontendUrl(this.configService);
    return `${frontendUrl}/join/class/${classId}`;
  }

  /**
   * Join class by class id (authenticated student).
   * If the student was pre-invited (INVITED row matching email/phone), they become JOINED.
   * Otherwise they are added as PENDING until the teacher approves.
   */
  async joinClassByClassId(classId: string, studentId: string): Promise<ClassStudentView> {
    const classEntity = await this.classRepo.findOne({ where: { id: classId } });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    const student = await this.userRepo.findOne({
      where: { id: studentId },
    });

    if (!student || !student.is_otp_verified || !student.is_verified) {
      throw new BadRequestException('You must complete registration and verification before joining a class');
    }

    if (student.role !== RolesEnum.STUDENT) {
      throw new BadRequestException('Only students can join classes');
    }

    const existingMembership = await this.enrolments.currentOfStudent(classId, studentId);

    if (existingMembership?.status === EnrolmentStatusEnum.ACTIVE) {
      throw new BadRequestException('You are already in this class');
    }

    const invitedRow = await this.findMatchingInvitedRow(classId, student);

    if (invitedRow) {
      // A pending request of the same student is folded into the invitation (one row per session).
      const saved = await this.enrolments.claimInvitation(invitedRow, studentId, { id: classEntity.teacher_id });
      if (usesOrganizationRules(classEntity)) {
        await this.organizationsService.upsertStudentMember(
          classEntity.organization_id,
          studentId,
        );
      }
      return toClassStudentView(saved);
    }

    if (existingMembership) {
      if (existingMembership.status === EnrolmentStatusEnum.PENDING) {
        throw new BadRequestException('You already have a pending join request for this class');
      }
      throw new BadRequestException('You are already associated with this class');
    }

    const saved = await this.enrolments.addToClass(
      classEntity,
      { student_id: studentId, status: EnrolmentStatusEnum.PENDING, joined_at: new Date() },
      { id: studentId, full_name: student.full_name },
    );
    return toClassStudentView(saved);
  }

  /**
   * Returns true when the student is JOINED in the class.
   * Promotes a matching INVITED row (phone or email) to JOINED when found.
   */
  async resolveStudentClassMembership(classId: string, studentId: string): Promise<boolean> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return false;
    }

    const membership = await this.enrolments.currentOfStudent(classId, studentId);
    if (membership?.status === EnrolmentStatusEnum.ACTIVE) {
      return true;
    }

    const invitedRow = await this.findMatchingInvitedRow(classId, student);
    if (!invitedRow) {
      return false;
    }

    const classEntity = await this.classRepo.findOne({ where: { id: classId } });
    await this.enrolments.claimInvitation(invitedRow, studentId, classEntity ? { id: classEntity.teacher_id } : null);

    if (classEntity && usesOrganizationRules(classEntity)) {
      await this.organizationsService.upsertStudentMember(classEntity.organization_id, studentId);
    }

    return true;
  }

  private async findMatchingInvitedRow(
    classId: string,
    student: Pick<UserEntity, 'phone' | 'email'>,
  ): Promise<EnrolmentEntity | null> {
    const invitedRows = (await this.enrolments.currentForClass(classId)).filter(
      (row) => row.status === EnrolmentStatusEnum.INVITED,
    );

    return (
      invitedRows.find(
        (row) =>
          phonesMatch(row.invited_phone, student.phone) ||
          emailsMatch(row.invited_email, student.email),
      ) ?? null
    );
  }

  /**
   * Handle class invitation during registration
   * Uses class UUID to find matching invitation by phone/email
   */
  async handleClassInvitation(
    classId: string,
    studentId: string,
    phone: string,
    email?: string,
  ): Promise<void> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return;
    }

    const invitation = await this.findMatchingInvitedRow(classId, {
      phone: phone || student.phone,
      email: email ?? student.email ?? undefined,
    });

    if (!invitation) {
      return;
    }

    const cls = await this.classRepo.findOne({ where: { id: classId } });

    await this.enrolments.claimInvitation(invitation, studentId, cls ? { id: cls.teacher_id } : null);

    if (cls && usesOrganizationRules(cls)) {
      await this.organizationsService.upsertStudentMember(cls.organization_id, studentId);
    }
  }

  /**
   * Remove students from a class. Nothing is deleted: their enrolments are marked LEFT
   * (owner decision, P2-03), so the history stays.
   */
  async removeStudentsFromClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassEntity> {
    await this.findOne(classId, jwtPayload, orgContext);

    if (!studentIds.length) {
      return this.findOne(classId, jwtPayload, orgContext);
    }

    // Matched by enrolment (class student row) id or by student id, as before.
    const rows = (await this.enrolments.currentForClass(classId)).filter(
      (row) => studentIds.includes(row.id) || (row.student_id !== null && studentIds.includes(row.student_id)),
    );
    await this.enrolments.markLeft(rows.map((row) => row.id), jwtPayload);

    return this.findOne(classId, jwtPayload, orgContext);
  }

  /**
   * Classes the student has joined (JOINED status only).
   */
  async findAllForStudent(
    studentId: string,
    jwtPayload?: JwtPayloadInterface,
    filters?: {
      organization_id?: string;
      teacher_id?: string;
    },
  ): Promise<
    Array<{
      id: string;
      class_name: string;
      description: string | null;
      created_user_name: string | null;
      joined_at: Date | null;
      total_test_taken: number;
      last_test_taken_date: Date | null;
      organization_id: string | null;
      organization_name: string | null;
      teacher_id: string | null;
      context_label: string;
    }>
  > {
    const active = activeEnrolmentCondition('cs');
    const qb = this.enrolmentRepo
      .createQueryBuilder('cs')
      .innerJoinAndSelect('cs.class', 'class')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .leftJoinAndSelect('class.organization', 'organization')
      .where('cs.student_id = :studentId', { studentId })
      .andWhere(active.sql, active.params)
      .orderBy('cs.joined_at', 'DESC');

    this.applyStudentWorkspaceScopeToClassQuery(qb, jwtPayload);

    if (filters?.organization_id) {
      qb.andWhere('class.organization_id = :organizationId', {
        organizationId: filters.organization_id,
      });
    } else if (filters?.teacher_id) {
      qb.andWhere(`class.organization_id = (${soloOrganizationOf('teacherId')})`, {
        teacherId: filters.teacher_id,
      }).andWhere('class.teacher_id = :teacherId');
    }

    // One row per class, even when the student is enrolled in two open sessions of it.
    const memberships: EnrolmentEntity[] = [];
    for (const row of await qb.getMany()) {
      if (row.class && !memberships.some((m) => m.class_id === row.class_id)) memberships.push(row);
    }

    const classEntities = memberships.map((m) => m.class).filter(Boolean) as ClassEntity[];
    await this.attachConductedExamStatistics(classEntities);

    const statsByClassId = new Map(
      classEntities.map((c) => [
        c.id,
        { total_test_taken: c.total_test_taken ?? 0, last_test_taken_date: c.last_test_taken_date ?? null },
      ]),
    );

    return memberships
      .map((m) => {
        const teacherName =
          m.class.teacher?.full_name?.trim() ||
          m.class.created_user_name?.trim() ||
          'Teacher';
        const contextLabel = m.class.organization_id
          ? m.class.organization?.name || 'Organization'
          : `${teacherName}'s Classes`;

        return {
          id: m.class.id,
          class_name: m.class.class_name,
          description: m.class.description ?? null,
          created_user_name: m.class.created_user_name ?? m.class.teacher?.full_name ?? null,
          joined_at: m.joined_at ?? null,
          total_test_taken: statsByClassId.get(m.class.id)?.total_test_taken ?? 0,
          last_test_taken_date: statsByClassId.get(m.class.id)?.last_test_taken_date ?? null,
          organization_id: m.class.organization_id ?? null,
          organization_name: m.class.organization?.name ?? null,
          teacher_id: m.class.teacher_id ?? null,
          context_label: contextLabel,
        };
      });
  }

  /**
   * Class detail for an enrolled student, including classmates (name + joined_at only).
   */
  async findOneForStudent(
    classId: string,
    studentId: string,
    jwtPayload?: JwtPayloadInterface,
  ): Promise<{
    id: string;
    class_name: string;
    description: string | null;
    created_user_name: string | null;
    joined_at: Date | null;
    classmates: Array<{ name: string; joined_at: Date | null }>;
  }> {
    const membership = await this.enrolments.currentOfStudent(classId, studentId);

    if (membership?.status !== EnrolmentStatusEnum.ACTIVE) {
      throw new ForbiddenException('You are not enrolled in this class');
    }

    const classEntity = await this.classRepo.findOne({
      where: { id: classId },
      relations: ['teacher'],
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    this.assertStudentWorkspaceAllowsClass(classEntity, jwtPayload);
    await this.attachStudents([classEntity]);

    const classmates = (classEntity.classStudents || [])
      .filter(
        (cs) =>
          cs.status === ClassStudentStatusEnum.JOINED &&
          cs.student_id &&
          cs.student_id !== studentId,
      )
      .map((cs) => ({
        name:
          cs.student?.full_name?.trim() ||
          cs.student?.email ||
          cs.student?.phone ||
          'Student',
        joined_at: cs.joined_at ?? null,
      }))
      .sort((a, b) => {
        const ta = a.joined_at ? new Date(a.joined_at).getTime() : 0;
        const tb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
        return tb - ta;
      });

    return {
      id: classEntity.id,
      class_name: classEntity.class_name,
      description: classEntity.description ?? null,
      created_user_name:
        classEntity.created_user_name ?? classEntity.teacher?.full_name ?? null,
      joined_at: membership.joined_at ?? null,
      classmates,
    };
  }

  private applyStudentWorkspaceScopeToClassQuery(
    qb: WhereExpressionBuilder,
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (jwtPayload?.session_mode === 'organization' && jwtPayload.organization_id) {
      qb.andWhere('class.organization_id = :scopedOrganizationId', {
        scopedOrganizationId: jwtPayload.organization_id,
      });
      return;
    }

    if (jwtPayload?.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      qb.andWhere(`class.organization_id = (${soloOrganizationOf('scopedTeacherId')})`, {
        scopedTeacherId: jwtPayload.teacher_id,
      }).andWhere('class.teacher_id = :scopedTeacherId');
    }
  }

  private assertStudentWorkspaceAllowsClass(
    classEntity: ClassEntity,
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (!jwtPayload) {
      return;
    }

    if (jwtPayload.session_mode === 'organization' && jwtPayload.organization_id) {
      if (classEntity.organization_id !== jwtPayload.organization_id) {
        throw new ForbiddenException('This class is outside your selected workspace');
      }
      return;
    }

    if (jwtPayload.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      if (usesOrganizationRules(classEntity) || classEntity.teacher_id !== jwtPayload.teacher_id) {
        throw new ForbiddenException('This class is outside your selected workspace');
      }
    }
  }

  /**
   * Search students by name, email, or phone
   */
  async searchStudents(query: string): Promise<UserEntity[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const searchPattern = `%${query}%`;

    const students = await this.userRepo.find({
      where: [
        { full_name: ILike(searchPattern), role: RolesEnum.STUDENT },
        { email: ILike(searchPattern), role: RolesEnum.STUDENT },
        { phone: ILike(searchPattern), role: RolesEnum.STUDENT },
      ],
      select: ['id', 'full_name', 'email', 'phone'],
      take: 20,
    });

    return students;
  }

  /**
   * Get students in a class with status
   */
  async getClassStudents(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassStudentView[]> {
    await this.findOne(classId, jwtPayload, orgContext);
    return this.hydrateClassStudents(await this.enrolments.currentForClass(classId));
  }

  async listClassSubjects(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ) {
    await this.findOne(classId, jwtPayload, orgContext);
    return this.classSubjectRepo.find({
      where: { class_id: classId },
      relations: ['subject'],
      order: { created_at: 'ASC' },
    });
  }

  async listAssignedSubjectsForTeacher(
    classId: string,
    teacherId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ) {
    await this.findOne(classId, jwtPayload, orgContext);
    // The subjects the teacher teaches in this class (subject class teachers, P2-03 part 2b).
    const rows = await this.classSubjectRepo
      .createQueryBuilder('classSubject')
      .leftJoinAndSelect('classSubject.subject', 'subject')
      .where('classSubject.class_id = :classId', { classId })
      .andWhere(teachesSubjectCondition('classSubject'), { teacherId })
      .orderBy('classSubject.created_at', 'ASC')
      .getMany();

    return rows
      .map((row) => ({
        class_subject_id: row.id,
        subject_id: row.subject_id,
        name: row.subject?.name ?? '',
        code: row.subject?.code ?? null,
      }));
  }

  async assertTeacherAssignedToClassSubject(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<void> {
    const classSubject = await this.classSubjectRepo.findOne({
      where: { class_id: classId, subject_id: subjectId },
    });
    if (!classSubject) {
      throw new ForbiddenException('This subject is not attached to the selected class');
    }
    if (!(await this.organizationAccessService.isAssignedToClassSubject(teacherId, classSubject.id))) {
      throw new ForbiddenException(
        'You can only create tests for subjects assigned to you in this class',
      );
    }
  }

  private async resolveSubjectIds(
    subjectIds: string[] | undefined,
    subjectNames: string[] | undefined,
    jwtPayload: JwtPayloadInterface,
    organizationId?: string | null,
    newSubjects?: { name: string; code: string }[],
  ): Promise<string[]> {
    const resolved = [...(subjectIds ?? [])];

    if (organizationId) {
      for (const item of newSubjects ?? []) {
        const created = await this.organizationsService.findOrCreateOrganizationSubject(
          organizationId,
          jwtPayload.id,
          item,
          jwtPayload.full_name,
        );
        resolved.push(created.id);
      }
      return [...new Set(resolved)];
    }

    for (const rawName of subjectNames ?? []) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }
      const existing = await this.subjectRepo.findOne({
        where: { name, ...globalSubjects() },
      });
      if (existing) {
        resolved.push(existing.id);
        continue;
      }
      const created = await this.subjectRepo.save(
        this.subjectRepo.create({
          name,
          organization_id: null,
          created_by: jwtPayload.id,
          created_user_name: jwtPayload.full_name,
          created_at: new Date(),
        }),
      );
      resolved.push(created.id);
    }
    return [...new Set(resolved)];
  }

  private async assertCanManageClassSubjects(
    classEntity: ClassEntity,
    userId: string,
  ): Promise<void> {
    if (usesOrganizationRules(classEntity)) {
      await this.organizationAccessService.requireAcademicManager(
        classEntity.organization_id,
        userId,
      );
      return;
    }
    if (classEntity.teacher_id !== userId) {
      throw new ForbiddenException('You do not have permission to manage subjects for this class');
    }
  }

  async attachSubjects(
    classId: string,
    subjectIds: string[],
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassSubjectEntity[]> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    await this.assertCanManageClassSubjects(classEntity, jwtPayload.id);

    const uniqueIds = [...new Set(subjectIds)];
    const subjects = await this.subjectRepo.find({ where: { id: In(uniqueIds) } });
    if (subjects.length !== uniqueIds.length) {
      throw new BadRequestException('One or more subjects were not found');
    }

    if (usesOrganizationRules(classEntity)) {
      const invalid = subjects.some((subject) => subject.organization_id !== classEntity.organization_id);
      if (invalid) {
        throw new BadRequestException('Subjects must belong to this organization catalog');
      }
    } else if (subjects.some((subject) => Boolean(subject.organization_id))) {
      throw new BadRequestException('Organization subjects cannot be attached to a personal class');
    }

    const created: ClassSubjectEntity[] = [];
    for (const subjectId of uniqueIds) {
      const existing = await this.classSubjectRepo.findOne({
        where: { class_id: classId, subject_id: subjectId },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
      const row = this.classSubjectRepo.create({
        class_id: classId,
        subject_id: subjectId,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      });
      created.push(await this.classSubjectRepo.save(row));
    }
    return created;
  }

  async addClassSubject(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
    subjectId?: string,
    subjectName?: string,
    subjectCode?: string,
  ): Promise<ClassSubjectEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    let resolvedId = subjectId;

    if (!resolvedId && usesOrganizationRules(classEntity)) {
      if (!subjectName?.trim() || !subjectCode?.trim()) {
        throw new BadRequestException('subject_id or name and code are required');
      }
      const created = await this.organizationsService.findOrCreateOrganizationSubject(
        classEntity.organization_id,
        jwtPayload.id,
        { name: subjectName, code: subjectCode },
        jwtPayload.full_name,
      );
      resolvedId = created.id;
    } else if (!resolvedId && subjectName?.trim()) {
      const name = subjectName.trim();
      const existing = await this.subjectRepo.findOne({
        where: { name, ...globalSubjects() },
      });
      if (existing) {
        resolvedId = existing.id;
      } else {
        const created = await this.subjectRepo.save(
          this.subjectRepo.create({
            name,
            organization_id: null,
            created_by: jwtPayload.id,
            created_user_name: jwtPayload.full_name,
            created_at: new Date(),
          }),
        );
        resolvedId = created.id;
      }
    }
    if (!resolvedId) {
      throw new BadRequestException('subject_id or name is required');
    }
    const rows = await this.attachSubjects(classId, [resolvedId], jwtPayload, orgContext);
    return rows[0];
  }

  async removeClassSubject(
    classId: string,
    classSubjectId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    await this.assertCanManageClassSubjects(classEntity, jwtPayload.id);

    const row = await this.classSubjectRepo.findOne({
      where: { id: classSubjectId, class_id: classId },
    });
    if (!row) {
      throw new NotFoundException('Class subject not found');
    }
    await this.classSubjectRepo.remove(row);
  }
}
