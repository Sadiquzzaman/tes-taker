import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from './entities/class-student.entity';
import { ClassTeacherEntity } from './entities/class-teacher.entity';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from './entities/class-subject-teacher.entity';
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
    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,
    @InjectRepository(ClassTeacherEntity)
    private readonly classTeacherRepo: Repository<ClassTeacherEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(ClassSubjectTeacherEntity)
    private readonly classSubjectTeacherRepo: Repository<ClassSubjectTeacherEntity>,
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
      organization_id: orgContext?.organizationId ?? null,
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
            'classStudents',
            'classStudents.student',
            'teacher',
            'classTeachers',
            'classSubjects',
            'classSubjects.subject',
            'classSubjects.teachers',
            'classSubjects.teachers.teacher',
          ],
          order: { created_at: 'DESC' },
        });
      } else {
        const assignedRows = await this.classSubjectTeacherRepo
          .createQueryBuilder('cst')
          .innerJoin('cst.classSubject', 'classSubject')
          .innerJoin('classSubject.class', 'assignedClass')
          .where('cst.teacher_id = :userId', { userId: jwtPayload.id })
          .andWhere('assignedClass.organization_id = :orgId', {
            orgId: orgContext.organizationId,
          })
          .select('classSubject.class_id', 'class_id')
          .distinct(true)
          .getRawMany<{ class_id: string }>();
        const assignedIds = assignedRows.map((row) => row.class_id);

        const qb = this.classRepo
          .createQueryBuilder('class')
          .leftJoinAndSelect('class.classStudents', 'classStudents')
          .leftJoinAndSelect('classStudents.student', 'student')
          .leftJoinAndSelect('class.teacher', 'teacher')
          .leftJoinAndSelect('class.classTeachers', 'classTeachers')
          .leftJoinAndSelect('class.classSubjects', 'classSubjects')
          .leftJoinAndSelect('classSubjects.subject', 'classSubject')
          .leftJoinAndSelect('classSubjects.teachers', 'classSubjectTeachers')
          .leftJoinAndSelect('classSubjectTeachers.teacher', 'classSubjectTeacherUser')
          .where('class.organization_id = :orgId', { orgId: orgContext.organizationId })
          .andWhere('class.id IN (:...assignedIds)', {
            assignedIds: assignedIds.length > 0 ? assignedIds : ['00000000-0000-0000-0000-000000000000'],
          })
          .orderBy('class.created_at', 'DESC');

        classes = await qb.getMany();
      }
    } else {
      classes = await this.classRepo.find({
        where: { teacher_id: jwtPayload.id, organization_id: IsNull() },
        relations: [
          'classStudents',
          'classStudents.student',
          'teacher',
          'classTeachers',
          'classSubjects',
          'classSubjects.subject',
          'classSubjects.teachers',
          'classSubjects.teachers.teacher',
        ],
        order: { created_at: 'DESC' },
      });
    }

    // Past-exam statistics (batch, avoids N+1)
    await this.attachConductedExamStatistics(classes);

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
            'classStudents',
            'classStudents.student',
            'teacher',
            'classTeachers',
            'classTeachers.teacher',
            'classSubjects',
            'classSubjects.subject',
            'classSubjects.teachers',
            'classSubjects.teachers.teacher',
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
      await this.hydrateClassStudents(classEntity);
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
    await this.hydrateClassStudents(classEntity);

    return classEntity;
  }

  /**
   * Resolve registered users onto class-student rows so the UI can show names
   * (including when students were added by Student ID / phone / email).
   */
  private async hydrateClassStudents(classEntity: ClassEntity): Promise<void> {
    const rows = classEntity.classStudents || [];
    if (rows.length === 0) {
      return;
    }

    const linkedStudentIds = new Set(
      rows.map((row) => row.student_id).filter((id): id is string => Boolean(id)),
    );

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
        !linkedStudentIds.has(user.id)
      ) {
        row.student_id = user.id;
        row.student = user;
        linkedStudentIds.add(user.id);
        if (
          row.status === ClassStudentStatusEnum.INVITED &&
          user.is_otp_verified &&
          user.is_verified
        ) {
          row.status = ClassStudentStatusEnum.JOINED;
          row.joined_at = row.joined_at ?? new Date();
          row.approved_at = row.approved_at ?? new Date();
        }
        await this.classStudentRepo.save(row);
      } else if (user) {
        row.student = user;
      }
    }
  }

  private assertClassMatchesOrgContext(
    classEntity: ClassEntity,
    orgContext?: OrgContext | null,
  ): void {
    if (orgContext?.organizationId) {
      if (classEntity.organization_id !== orgContext.organizationId) {
        throw new ForbiddenException('Class does not belong to the current organization context');
      }
    } else if (classEntity.organization_id) {
      throw new ForbiddenException(
        'This class belongs to an organization. Provide X-Organization-Id.',
      );
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

    // Get existing student IDs in class
    const existingClassStudents = await this.classStudentRepo.find({
      where: { class_id: classId },
      select: ['student_id'],
    });
    const existingStudentIds = existingClassStudents
      .map(cs => cs.student_id)
      .filter(id => id !== null) as string[];

    // Filter out duplicates
    const newStudents = students.filter((s) => !existingStudentIds.includes(s.id));

    if (newStudents.length === 0) {
      throw new BadRequestException('All provided students are already in this class');
    }

    // Create ClassStudentEntity records with status JOINED
    const classStudentEntities = newStudents.map(student =>
      this.classStudentRepo.create({
        class_id: classId,
        student_id: student.id,
        status: ClassStudentStatusEnum.JOINED,
        joined_at: new Date(),
        approved_at: new Date(),
        approved_by: jwtPayload.id,
      })
    );

    await this.classStudentRepo.save(classStudentEntities);

    if (classEntity.organization_id) {
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

    // Get existing class students
    const existingClassStudents = await this.classStudentRepo.find({
      where: { class_id: classId },
    });

    const existingStudentIds = existingClassStudents
      .map(cs => cs.student_id)
      .filter(id => id !== null) as string[];
    const existingInvitedEmails = existingClassStudents
      .map(cs => cs.invited_email)
      .filter(email => email !== null) as string[];
    const existingInvitedPhones = existingClassStudents
      .map(cs => cs.invited_phone)
      .filter(phone => phone !== null) as string[];

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

          if (student) {
            if (student.role !== RolesEnum.STUDENT) {
              // User exists but is not a student - still send invitation
              // This handles cases where phone/email belongs to a teacher or admin
              const invitationToken = randomUUID();
              const invitationLink = `${frontendUrl}/join/class/${classId}`;

              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: null,
                  status: ClassStudentStatusEnum.INVITED,
                  invited_email: normalizedEmail,
                  invitation_token: invitationToken,
                  invited_at: new Date(),
                })
              );

              // Send email invitation
              try {
                await this.emailService.sendInvitationEmail(
                  normalizedEmail,
                  invitationLink,
                  classEntity.class_name,
                  jwtPayload.full_name,
                );
                invited++;
              } catch (error) {
                errors.push(`Failed to send email to ${normalizedEmail}: ${error.message}`);
              }
              continue;
            }

            // Check if already in class
            if (existingStudentIds.includes(student.id)) {
              continue;
            }

            // Add student with appropriate status
            if (student.is_otp_verified && student.is_verified) {
              // Directly joined
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.JOINED,
                  joined_at: new Date(),
                  approved_at: new Date(),
                  approved_by: jwtPayload.id,
                })
              );
              if (classEntity.organization_id) {
                await this.organizationsService.upsertStudentMember(
                  classEntity.organization_id,
                  student.id,
                );
              }
              added++;
            } else {
              // Pending approval
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.PENDING,
                  joined_at: new Date(),
                })
              );
              pending++;
            }
          } else {
            // Not onboarded - send invitation
            const invitationToken = randomUUID();
            const invitationLink = `${frontendUrl}/join/class/${classId}`;

            await this.classStudentRepo.save(
              this.classStudentRepo.create({
                class_id: classId,
                student_id: null,
                status: ClassStudentStatusEnum.INVITED,
                invited_email: normalizedEmail,
                invitation_token: invitationToken,
                invited_at: new Date(),
              })
            );

            // Send email invitation
            try {
            await this.emailService.sendInvitationEmail(
              normalizedEmail,
              invitationLink,
              classEntity.class_name,
              jwtPayload.full_name,
            );
            invited++;
            } catch (error) {
              errors.push(`Failed to send email to ${normalizedEmail}: ${error.message}`);
            }
          }
        } else if (isPhone && normalizedPhone) {
          // Check if already invited
          if (existingInvitedPhones.includes(normalizedPhone)) {
            continue;
          }

          // Find student by phone
          const student = await this.userService.findByContactOrPublicId(trimmedContact);

          if (student) {
            if (student.role !== RolesEnum.STUDENT) {
              // User exists but is not a student - still send invitation via email
              const inviteEmail = normalizeEmail(student.email);
              if (!inviteEmail) {
                errors.push(
                  `Cannot invite ${normalizedPhone}: no email on file. Provide an email contact instead.`,
                );
                continue;
              }

              const invitationToken = randomUUID();
              const invitationLink = `${frontendUrl}/join/class/${classId}`;

              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: null,
                  status: ClassStudentStatusEnum.INVITED,
                  invited_phone: normalizedPhone,
                  invited_email: inviteEmail,
                  invitation_token: invitationToken,
                  invited_at: new Date(),
                })
              );

              try {
                await this.emailService.sendInvitationEmail(
                  inviteEmail,
                  invitationLink,
                  classEntity.class_name,
                  jwtPayload.full_name,
                );
                invited++;
              } catch (error) {
                errors.push(`Failed to send email to ${inviteEmail}: ${error.message}`);
              }
              continue;
            }

            // Check if already in class
            if (existingStudentIds.includes(student.id)) {
              continue;
            }

            // Add student with appropriate status
            if (student.is_otp_verified && student.is_verified) {
              // Directly joined
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.JOINED,
                  joined_at: new Date(),
                  approved_at: new Date(),
                  approved_by: jwtPayload.id,
                })
              );
              if (classEntity.organization_id) {
                await this.organizationsService.upsertStudentMember(
                  classEntity.organization_id,
                  student.id,
                );
              }
              added++;
            } else {
              // Pending approval
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.PENDING,
                  joined_at: new Date(),
                })
              );
              pending++;
            }
          } else {
            // Not onboarded — invitations require a resolvable email (no SMS)
            errors.push(
              `Cannot invite ${normalizedPhone}: no account email found. Invite using an email address instead.`,
            );
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
  ): Promise<ClassStudentEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);

    const classStudent = await this.classStudentRepo.findOne({
      where: { class_id: classId, student_id: studentId },
    });

    if (!classStudent) {
      throw new NotFoundException('Student not found in this class');
    }

    if (classStudent.status !== ClassStudentStatusEnum.PENDING) {
      throw new BadRequestException(`Student status is ${classStudent.status}, cannot approve`);
    }

    classStudent.status = ClassStudentStatusEnum.JOINED;
    classStudent.approved_at = new Date();
    classStudent.approved_by = jwtPayload.id;

    const saved = await this.classStudentRepo.save(classStudent);

    if (classEntity.organization_id) {
      await this.organizationsService.upsertStudentMember(
        classEntity.organization_id,
        studentId,
      );
    }

    return saved;
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
  async joinClassByClassId(classId: string, studentId: string): Promise<ClassStudentEntity> {
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

    const existingMembership = await this.classStudentRepo.findOne({
      where: { class_id: classId, student_id: studentId },
    });

    if (existingMembership?.status === ClassStudentStatusEnum.JOINED) {
      throw new BadRequestException('You are already in this class');
    }

    const invitedRow = await this.findMatchingInvitedRow(classId, student);

    if (invitedRow) {
      if (existingMembership && existingMembership.status === ClassStudentStatusEnum.PENDING) {
        await this.classStudentRepo.remove(existingMembership);
      }

      invitedRow.student_id = studentId;
      invitedRow.status = ClassStudentStatusEnum.JOINED;
      invitedRow.joined_at = new Date();
      invitedRow.invitation_token = null;
      invitedRow.invited_email = null;
      invitedRow.invited_phone = null;
      invitedRow.approved_at = new Date();
      invitedRow.approved_by = classEntity.teacher_id;
      const saved = await this.classStudentRepo.save(invitedRow);
      if (classEntity.organization_id) {
        await this.organizationsService.upsertStudentMember(
          classEntity.organization_id,
          studentId,
        );
      }
      return saved;
    }

    if (existingMembership) {
      if (existingMembership.status === ClassStudentStatusEnum.PENDING) {
        throw new BadRequestException('You already have a pending join request for this class');
      }
      throw new BadRequestException('You are already associated with this class');
    }

    const classStudent = this.classStudentRepo.create({
      class_id: classId,
      student_id: studentId,
      status: ClassStudentStatusEnum.PENDING,
      joined_at: new Date(),
    });

    return await this.classStudentRepo.save(classStudent);
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

    const joinedMembership = await this.classStudentRepo.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
        status: ClassStudentStatusEnum.JOINED,
      },
    });

    if (joinedMembership) {
      return true;
    }

    const invitedRow = await this.findMatchingInvitedRow(classId, student);
    if (!invitedRow) {
      return false;
    }

    const classEntity = await this.classRepo.findOne({ where: { id: classId } });
    const pendingMembership = await this.classStudentRepo.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
        status: ClassStudentStatusEnum.PENDING,
      },
    });

    if (pendingMembership) {
      await this.classStudentRepo.remove(pendingMembership);
    }

    invitedRow.student_id = studentId;
    invitedRow.status = ClassStudentStatusEnum.JOINED;
    invitedRow.joined_at = new Date();
    invitedRow.invitation_token = null;
    invitedRow.invited_email = null;
    invitedRow.invited_phone = null;
    invitedRow.approved_at = new Date();
    invitedRow.approved_by = classEntity?.teacher_id ?? null;
    await this.classStudentRepo.save(invitedRow);

    if (classEntity?.organization_id) {
      await this.organizationsService.upsertStudentMember(classEntity.organization_id, studentId);
    }

    return true;
  }

  private async findMatchingInvitedRow(
    classId: string,
    student: Pick<UserEntity, 'phone' | 'email'>,
  ): Promise<ClassStudentEntity | null> {
    const invitedRows = await this.classStudentRepo.find({
      where: { class_id: classId, status: ClassStudentStatusEnum.INVITED },
    });

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

    const classStudent = await this.findMatchingInvitedRow(classId, {
      phone: phone || student.phone,
      email: email ?? student.email ?? undefined,
    });

    if (!classStudent) {
      return;
    }

    if (classStudent.status !== ClassStudentStatusEnum.INVITED) {
      return;
    }

    const cls = await this.classRepo.findOne({ where: { id: classId } });

    classStudent.student_id = studentId;
    classStudent.status = ClassStudentStatusEnum.JOINED;
    classStudent.joined_at = new Date();
    classStudent.invitation_token = null;
    classStudent.invited_email = null;
    classStudent.invited_phone = null;
    classStudent.approved_at = new Date();
    classStudent.approved_by = cls?.teacher_id ?? null;

    await this.classStudentRepo.save(classStudent);

    if (cls?.organization_id) {
      await this.organizationsService.upsertStudentMember(cls.organization_id, studentId);
    }
  }

  /**
   * Remove students from a class
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

    await this.classStudentRepo
      .createQueryBuilder()
      .delete()
      .from(ClassStudentEntity)
      .where('class_id = :classId', { classId })
      .andWhere('(id IN (:...ids) OR student_id IN (:...ids))', { ids: studentIds })
      .execute();

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
    const qb = this.classStudentRepo
      .createQueryBuilder('cs')
      .innerJoinAndSelect('cs.class', 'class')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .leftJoinAndSelect('class.organization', 'organization')
      .where('cs.student_id = :studentId', { studentId })
      .andWhere('cs.status = :status', { status: ClassStudentStatusEnum.JOINED })
      .orderBy('cs.joined_at', 'DESC');

    this.applyStudentWorkspaceScopeToClassQuery(qb, jwtPayload);

    if (filters?.organization_id) {
      qb.andWhere('class.organization_id = :organizationId', {
        organizationId: filters.organization_id,
      });
    } else if (filters?.teacher_id) {
      qb.andWhere('class.organization_id IS NULL').andWhere('class.teacher_id = :teacherId', {
        teacherId: filters.teacher_id,
      });
    }

    const memberships = await qb.getMany();

    const classEntities = memberships.map((m) => m.class).filter(Boolean) as ClassEntity[];
    await this.attachConductedExamStatistics(classEntities);

    const statsByClassId = new Map(
      classEntities.map((c) => [
        c.id,
        { total_test_taken: c.total_test_taken ?? 0, last_test_taken_date: c.last_test_taken_date ?? null },
      ]),
    );

    return memberships
      .filter((m) => m.class)
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
    const membership = await this.classStudentRepo.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
        status: ClassStudentStatusEnum.JOINED,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not enrolled in this class');
    }

    const classEntity = await this.classRepo.findOne({
      where: { id: classId },
      relations: ['teacher', 'classStudents', 'classStudents.student'],
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    this.assertStudentWorkspaceAllowsClass(classEntity, jwtPayload);
    await this.hydrateClassStudents(classEntity);

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
    qb: any,
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (jwtPayload?.session_mode === 'organization' && jwtPayload.organization_id) {
      qb.andWhere('class.organization_id = :scopedOrganizationId', {
        scopedOrganizationId: jwtPayload.organization_id,
      });
      return;
    }

    if (jwtPayload?.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      qb.andWhere('class.organization_id IS NULL').andWhere('class.teacher_id = :scopedTeacherId', {
        scopedTeacherId: jwtPayload.teacher_id,
      });
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
      if (classEntity.organization_id || classEntity.teacher_id !== jwtPayload.teacher_id) {
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
  ): Promise<ClassStudentEntity[]> {
    await this.findOne(classId, jwtPayload, orgContext);
    
    return await this.classStudentRepo.find({
      where: { class_id: classId },
      relations: ['student'],
      order: { created_at: 'DESC' },
    }).then(async (rows) => {
      const wrapper = { classStudents: rows } as ClassEntity;
      await this.hydrateClassStudents(wrapper);
      return wrapper.classStudents;
    });
  }

  /**
   * Assign a teacher to a class (optionally for a subject). Org context required for org classes.
   */
  async assignClassTeacher(
    classId: string,
    teacherId: string,
    subjectId: string | null | undefined,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassTeacherEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);

    if (classEntity.organization_id) {
      if (!orgContext?.organizationId) {
        throw new BadRequestException('X-Organization-Id is required for organization classes');
      }
      await this.organizationAccessService.requireAcademicManager(
        classEntity.organization_id,
        jwtPayload.id,
      );
      const isMember = await this.organizationAccessService.isMember(
        classEntity.organization_id,
        teacherId,
      );
      if (!isMember) {
        throw new BadRequestException('Teacher must be a member of the organization');
      }
    } else if (classEntity.teacher_id !== jwtPayload.id) {
      throw new ForbiddenException('Only the class owner can assign teachers');
    }

    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    if (subjectId) {
      const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
      if (!subject) {
        throw new NotFoundException('Subject not found');
      }
    }

    const existing = await this.classTeacherRepo.findOne({
      where: subjectId
        ? { class_id: classId, teacher_id: teacherId, subject_id: subjectId }
        : { class_id: classId, teacher_id: teacherId, subject_id: IsNull() },
    });
    if (existing) {
      throw new BadRequestException('Teacher is already assigned to this class for this subject');
    }

    const row = this.classTeacherRepo.create({
      class_id: classId,
      teacher_id: teacherId,
      subject_id: subjectId ?? null,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });
    return this.classTeacherRepo.save(row);
  }

  async removeClassTeacher(
    classId: string,
    classTeacherId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);

    if (classEntity.organization_id) {
      await this.organizationAccessService.requireAcademicManager(
        classEntity.organization_id,
        jwtPayload.id,
      );
    } else if (classEntity.teacher_id !== jwtPayload.id) {
      throw new ForbiddenException('Only the class owner can remove teachers');
    }

    const row = await this.classTeacherRepo.findOne({
      where: { id: classTeacherId, class_id: classId },
    });
    if (!row) {
      throw new NotFoundException('Class teacher assignment not found');
    }

    await this.classTeacherRepo.remove(row);
  }

  async listClassTeachers(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassTeacherEntity[]> {
    await this.findOne(classId, jwtPayload, orgContext);
    return this.classTeacherRepo.find({
      where: { class_id: classId },
      relations: ['teacher', 'subject'],
      order: { created_at: 'ASC' },
    });
  }

  async listClassSubjects(
    classId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ) {
    await this.findOne(classId, jwtPayload, orgContext);
    return this.classSubjectRepo.find({
      where: { class_id: classId },
      relations: ['subject', 'teachers', 'teachers.teacher'],
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
    const rows = await this.classSubjectRepo.find({
      where: { class_id: classId },
      relations: ['subject', 'teachers'],
      order: { created_at: 'ASC' },
    });

    return rows
      .filter((row) => row.teachers?.some((assignment) => assignment.teacher_id === teacherId))
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
    const assignment = await this.classSubjectTeacherRepo.findOne({
      where: { class_subject_id: classSubject.id, teacher_id: teacherId },
    });
    if (!assignment) {
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
        where: { name, organization_id: IsNull() },
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
    if (classEntity.organization_id) {
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

    if (classEntity.organization_id) {
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

    if (!resolvedId && classEntity.organization_id) {
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
        where: { name, organization_id: IsNull() },
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

  async assignClassSubjectTeacher(
    classId: string,
    classSubjectId: string,
    teacherId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
    mirrorClassTeacher = true,
  ): Promise<ClassSubjectTeacherEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    await this.assertCanManageClassSubjects(classEntity, jwtPayload.id);

    const classSubject = await this.classSubjectRepo.findOne({
      where: { id: classSubjectId, class_id: classId },
    });
    if (!classSubject) {
      throw new NotFoundException('Class subject not found');
    }

    if (classEntity.organization_id) {
      const membership = await this.organizationAccessService.getMembership(
        classEntity.organization_id,
        teacherId,
      );
      if (!membership) {
        throw new BadRequestException('Teacher must be a member of the organization');
      }
      if (!this.organizationAccessService.isAssignableTeachingRole(membership.role)) {
        throw new BadRequestException(
          'Only organization owners, admins, and teachers can be assigned to a class subject',
        );
      }
    }

    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const existing = await this.classSubjectTeacherRepo.findOne({
      where: { class_subject_id: classSubjectId, teacher_id: teacherId },
    });
    if (existing) {
      throw new BadRequestException('Teacher is already assigned to this class subject');
    }

    const row = this.classSubjectTeacherRepo.create({
      class_subject_id: classSubjectId,
      teacher_id: teacherId,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });
    const saved = await this.classSubjectTeacherRepo.save(row);

    if (mirrorClassTeacher && !classEntity.organization_id) {
      const legacy = await this.classTeacherRepo.findOne({
        where: {
          class_id: classId,
          teacher_id: teacherId,
          subject_id: classSubject.subject_id,
        },
      });
      if (!legacy) {
        await this.classTeacherRepo.save(
          this.classTeacherRepo.create({
            class_id: classId,
            teacher_id: teacherId,
            subject_id: classSubject.subject_id,
            created_by: jwtPayload.id,
            created_user_name: jwtPayload.full_name,
            created_at: new Date(),
          }),
        );
      }
    }

    return this.classSubjectTeacherRepo.findOne({
      where: { id: saved.id },
      relations: ['teacher', 'classSubject', 'classSubject.subject'],
    }) as Promise<ClassSubjectTeacherEntity>;
  }

  async removeClassSubjectTeacher(
    classId: string,
    classSubjectId: string,
    assignmentId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    await this.assertCanManageClassSubjects(classEntity, jwtPayload.id);

    const row = await this.classSubjectTeacherRepo.findOne({
      where: { id: assignmentId, class_subject_id: classSubjectId },
      relations: ['classSubject'],
    });
    if (!row || row.classSubject?.class_id !== classId) {
      throw new NotFoundException('Class subject teacher assignment not found');
    }
    const subjectId = row.classSubject.subject_id;
    const removedTeacherId = row.teacher_id;
    await this.classSubjectTeacherRepo.remove(row);

    if (classEntity.organization_id) {
      await this.removeLegacyOrgClassTeacherMirror(classId, removedTeacherId, subjectId);
    }
  }

  async updateClassSubjectTeacher(
    classId: string,
    classSubjectId: string,
    assignmentId: string,
    teacherId: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<ClassSubjectTeacherEntity> {
    const classEntity = await this.findOne(classId, jwtPayload, orgContext);
    await this.assertCanManageClassSubjects(classEntity, jwtPayload.id);

    return this.classSubjectTeacherRepo.manager.transaction(async (manager) => {
      const cstRepo = manager.getRepository(ClassSubjectTeacherEntity);
      const classTeacherRepo = manager.getRepository(ClassTeacherEntity);

      const assignment = await cstRepo.findOne({
        where: { id: assignmentId, class_subject_id: classSubjectId },
        relations: ['classSubject'],
      });
      if (!assignment || assignment.classSubject?.class_id !== classId) {
        throw new NotFoundException('Class subject teacher assignment not found');
      }

      if (assignment.teacher_id === teacherId) {
        return cstRepo.findOne({
          where: { id: assignment.id },
          relations: ['teacher', 'classSubject', 'classSubject.subject'],
        }) as Promise<ClassSubjectTeacherEntity>;
      }

      if (classEntity.organization_id) {
        const membership = await this.organizationAccessService.getMembership(
          classEntity.organization_id,
          teacherId,
        );
        if (!membership) {
          throw new BadRequestException('Teacher must be a member of the organization');
        }
        if (!this.organizationAccessService.isAssignableTeachingRole(membership.role)) {
          throw new BadRequestException(
            'Only organization owners, admins, and teachers can be assigned to a class subject',
          );
        }
      }

      const teacher = await manager.getRepository(UserEntity).findOne({ where: { id: teacherId } });
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      const duplicate = await cstRepo.findOne({
        where: { class_subject_id: classSubjectId, teacher_id: teacherId },
      });
      if (duplicate) {
        throw new BadRequestException('Teacher is already assigned to this class subject');
      }

      const previousTeacherId = assignment.teacher_id;
      const subjectId = assignment.classSubject.subject_id;
      assignment.teacher_id = teacherId;
      assignment.updated_by = jwtPayload.id;
      assignment.updated_user_name = jwtPayload.full_name;
      assignment.updated_at = new Date();
      await cstRepo.save(assignment);

      if (classEntity.organization_id) {
        const leftover = await classTeacherRepo.findOne({
          where: {
            class_id: classId,
            teacher_id: previousTeacherId,
            subject_id: subjectId,
          },
        });
        if (leftover) {
          await classTeacherRepo.remove(leftover);
        }
      }

      return cstRepo.findOne({
        where: { id: assignment.id },
        relations: ['teacher', 'classSubject', 'classSubject.subject'],
      }) as Promise<ClassSubjectTeacherEntity>;
    });
  }

  private async removeLegacyOrgClassTeacherMirror(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<void> {
    const leftover = await this.classTeacherRepo.findOne({
      where: { class_id: classId, teacher_id: teacherId, subject_id: subjectId },
    });
    if (leftover) {
      await this.classTeacherRepo.remove(leftover);
    }
  }
}
