import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectTeacherEntity } from 'src/classes/entities/class-subject-teacher.entity';
import { ClassKindEnum } from 'src/classes/enums/class-kind.enum';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationStatusEnum } from './enums/organization-status.enum';
import { OrgContext } from './interfaces/org-context.interface';

@Injectable()
export class OrganizationAccessService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectTeacherEntity)
    private readonly classSubjectTeacherRepo: Repository<ClassSubjectTeacherEntity>,
  ) {}

  static readonly ASSIGNABLE_TEACHING_ROLES: OrganizationMemberRoleEnum[] = [
    OrganizationMemberRoleEnum.OWNER,
    OrganizationMemberRoleEnum.ADMIN,
    OrganizationMemberRoleEnum.TEACHER,
  ];

  isAssignableTeachingRole(role?: OrganizationMemberRoleEnum | null): boolean {
    return Boolean(role && OrganizationAccessService.ASSIGNABLE_TEACHING_ROLES.includes(role));
  }

  async isAssignedToOrganizationClass(userId: string, classId: string): Promise<boolean> {
    const assignment = await this.classSubjectTeacherRepo
      .createQueryBuilder('cst')
      .innerJoin('cst.classSubject', 'classSubject')
      .where('cst.teacher_id = :userId', { userId })
      .andWhere('classSubject.class_id = :classId', { classId })
      .getOne();
    return Boolean(assignment);
  }

  /** Active membership only — soft-removed members have no access. */
  async canAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return Boolean(membership);
  }

  async canManageOrganization(userId: string, organizationId: string): Promise<boolean> {
    return this.isOwnerOrAdmin(organizationId, userId);
  }

  /** OWNER / ADMIN only — teachers and assistants directories. */
  async canManageTeachers(userId: string, organizationId: string): Promise<boolean> {
    return this.isOwnerOrAdmin(organizationId, userId);
  }

  async canManageStaff(userId: string, organizationId: string): Promise<boolean> {
    return this.isOwnerOrAdmin(organizationId, userId);
  }

  /** OWNER / ADMIN only — organization-wide student directory. */
  async canManageStudents(userId: string, organizationId: string): Promise<boolean> {
    return this.isOwnerOrAdmin(organizationId, userId);
  }

  async canManageClasses(userId: string, organizationId: string): Promise<boolean> {
    return this.canManageAcademicStructure(organizationId, userId);
  }

  /**
   * Org teachers (and OWNER/ADMIN who are assigned) may create exams only for
   * classes where they have a class_subject_teachers assignment.
   * Academic managers are not auto-creators. Assistants and students cannot create.
   */
  async canCreateExam(
    userId: string,
    organizationId: string,
    classId: string,
  ): Promise<boolean> {
    try {
      await this.assertApproved(organizationId);
    } catch {
      return false;
    }

    const membership = await this.getMembership(organizationId, userId);
    if (!membership || !this.isAssignableTeachingRole(membership.role)) {
      return false;
    }

    const classEntity = await this.classRepo.findOne({ where: { id: classId } });
    if (!classEntity || classEntity.organization_id !== organizationId) {
      return false;
    }

    return this.isAssignedToOrganizationClass(userId, classId);
  }

  async getOrganizationOrThrow(organizationId: string): Promise<OrganizationEntity> {
    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async assertApproved(organizationId: string): Promise<OrganizationEntity> {
    const organization = await this.getOrganizationOrThrow(organizationId);
    if (organization.status !== OrganizationStatusEnum.APPROVED) {
      throw new ForbiddenException(
        'Organization workspace is not available until the organization is approved',
      );
    }
    return organization;
  }

  async getMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity | null> {
    return this.memberRepo.findOne({
      where: {
        organization_id: organizationId,
        user_id: userId,
        is_active: ActiveStatusEnum.ACTIVE,
      },
    });
  }

  async getMembershipIncludingInactive(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity | null> {
    return this.memberRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return Boolean(membership);
  }

  async isOwnerOrAdmin(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return (
      membership?.role === OrganizationMemberRoleEnum.OWNER ||
      membership?.role === OrganizationMemberRoleEnum.ADMIN
    );
  }

  async isAssistant(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return membership?.role === OrganizationMemberRoleEnum.ASSISTANT;
  }

  /** OWNER / ADMIN / ASSISTANT — academic structure (classes, subjects, assignments). */
  async canManageAcademicStructure(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return (
      membership?.role === OrganizationMemberRoleEnum.OWNER ||
      membership?.role === OrganizationMemberRoleEnum.ADMIN ||
      membership?.role === OrganizationMemberRoleEnum.ASSISTANT
    );
  }

  async requireAcademicManager(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    await this.assertApproved(organizationId);
    const membership = await this.requireMember(organizationId, userId);
    if (
      membership.role !== OrganizationMemberRoleEnum.OWNER &&
      membership.role !== OrganizationMemberRoleEnum.ADMIN &&
      membership.role !== OrganizationMemberRoleEnum.ASSISTANT
    ) {
      throw new ForbiddenException(
        'Only organization owners, admins, and assistants can manage academic structure',
      );
    }
    return membership;
  }

  async isOrgTeacher(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return membership?.role === OrganizationMemberRoleEnum.TEACHER;
  }

  async isOrgStudent(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(organizationId, userId);
    return membership?.role === OrganizationMemberRoleEnum.STUDENT;
  }

  async requireMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    const membership = await this.getMembership(organizationId, userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return membership;
  }

  async requireApprovedMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    await this.assertApproved(organizationId);
    return this.requireMember(organizationId, userId);
  }

  async requireOwnerOrAdmin(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    const membership = await this.requireMember(organizationId, userId);
    if (
      membership.role !== OrganizationMemberRoleEnum.OWNER &&
      membership.role !== OrganizationMemberRoleEnum.ADMIN
    ) {
      throw new ForbiddenException('Only organization owners and admins can perform this action');
    }
    return membership;
  }

  async requireApprovedOwnerOrAdmin(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    await this.assertApproved(organizationId);
    return this.requireOwnerOrAdmin(organizationId, userId);
  }

  async requireStaffManager(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    return this.requireApprovedOwnerOrAdmin(organizationId, userId);
  }

  async requireStudentDirectoryManager(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity> {
    return this.requireApprovedOwnerOrAdmin(organizationId, userId);
  }

  async requireManageMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationMemberRoleEnum,
  ): Promise<OrganizationMemberEntity> {
    if (
      role === OrganizationMemberRoleEnum.TEACHER ||
      role === OrganizationMemberRoleEnum.ASSISTANT ||
      role === OrganizationMemberRoleEnum.ADMIN
    ) {
      return this.requireStaffManager(organizationId, userId);
    }
    if (role === OrganizationMemberRoleEnum.STUDENT) {
      return this.requireStudentDirectoryManager(organizationId, userId);
    }
    throw new ForbiddenException('This membership role cannot be managed this way');
  }

  /**
   * Class management: creator, assigned class teacher, or org academic managers
   * (OWNER/ADMIN/ASSISTANT) for organization classes.
   * Personal classes of another teacher are not fully managed by assistants.
   */
  async canManageClass(
    classEntity: Pick<ClassEntity, 'id' | 'teacher_id' | 'organization_id' | 'class_kind'>,
    userId: string,
    orgContext?: OrgContext | null,
  ): Promise<boolean> {
    if (!classEntity.organization_id) {
      return classEntity.teacher_id === userId;
    }

    if (orgContext?.organizationId && orgContext.organizationId !== classEntity.organization_id) {
      return false;
    }

    try {
      await this.assertApproved(classEntity.organization_id);
    } catch {
      return false;
    }

    if (await this.isAssignedToOrganizationClass(userId, classEntity.id)) {
      return true;
    }

    // Personal class inside an org: OWNER/ADMIN may monitor; ASSISTANT cannot take over.
    if (classEntity.class_kind === ClassKindEnum.PERSONAL) {
      return this.isOwnerOrAdmin(classEntity.organization_id, userId);
    }

    return this.canManageAcademicStructure(classEntity.organization_id, userId);
  }

  async assertCanManageClass(
    classEntity: Pick<ClassEntity, 'id' | 'teacher_id' | 'organization_id' | 'class_kind'>,
    userId: string,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const allowed = await this.canManageClass(classEntity, userId, orgContext);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to manage this class');
    }
  }

  /**
   * OWNER/ADMIN may monitor any org exam. Teachers may monitor their own.
   */
  async canMonitorExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
    orgContext?: OrgContext | null,
  ): Promise<boolean> {
    if (!exam.organization_id) {
      return exam.created_by === userId;
    }

    if (orgContext?.organizationId && orgContext.organizationId !== exam.organization_id) {
      return false;
    }

    try {
      await this.assertApproved(exam.organization_id);
    } catch {
      return false;
    }

    if (exam.created_by === userId) {
      return true;
    }

    return this.isOwnerOrAdmin(exam.organization_id, userId);
  }

  async assertCanMonitorExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
    orgContext?: OrgContext | null,
  ): Promise<void> {
    const allowed = await this.canMonitorExam(exam, userId, orgContext);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to view this exam');
    }
  }

  /** Only the exam creator can edit. */
  async canEditExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
  ): Promise<boolean> {
    if (exam.organization_id) {
      try {
        await this.assertApproved(exam.organization_id);
      } catch {
        return false;
      }
    }
    return exam.created_by === userId;
  }

  async assertCanEditExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
  ): Promise<void> {
    const allowed = await this.canEditExam(exam, userId);
    if (!allowed) {
      throw new ForbiddenException('Only the exam creator can edit this exam');
    }
  }

  /** Only the exam creator can grade. */
  async canGradeExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
  ): Promise<boolean> {
    return this.canEditExam(exam, userId);
  }

  async assertCanGradeExam(
    exam: Pick<ExamEntity, 'created_by' | 'organization_id'>,
    userId: string,
  ): Promise<void> {
    const allowed = await this.canGradeExam(exam, userId);
    if (!allowed) {
      throw new ForbiddenException('Only the exam creator can grade this exam');
    }
  }

  assertOrgContextMatches(
    organizationId: string | null | undefined,
    orgContext?: OrgContext | null,
  ): void {
    if (!orgContext?.organizationId) {
      if (organizationId) {
        throw new BadRequestException(
          'This resource belongs to an organization. Provide X-Organization-Id.',
        );
      }
      return;
    }

    if (!organizationId || organizationId !== orgContext.organizationId) {
      throw new ForbiddenException('Organization context does not match this resource');
    }
  }
}
