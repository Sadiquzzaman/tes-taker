import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { ClassStudentEntity, ClassStudentStatusEnum } from 'src/classes/entities/class-student.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationStatusEnum } from './enums/organization-status.enum';
import { SelectableContextTypeEnum } from './dto/select-context.dto';
import { UserContextItem } from './interfaces/user-context.interface';

@Injectable()
export class UserContextService {
  constructor(
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,
    private readonly userService: UserService,
  ) {}

  private roleLabelForOrgMember(role: OrganizationMemberRoleEnum): string {
    switch (role) {
      case OrganizationMemberRoleEnum.OWNER:
        return 'Owner / Teacher';
      case OrganizationMemberRoleEnum.ADMIN:
        return 'Admin';
      case OrganizationMemberRoleEnum.ASSISTANT:
        return 'Assistant';
      case OrganizationMemberRoleEnum.TEACHER:
        return 'Teacher';
      case OrganizationMemberRoleEnum.STUDENT:
        return 'Student';
      default:
        return role;
    }
  }

  async listContexts(userId: string): Promise<UserContextItem[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const contexts: UserContextItem[] = [];

    if (user.personal_teacher_enabled) {
      contexts.push({
        type: 'personal_teacher',
        key: 'personal_teacher',
        label: 'My Teaching',
        role_label: 'Teacher',
        member_role: 'TEACHER',
        actionable: true,
      });
    }

    const memberships = await this.memberRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
      order: { created_at: 'ASC' },
    });

    for (const membership of memberships) {
      if (!membership.organization || membership.is_active === ActiveStatusEnum.INACTIVE) {
        continue;
      }

      const org = membership.organization;
      if (
        org.status === OrganizationStatusEnum.REJECTED ||
        org.status === OrganizationStatusEnum.INACTIVE
      ) {
        continue;
      }

      const approved = org.status === OrganizationStatusEnum.APPROVED;
      const actionable = approved || org.status === OrganizationStatusEnum.PENDING;

      contexts.push({
        type: 'organization',
        key: `org:${org.id}`,
        label: org.name,
        role_label: this.roleLabelForOrgMember(membership.role),
        organization_id: org.id,
        organization_public_id: org.public_id ?? (org.organization_number ? String(org.organization_number) : null),
        organization_number: org.organization_number
          ? Number(org.organization_number)
          : null,
        member_role: membership.role,
        organization_status: org.status,
        actionable,
      });
    }

    // Personal (non-org) teacher classes the user is enrolled in as a student.
    const personalEnrollments = await this.classStudentRepo
      .createQueryBuilder('cs')
      .innerJoinAndSelect('cs.class', 'class')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .where('cs.student_id = :userId', { userId })
      .andWhere('cs.status = :status', { status: ClassStudentStatusEnum.JOINED })
      .andWhere('class.organization_id IS NULL')
      .getMany();

    const teacherMap = new Map<string, { id: string; name: string }>();
    for (const enrollment of personalEnrollments) {
      const teacherId = enrollment.class?.teacher_id;
      if (!teacherId || teacherId === userId) {
        continue;
      }
      if (teacherMap.has(teacherId)) {
        continue;
      }
      const teacherName =
        enrollment.class.teacher?.full_name?.trim() ||
        enrollment.class.created_user_name?.trim() ||
        'Teacher';
      teacherMap.set(teacherId, { id: teacherId, name: teacherName });
    }

    for (const teacher of teacherMap.values()) {
      contexts.push({
        type: 'individual_teacher',
        key: `teacher:${teacher.id}`,
        label: `${teacher.name}'s Classes`,
        role_label: 'Student',
        teacher_id: teacher.id,
        member_role: 'STUDENT',
        actionable: true,
      });
    }

    return contexts;
  }

  /**
   * Issue a JWT locked to the chosen context after verifying membership.
   */
  async selectContext(
    userId: string,
    type: SelectableContextTypeEnum,
    organizationId?: string,
    teacherId?: string,
  ): Promise<UserReponseDto & { contexts: UserContextItem[] }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const contexts = await this.listContexts(userId);

    if (type === SelectableContextTypeEnum.PERSONAL_TEACHER) {
      if (!user.personal_teacher_enabled) {
        throw new ForbiddenException('Personal teaching context is not enabled for this account');
      }
      const token = await this.userService.generateTokenForUser(user, null, {
        context_type: 'personal_teacher',
      });
      return { ...token, contexts };
    }

    if (type === SelectableContextTypeEnum.INDIVIDUAL_TEACHER) {
      if (!teacherId) {
        throw new BadRequestException('teacher_id is required for individual teacher context');
      }
      const match = contexts.find(
        (c) => c.type === 'individual_teacher' && c.teacher_id === teacherId,
      );
      if (!match) {
        throw new ForbiddenException('You are not enrolled in this teacher\'s classes');
      }
      const token = await this.userService.generateTokenForUser(user, null, {
        context_type: 'individual_teacher',
        teacher_id: teacherId,
      });
      return { ...token, contexts };
    }

    if (type === SelectableContextTypeEnum.ORGANIZATION) {
      if (!organizationId) {
        throw new BadRequestException('organization_id is required for organization context');
      }

      const match = contexts.find(
        (c) => c.type === 'organization' && c.organization_id === organizationId,
      );
      if (!match) {
        throw new ForbiddenException('You are not a member of this organization');
      }

      if (
        match.organization_status === OrganizationStatusEnum.REJECTED ||
        match.organization_status === OrganizationStatusEnum.INACTIVE
      ) {
        throw new ForbiddenException('This organization is not available');
      }

      const membership = await this.memberRepo.findOne({
        where: { organization_id: organizationId, user_id: userId },
        relations: ['organization'],
      });
      if (!membership?.organization) {
        throw new ForbiddenException('You are not a member of this organization');
      }

      const org = membership.organization;
      const token = await this.userService.generateTokenForUser(
        user,
        {
          organization_id: org.id,
          organization_number: Number(org.organization_number ?? 0),
          member_role: membership.role,
          organization_name: org.name,
          organization_status: org.status,
        },
        {
          context_type: 'organization',
        },
      );
      return { ...token, contexts };
    }

    throw new BadRequestException('Invalid context type');
  }
}
