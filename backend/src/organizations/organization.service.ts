import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RedisService } from 'src/config/redis.service';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { EmailService } from 'src/email/email.service';
import { normalizeEmail, normalizePhone } from 'src/common/utils/contact.util';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationTeacherSubjectEntity } from './entities/organization-teacher-subject.entity';
import { OrganizationInvitationEntity } from './entities/organization-invitation.entity';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationStatusEnum } from './enums/organization-status.enum';
import { OrganizationInvitationStatusEnum } from './enums/organization-invitation-status.enum';
import { PublicIdService } from 'src/common/services/public-id.service';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { ImportOrganizationMembersDto } from './dto/import-organization-members.dto';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { OrganizationAccessService } from './organization-access.service';

const ORG_REG_REDIS_PREFIX = 'org_reg:';
const ORG_REG_TTL_SECONDS = 60 * 60; // 1 hour
const ORG_INVITE_TTL_DAYS = 7;

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(OrganizationTeacherSubjectEntity)
    private readonly teacherSubjectRepo: Repository<OrganizationTeacherSubjectEntity>,
    @InjectRepository(OrganizationInvitationEntity)
    private readonly invitationRepo: Repository<OrganizationInvitationEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectRepo: Repository<SubjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly accessService: OrganizationAccessService,
    private readonly dataSource: DataSource,
    private readonly publicIdService: PublicIdService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  orgRegRedisKey(phone: string): string {
    return `${ORG_REG_REDIS_PREFIX}${phone}`;
  }

  async storePendingOrgName(phone: string, organizationName: string): Promise<void> {
    await this.redisService.set(
      this.orgRegRedisKey(phone),
      organizationName.trim(),
      ORG_REG_TTL_SECONDS,
    );
  }

  async peekPendingOrgName(phone: string): Promise<string | null> {
    return this.redisService.get(this.orgRegRedisKey(phone));
  }

  async consumePendingOrgName(phone: string): Promise<string | null> {
    const key = this.orgRegRedisKey(phone);
    const name = await this.redisService.get(key);
    if (name) {
      await this.redisService.del(key);
    }
    return name;
  }

  async clearPendingOrgName(phone: string): Promise<void> {
    await this.redisService.del(this.orgRegRedisKey(phone));
  }

  /**
   * Called from AuthService after OTP verify when Redis has a pending org name.
   * Creates Organization PENDING + OWNER membership in one transaction.
   */
  async createPendingFromRegistration(params: {
    organizationName: string;
    ownerUserId: string;
    ownerFullName?: string | null;
  }): Promise<OrganizationEntity> {
    // Outside the org transaction: avoids mixing connections and keeps
    // personal_teacher_enabled = false for org-only owners.
    await this.userService.ensureTeacherCapability(params.ownerUserId, { enablePersonal: false });

    // One sequential public org ID (100001+), also used as organization_number.
    const organizationNumber = await this.publicIdService.nextOrganizationPublicId();

    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(OrganizationEntity);
      const memberRepo = manager.getRepository(OrganizationMemberEntity);

      const organization = orgRepo.create({
        name: params.organizationName.trim(),
        public_id: organizationNumber,
        organization_number: organizationNumber,
        status: OrganizationStatusEnum.PENDING,
        created_by: params.ownerUserId,
        created_user_name: params.ownerFullName ?? undefined,
        created_at: new Date(),
      });
      const savedOrg = await orgRepo.save(organization);

      const membership = memberRepo.create({
        organization_id: savedOrg.id,
        user_id: params.ownerUserId,
        role: OrganizationMemberRoleEnum.OWNER,
        created_by: params.ownerUserId,
        created_user_name: params.ownerFullName ?? undefined,
        created_at: new Date(),
      });
      await memberRepo.save(membership);

      return savedOrg;
    });
  }

  async findByOrganizationNumber(organizationNumber: number | string): Promise<OrganizationEntity | null> {
    return this.organizationRepo.findOne({
      where: { organization_number: String(organizationNumber) },
    });
  }

  /**
   * Organization convenience login: allow PENDING so owners can see review state.
   * REJECTED / INACTIVE are blocked. Functional org APIs still require APPROVED.
   */
  async findMembershipForLogin(
    organizationNumber: number | string,
    userId: string,
  ): Promise<{
    organization: OrganizationEntity;
    membership: OrganizationMemberEntity;
  }> {
    const organization = await this.findByOrganizationNumber(organizationNumber);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (
      organization.status === OrganizationStatusEnum.REJECTED ||
      organization.status === OrganizationStatusEnum.INACTIVE
    ) {
      throw new ForbiddenException('This organization is not available');
    }

    const membership = await this.memberRepo.findOne({
      where: { organization_id: organization.id, user_id: userId },
    });
    if (!membership || membership.is_active === ActiveStatusEnum.INACTIVE) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return { organization, membership };
  }

  async findMembershipByOrgId(
    organizationId: string,
    userId: string,
  ): Promise<{
    organization: OrganizationEntity;
    membership: OrganizationMemberEntity;
  }> {
    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (
      organization.status === OrganizationStatusEnum.REJECTED ||
      organization.status === OrganizationStatusEnum.INACTIVE
    ) {
      throw new ForbiddenException('This organization is not available');
    }

    const membership = await this.memberRepo.findOne({
      where: { organization_id: organization.id, user_id: userId },
    });
    if (!membership || membership.is_active === ActiveStatusEnum.INACTIVE) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return { organization, membership };
  }

  /** @deprecated Prefer findMembershipForLogin — kept for any remaining callers */
  async findApprovedMembershipForLogin(
    organizationNumber: number | string,
    userId: string,
  ) {
    const result = await this.findMembershipForLogin(organizationNumber, userId);
    if (result.organization.status !== OrganizationStatusEnum.APPROVED) {
      throw new ForbiddenException(
        'Organization workspace is not available until the organization is approved',
      );
    }
    return result;
  }

  async findApprovedMembershipByOrgId(organizationId: string, userId: string) {
    const result = await this.findMembershipByOrgId(organizationId, userId);
    if (result.organization.status !== OrganizationStatusEnum.APPROVED) {
      throw new ForbiddenException(
        'Organization workspace is not available until the organization is approved',
      );
    }
    return result;
  }

  async listMine(userId: string) {
    const memberships = await this.memberRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
      order: { created_at: 'DESC' },
    });

    return memberships
      .filter((m) => m.organization)
      .map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        public_id: m.organization.public_id,
        organization_number: Number(m.organization.organization_number),
        status: m.organization.status,
        rejected_reason: m.organization.rejected_reason,
        reviewed_at: m.organization.reviewed_at,
        role: m.role,
        member_role: m.role,
        created_at: m.organization.created_at,
      }));
  }

  async findOneForMember(organizationId: string, userId: string) {
    const membership = await this.memberRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
      relations: ['organization'],
    });

    if (!membership?.organization) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    const org = membership.organization;
    const [members_count, teachers_count, students_count, classes_count, exams_count] =
      await Promise.all([
        this.memberRepo.count({ where: { organization_id: organizationId } }),
        this.memberRepo.count({
          where: [
            { organization_id: organizationId, role: OrganizationMemberRoleEnum.TEACHER },
            { organization_id: organizationId, role: OrganizationMemberRoleEnum.ADMIN },
            { organization_id: organizationId, role: OrganizationMemberRoleEnum.OWNER },
          ],
        }),
        this.memberRepo.count({
          where: { organization_id: organizationId, role: OrganizationMemberRoleEnum.STUDENT },
        }),
        this.classRepo.count({ where: { organization_id: organizationId } }),
        this.examRepo.count({ where: { organization_id: organizationId } }),
      ]);

    return {
      id: org.id,
      name: org.name,
      public_id: org.public_id,
      organization_number: Number(org.organization_number),
      status: org.status,
      rejected_reason: org.rejected_reason,
      reviewed_at: org.reviewed_at,
      role: membership.role,
      member_role: membership.role,
      created_at: org.created_at,
      members_count,
      teachers_count,
      students_count,
      classes_count,
      exams_count,
    };
  }

  /**
   * Monitoring list for OWNER/ADMIN (all org exams) or teachers (own exams).
   */
  async listMonitorExams(organizationId: string, userId: string) {
    const membership = await this.accessService.requireApprovedMember(organizationId, userId);
    const isOwnerOrAdmin =
      membership.role === OrganizationMemberRoleEnum.OWNER ||
      membership.role === OrganizationMemberRoleEnum.ADMIN;

    const exams = await this.examRepo.find({
      where: isOwnerOrAdmin
        ? { organization_id: organizationId }
        : { organization_id: organizationId, created_by: userId },
      relations: ['class'],
      order: { created_at: 'DESC' },
    });

    return exams.map((exam) => ({
      id: exam.id,
      title: exam.test_name ?? exam.subject ?? null,
      name: exam.test_name ?? exam.subject ?? null,
      status: exam.is_active,
      start_time: exam.exam_start_time,
      end_time: exam.exam_end_time,
      class_name: exam.class?.class_name ?? null,
      created_by: exam.created_by,
    }));
  }

  async listForAdmin(query: ListOrganizationsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const search = query.search?.trim();

    const qb = this.organizationRepo
      .createQueryBuilder('org')
      .orderBy('org.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('org.status = :status', { status: query.status });
    }

    if (search) {
      qb.andWhere(
        '(org.name ILIKE :term OR org.public_id ILIKE :term OR CAST(org.organization_number AS TEXT) ILIKE :term)',
        { term: `%${search}%` },
      );
    }

    const [organizations, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const orgIds = organizations.map((o) => o.id);
    const owners =
      orgIds.length === 0
        ? []
        : await this.memberRepo
            .createQueryBuilder('member')
            .leftJoinAndSelect('member.user', 'user')
            .where('member.organization_id IN (:...orgIds)', { orgIds })
            .andWhere('member.role = :role', { role: OrganizationMemberRoleEnum.OWNER })
            .getMany();

    const ownerByOrg = new Map(owners.map((o) => [o.organization_id, o]));

    return {
      organizations: organizations.map((org) => {
        const owner = ownerByOrg.get(org.id);
        return {
          id: org.id,
          name: org.name,
          public_id: org.public_id,
          organization_number: Number(org.organization_number),
          status: org.status,
          rejected_reason: org.rejected_reason,
          reviewed_by: org.reviewed_by,
          reviewed_at: org.reviewed_at,
          created_at: org.created_at,
          owner: owner
            ? {
                id: owner.user_id,
                full_name: owner.user?.full_name ?? null,
                email: owner.user?.email ?? null,
                phone: owner.user?.phone ?? null,
              }
            : null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async approve(adminId: string, organizationId: string) {
    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.status !== OrganizationStatusEnum.PENDING) {
      throw new BadRequestException('Only pending organizations can be approved');
    }

    organization.status = OrganizationStatusEnum.APPROVED;
    organization.rejected_reason = null;
    organization.reviewed_by = adminId;
    organization.reviewed_at = new Date();
    organization.updated_by = adminId;
    organization.updated_at = new Date();

    return this.organizationRepo.save(organization);
  }

  async reject(adminId: string, organizationId: string, reason?: string) {
    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.status !== OrganizationStatusEnum.PENDING) {
      throw new BadRequestException('Only pending organizations can be rejected');
    }

    organization.status = OrganizationStatusEnum.REJECTED;
    organization.rejected_reason = reason?.trim() || null;
    organization.reviewed_by = adminId;
    organization.reviewed_at = new Date();
    organization.updated_by = adminId;
    organization.updated_at = new Date();

    return this.organizationRepo.save(organization);
  }

  async listMembers(organizationId: string, actorUserId: string) {
    await this.accessService.requireApprovedOwnerOrAdmin(organizationId, actorUserId);

    const members = await this.memberRepo.find({
      where: {
        organization_id: organizationId,
        is_active: ActiveStatusEnum.ACTIVE,
      },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });

    return members.map((m) => this.toMemberView(m));
  }

  async listAssignableTeachers(organizationId: string, actorUserId: string) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const members = await this.memberRepo.find({
      where: {
        organization_id: organizationId,
        is_active: ActiveStatusEnum.ACTIVE,
        role: In([
          OrganizationMemberRoleEnum.OWNER,
          OrganizationMemberRoleEnum.ADMIN,
          OrganizationMemberRoleEnum.TEACHER,
        ]),
      },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });

    return members.map((m) => this.toMemberView(m));
  }

  async lookupMemberCandidate(
    organizationId: string,
    actorUserId: string,
    query: string,
  ) {
    await this.accessService.requireApprovedOwnerOrAdmin(organizationId, actorUserId);

    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException('Search value is required');
    }

    const user = await this.userService.findByContactOrPublicId(trimmed);
    if (!user) {
      return {
        found: false as const,
        query: trimmed,
        query_type: this.classifyContactQuery(trimmed),
        message: 'No existing user found. You can send an invitation.',
      };
    }

    const membership = await this.accessService.getMembershipIncludingInactive(
      organizationId,
      user.id,
    );

    return {
      found: true as const,
      query: trimmed,
      query_type: this.classifyContactQuery(trimmed),
      user: {
        id: user.id,
        full_name: user.full_name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        teacher_public_id: user.teacher_public_id ?? null,
        student_public_id: user.student_public_id ?? null,
        is_otp_verified: Boolean(user.is_otp_verified),
      },
      membership: membership
        ? {
            id: membership.id,
            role: membership.role,
            is_active: membership.is_active,
            removed_at: membership.removed_at,
          }
        : null,
    };
  }

  async addMember(
    organizationId: string,
    actorUserId: string,
    dto: AddOrganizationMemberDto,
  ) {
    const role = dto.role ?? OrganizationMemberRoleEnum.TEACHER;
    if (role === OrganizationMemberRoleEnum.OWNER) {
      throw new BadRequestException('Cannot assign OWNER role via invite');
    }
    await this.accessService.requireManageMemberRole(organizationId, actorUserId, role);

    const resolved = this.resolveMemberContact(dto);
    const user = await this.resolveUserFromContact(resolved);

    if (user) {
      if (!user.is_otp_verified) {
        throw new BadRequestException('User has not verified their account yet');
      }
      const member = await this.attachOrReactivateMember(
        organizationId,
        user,
        role,
        actorUserId,
      );
      return {
        status: 'added' as const,
        member: this.toMemberView(member),
      };
    }

    if (!resolved.phone && !resolved.email) {
      throw new BadRequestException(
        'No user found for this ID. Enter a phone or email to send an invitation.',
      );
    }

    const invitation = await this.createAndSendInvitation({
      organizationId,
      role,
      actorUserId,
      phone: resolved.phone,
      email: resolved.email,
    });

    return {
      status: 'invited' as const,
      invitation: {
        id: invitation.id,
        role: invitation.role,
        invited_phone: invitation.invited_phone,
        invited_email: invitation.invited_email,
        status: invitation.status,
        expires_at: invitation.expires_at,
      },
    };
  }

  async importMembers(
    organizationId: string,
    actorUserId: string,
    dto: ImportOrganizationMembersDto,
  ) {
    const role = dto.role ?? OrganizationMemberRoleEnum.TEACHER;
    if (role === OrganizationMemberRoleEnum.OWNER) {
      throw new BadRequestException('Cannot assign OWNER role via invite');
    }
    await this.accessService.requireManageMemberRole(organizationId, actorUserId, role);

    const inviteMissing = dto.invite_missing !== false;
    const seen = new Set<string>();
    const results: Array<{
      identifier: string;
      status:
        | 'imported'
        | 'already_member'
        | 'invitation_sent'
        | 'invalid'
        | 'duplicate'
        | 'reactivated'
        | 'user_not_found';
      message: string;
    }> = [];

    for (const raw of dto.identifiers) {
      const identifier = (raw ?? '').trim();
      if (!identifier) {
        results.push({
          identifier: raw ?? '',
          status: 'invalid',
          message: inviteMissing ? 'Empty value' : 'Invalid phone number',
        });
        continue;
      }

      if (!inviteMissing) {
        const phone = normalizePhone(identifier);
        if (!phone || !/^01[3-9]\d{8}$/.test(phone)) {
          results.push({
            identifier,
            status: 'invalid',
            message: 'Invalid phone number',
          });
          continue;
        }

        if (seen.has(phone)) {
          results.push({
            identifier: phone,
            status: 'duplicate',
            message: 'Duplicate phone number in this list',
          });
          continue;
        }
        seen.add(phone);

        try {
          const user = await this.userService.findByPhone(phone);
          if (!user) {
            results.push({
              identifier: phone,
              status: 'user_not_found',
              message: 'User not found',
            });
            continue;
          }

          if (!user.is_otp_verified) {
            results.push({
              identifier: phone,
              status: 'invalid',
              message: 'User has not verified their account yet',
            });
            continue;
          }

          const existing = await this.accessService.getMembershipIncludingInactive(
            organizationId,
            user.id,
          );
          if (existing?.is_active === ActiveStatusEnum.ACTIVE) {
            results.push({
              identifier: phone,
              status: 'already_member',
              message: `Already an active ${existing.role.toLowerCase()}`,
            });
            continue;
          }

          await this.attachOrReactivateMember(organizationId, user, role, actorUserId);
          results.push({
            identifier: phone,
            status: existing ? 'reactivated' : 'imported',
            message: existing ? 'Previous membership restored' : 'Successfully added',
          });
        } catch (error) {
          results.push({
            identifier: phone,
            status: 'invalid',
            message: error instanceof Error ? error.message : 'Import failed for this row',
          });
        }
        continue;
      }

      const key = identifier.toLowerCase();
      if (seen.has(key)) {
        results.push({
          identifier,
          status: 'duplicate',
          message: 'Duplicate row in this import',
        });
        continue;
      }
      seen.add(key);

      try {
        const contact = this.parseContactIdentifier(identifier);
        const user = await this.resolveUserFromContact(contact);

        if (user) {
          if (!user.is_otp_verified) {
            results.push({
              identifier,
              status: 'invalid',
              message: 'User has not verified their account yet',
            });
            continue;
          }

          const existing = await this.accessService.getMembershipIncludingInactive(
            organizationId,
            user.id,
          );
          if (existing?.is_active === ActiveStatusEnum.ACTIVE) {
            results.push({
              identifier,
              status: 'already_member',
              message: `Already an active ${existing.role.toLowerCase()}`,
            });
            continue;
          }

          await this.attachOrReactivateMember(organizationId, user, role, actorUserId);
          results.push({
            identifier,
            status: existing ? 'reactivated' : 'imported',
            message: existing
              ? 'Previous membership restored'
              : 'Added to organization',
          });
          continue;
        }

        if (!contact.phone && !contact.email) {
          results.push({
            identifier,
            status: 'invalid',
            message: 'Unknown ID and no phone/email to invite',
          });
          continue;
        }

        await this.createAndSendInvitation({
          organizationId,
          role,
          actorUserId,
          phone: contact.phone,
          email: contact.email,
        });
        results.push({
          identifier,
          status: 'invitation_sent',
          message: 'Invitation created and delivery attempted',
        });
      } catch (error) {
        results.push({
          identifier,
          status: 'invalid',
          message: error instanceof Error ? error.message : 'Import failed for this row',
        });
      }
    }

    return {
      total: results.length,
      imported: results.filter((r) => r.status === 'imported' || r.status === 'reactivated').length,
      already_member: results.filter((r) => r.status === 'already_member').length,
      invitation_sent: results.filter((r) => r.status === 'invitation_sent').length,
      user_not_found: results.filter((r) => r.status === 'user_not_found').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      results,
    };
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    actorUserId: string,
    role: OrganizationMemberRoleEnum,
  ) {
    await this.accessService.requireOwnerOrAdmin(organizationId, actorUserId);

    if (role === OrganizationMemberRoleEnum.OWNER) {
      throw new BadRequestException('Cannot assign OWNER role');
    }

    const membership = await this.memberRepo.findOne({
      where: {
        id: memberId,
        organization_id: organizationId,
        is_active: ActiveStatusEnum.ACTIVE,
      },
      relations: ['user'],
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    if (membership.role === OrganizationMemberRoleEnum.OWNER) {
      throw new BadRequestException('Cannot change the OWNER role');
    }
    if (membership.user_id === actorUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    membership.role = role;
    membership.updated_by = actorUserId;
    membership.updated_at = new Date();
    const saved = await this.memberRepo.save(membership);
    return this.toMemberView(saved);
  }

  async removeMember(organizationId: string, memberId: string, actorUserId: string) {
    const membership = await this.memberRepo.findOne({
      where: {
        id: memberId,
        organization_id: organizationId,
        is_active: ActiveStatusEnum.ACTIVE,
      },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    await this.accessService.requireManageMemberRole(
      organizationId,
      actorUserId,
      membership.role,
    );
    if (membership.role === OrganizationMemberRoleEnum.OWNER) {
      throw new BadRequestException('Cannot remove the organization owner');
    }
    if (
      membership.role === OrganizationMemberRoleEnum.ADMIN &&
      !(await this.accessService.isOwnerOrAdmin(organizationId, actorUserId))
    ) {
      throw new ForbiddenException('Only owners and admins can remove an admin');
    }
    if (membership.user_id === actorUserId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    membership.is_active = ActiveStatusEnum.INACTIVE;
    membership.removed_at = new Date();
    membership.removed_by = actorUserId;
    membership.updated_by = actorUserId;
    membership.updated_at = new Date();
    await this.memberRepo.save(membership);
  }

  /**
   * Upsert STUDENT membership when a student joins an organization class.
   */
  async upsertStudentMember(organizationId: string, userId: string): Promise<void> {
    const existing = await this.memberRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (existing) {
      if (existing.is_active === ActiveStatusEnum.INACTIVE) {
        existing.is_active = ActiveStatusEnum.ACTIVE;
        existing.removed_at = null;
        existing.removed_by = null;
        existing.role = OrganizationMemberRoleEnum.STUDENT;
        existing.updated_at = new Date();
        await this.memberRepo.save(existing);
      }
      return;
    }

    await this.userService.ensureStudentPublicId(userId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const membership = this.memberRepo.create({
      organization_id: organizationId,
      user_id: userId,
      role: OrganizationMemberRoleEnum.STUDENT,
      created_by: userId,
      created_user_name: user?.full_name,
      created_at: new Date(),
      is_active: ActiveStatusEnum.ACTIVE,
    });
    await this.memberRepo.save(membership);
  }

  /**
   * Attach pending org invitations after registration/OTP verify (by phone/email).
   * Does not create duplicate users or memberships.
   */
  async acceptPendingInvitationsForUser(params: {
    userId: string;
    phone?: string | null;
    email?: string | null;
  }): Promise<number> {
    const phone = normalizePhone(params.phone);
    const email = normalizeEmail(params.email);
    if (!phone && !email) {
      return 0;
    }

    const qb = this.invitationRepo
      .createQueryBuilder('inv')
      .where('inv.status = :status', { status: OrganizationInvitationStatusEnum.PENDING })
      .andWhere('(inv.expires_at IS NULL OR inv.expires_at > NOW())');

    if (phone && email) {
      qb.andWhere('(inv.invited_phone = :phone OR inv.invited_email = :email)', {
        phone,
        email,
      });
    } else if (phone) {
      qb.andWhere('inv.invited_phone = :phone', { phone });
    } else {
      qb.andWhere('inv.invited_email = :email', { email });
    }

    const invitations = await qb.getMany();
    if (invitations.length === 0) {
      return 0;
    }

    const user = await this.userService.findById(params.userId);
    let accepted = 0;

    for (const invitation of invitations) {
      try {
        await this.attachOrReactivateMember(
          invitation.organization_id,
          user,
          invitation.role,
          invitation.invited_by,
        );
        invitation.status = OrganizationInvitationStatusEnum.ACCEPTED;
        invitation.accepted_user_id = params.userId;
        invitation.accepted_at = new Date();
        invitation.updated_at = new Date();
        await this.invitationRepo.save(invitation);
        accepted += 1;
      } catch {
        // Skip conflicting invitations without failing registration.
      }
    }

    return accepted;
  }

  private resolveMemberContact(dto: AddOrganizationMemberDto): {
    query?: string;
    phone: string | null;
    email: string | null;
  } {
    if (dto.query?.trim()) {
      return this.parseContactIdentifier(dto.query.trim());
    }
    return {
      phone: normalizePhone(dto.phone) ?? (dto.phone?.trim() || null),
      email: normalizeEmail(dto.email) ?? (dto.email?.trim().toLowerCase() || null),
    };
  }

  private parseContactIdentifier(raw: string): {
    query?: string;
    phone: string | null;
    email: string | null;
  } {
    const trimmed = raw.trim();
    if (trimmed.includes('@')) {
      return { query: trimmed, phone: null, email: normalizeEmail(trimmed) };
    }
    const phone = normalizePhone(trimmed);
    if (phone && /^01[3-9]\d{8}$/.test(phone)) {
      return { query: trimmed, phone, email: null };
    }
    return { query: trimmed, phone: phone && phone.length >= 10 ? phone : null, email: null };
  }

  private async resolveUserFromContact(contact: {
    query?: string;
    phone: string | null;
    email: string | null;
  }): Promise<UserEntity | null> {
    if (contact.query) {
      const byQuery = await this.userService.findByContactOrPublicId(contact.query);
      if (byQuery) {
        return byQuery;
      }
    }
    if (contact.phone) {
      const byPhone = await this.userService.findByPhone(contact.phone);
      if (byPhone) {
        return byPhone;
      }
    }
    if (contact.email) {
      return this.userService.findByEmail(contact.email);
    }
    return null;
  }

  private classifyContactQuery(raw: string): 'email' | 'phone' | 'public_id' | 'unknown' {
    const trimmed = raw.trim();
    if (trimmed.includes('@')) {
      return 'email';
    }
    const phone = normalizePhone(trimmed);
    if (phone && /^01[3-9]\d{8}$/.test(phone)) {
      return 'phone';
    }
    if (/^\d{5,7}$/.test(trimmed)) {
      return 'public_id';
    }
    return 'unknown';
  }

  private async attachOrReactivateMember(
    organizationId: string,
    user: UserEntity,
    role: OrganizationMemberRoleEnum,
    actorUserId: string,
  ): Promise<OrganizationMemberEntity> {
    const existing = await this.memberRepo.findOne({
      where: { organization_id: organizationId, user_id: user.id },
      relations: ['user'],
    });

    if (existing?.is_active === ActiveStatusEnum.ACTIVE) {
      throw new BadRequestException('User is already a member of this organization');
    }

    // Org TEACHER / ASSISTANT / ADMIN need platform teacher capability for RolesGuard,
    // but must NOT automatically receive personal teaching context.
    let workingUser = user;
    if (
      role === OrganizationMemberRoleEnum.TEACHER ||
      role === OrganizationMemberRoleEnum.ADMIN ||
      role === OrganizationMemberRoleEnum.ASSISTANT
    ) {
      await this.userService.ensureTeacherCapability(workingUser.id, { enablePersonal: false });
      workingUser = await this.userService.findById(workingUser.id);
    }

    if (role === OrganizationMemberRoleEnum.STUDENT) {
      await this.userService.ensureStudentPublicId(workingUser.id);
      workingUser = await this.userService.findById(workingUser.id);
    }

    const actor = await this.userService.findById(actorUserId);

    if (existing) {
      existing.role = role;
      existing.is_active = ActiveStatusEnum.ACTIVE;
      existing.removed_at = null;
      existing.removed_by = null;
      existing.updated_by = actorUserId;
      existing.updated_user_name = actor.full_name;
      existing.updated_at = new Date();
      const saved = await this.memberRepo.save(existing);
      const withUser = await this.memberRepo.findOne({
        where: { id: saved.id },
        relations: ['user'],
      });
      return withUser ?? saved;
    }

    const membership = this.memberRepo.create({
      organization_id: organizationId,
      user_id: workingUser.id,
      role,
      created_by: actorUserId,
      created_user_name: actor.full_name,
      created_at: new Date(),
      is_active: ActiveStatusEnum.ACTIVE,
      removed_at: null,
      removed_by: null,
    });

    const saved = await this.memberRepo.save(membership);
    const withUser = await this.memberRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return withUser ?? saved;
  }

  private async createAndSendInvitation(params: {
    organizationId: string;
    role: OrganizationMemberRoleEnum;
    actorUserId: string;
    phone: string | null;
    email: string | null;
  }): Promise<OrganizationInvitationEntity> {
    if (!params.phone && !params.email) {
      throw new BadRequestException('Phone or email is required to send an invitation');
    }

    const organization = await this.accessService.assertApproved(params.organizationId);
    const actor = await this.userService.findById(params.actorUserId);

    const pendingWhere: Array<Record<string, unknown>> = [];
    if (params.phone) {
      pendingWhere.push({
        organization_id: params.organizationId,
        invited_phone: params.phone,
        status: OrganizationInvitationStatusEnum.PENDING,
      });
    }
    if (params.email) {
      pendingWhere.push({
        organization_id: params.organizationId,
        invited_email: params.email,
        status: OrganizationInvitationStatusEnum.PENDING,
      });
    }

    let invitation =
      pendingWhere.length > 0
        ? await this.invitationRepo.findOne({ where: pendingWhere })
        : null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ORG_INVITE_TTL_DAYS);

    if (invitation) {
      invitation.role = params.role;
      invitation.invited_by = params.actorUserId;
      invitation.token = randomUUID();
      invitation.expires_at = expiresAt;
      invitation.updated_by = params.actorUserId;
      invitation.updated_at = new Date();
      invitation = await this.invitationRepo.save(invitation);
    } else {
      invitation = await this.invitationRepo.save(
        this.invitationRepo.create({
          organization_id: params.organizationId,
          invited_phone: params.phone,
          invited_email: params.email,
          role: params.role,
          invited_by: params.actorUserId,
          token: randomUUID(),
          status: OrganizationInvitationStatusEnum.PENDING,
          expires_at: expiresAt,
          created_by: params.actorUserId,
          created_user_name: actor.full_name,
          created_at: new Date(),
        }),
      );
    }

    const frontendUrl = resolveFrontendUrl(this.configService);
    const invitationLink = `${frontendUrl}/signup?orgInvite=${invitation.token}`;
    const roleLabel = params.role.toLowerCase();

    let deliveryEmail = params.email ? normalizeEmail(params.email) : null;
    if (!deliveryEmail && params.phone) {
      const existingByPhone = await this.userService.findByPhone(params.phone);
      deliveryEmail = normalizeEmail(existingByPhone?.email);
    }

    if (!deliveryEmail) {
      throw new BadRequestException(
        'An email address is required to send an organization invitation. SMS invitations are no longer supported.',
      );
    }

    if (!invitation.invited_email) {
      invitation.invited_email = deliveryEmail;
      invitation = await this.invitationRepo.save(invitation);
    }

    await this.emailService.sendOrganizationInvitationEmail(
      deliveryEmail,
      invitationLink,
      organization.name,
      roleLabel,
      actor.full_name ?? undefined,
    );

    return invitation;
  }

  async listTeacherSubjects(organizationId: string, teacherId: string, actorUserId: string) {
    await this.accessService.requireMember(organizationId, actorUserId);

    const rows = await this.teacherSubjectRepo.find({
      where: { organization_id: organizationId, teacher_id: teacherId },
      relations: ['subject'],
      order: { created_at: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      teacher_id: row.teacher_id,
      subject_id: row.subject_id,
      subject: row.subject
        ? { id: row.subject.id, name: row.subject.name, code: row.subject.code }
        : null,
    }));
  }

  async assignTeacherSubject(
    organizationId: string,
    teacherId: string,
    subjectId: string,
    actorUserId: string,
  ) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const teacherMembership = await this.memberRepo.findOne({
      where: {
        organization_id: organizationId,
        user_id: teacherId,
        is_active: ActiveStatusEnum.ACTIVE,
      },
    });
    if (!teacherMembership) {
      throw new NotFoundException('Teacher is not a member of this organization');
    }
    if (
      teacherMembership.role !== OrganizationMemberRoleEnum.TEACHER &&
      teacherMembership.role !== OrganizationMemberRoleEnum.ADMIN &&
      teacherMembership.role !== OrganizationMemberRoleEnum.OWNER
    ) {
      throw new BadRequestException('Subject assignment is only for teaching members');
    }

    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const existing = await this.teacherSubjectRepo.findOne({
      where: {
        organization_id: organizationId,
        teacher_id: teacherId,
        subject_id: subjectId,
      },
    });
    if (existing) {
      throw new BadRequestException('Subject already assigned to this teacher');
    }

    const actor = await this.userService.findById(actorUserId);
    const row = this.teacherSubjectRepo.create({
      organization_id: organizationId,
      teacher_id: teacherId,
      subject_id: subjectId,
      created_by: actorUserId,
      created_user_name: actor.full_name,
      created_at: new Date(),
    });
    const saved = await this.teacherSubjectRepo.save(row);
    return {
      id: saved.id,
      organization_id: saved.organization_id,
      teacher_id: saved.teacher_id,
      subject_id: saved.subject_id,
      subject: { id: subject.id, name: subject.name, code: subject.code },
    };
  }

  async unassignTeacherSubject(
    organizationId: string,
    teacherId: string,
    subjectId: string,
    actorUserId: string,
  ) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const row = await this.teacherSubjectRepo.findOne({
      where: {
        organization_id: organizationId,
        teacher_id: teacherId,
        subject_id: subjectId,
      },
    });
    if (!row) {
      throw new NotFoundException('Teacher subject assignment not found');
    }

    await this.teacherSubjectRepo.remove(row);
  }

  async listOrganizationSubjects(organizationId: string, actorUserId: string) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const subjects = await this.subjectRepo.find({
      where: { organization_id: organizationId },
      order: { name: 'ASC' },
    });
    const ids = subjects.map((subject) => subject.id);
    const attachments = ids.length
      ? await this.classSubjectRepo.find({
          where: { subject_id: In(ids) },
          relations: ['class'],
        })
      : [];

    return subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      classes: attachments
        .filter((row) => row.subject_id === subject.id)
        .map((row) => ({
          id: row.class_id,
          class_name: row.class?.class_name ?? '',
        })),
    }));
  }

  async createOrganizationSubject(
    organizationId: string,
    actorUserId: string,
    dto: { name: string; code: string },
    actorName?: string,
  ) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);
    return this.findOrCreateOrganizationSubject(organizationId, actorUserId, dto, actorName, true);
  }

  async findOrCreateOrganizationSubject(
    organizationId: string,
    actorUserId: string,
    dto: { name: string; code: string },
    actorName?: string,
    failIfExists = false,
  ) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);
    const name = dto.name.trim();
    const code = dto.code.trim();
    if (!name || !code) {
      throw new BadRequestException('Subject name and code are required');
    }

    const existing = await this.subjectRepo.findOne({
      where: { organization_id: organizationId, name: ILike(name), code: ILike(code) },
    });
    if (existing) {
      if (failIfExists) {
        throw new ConflictException('A subject with this name and code already exists in the organization');
      }
      return existing;
    }

    return this.subjectRepo.save(
      this.subjectRepo.create({
        name,
        code,
        organization_id: organizationId,
        created_by: actorUserId,
        created_user_name: actorName ?? '',
        created_at: new Date(),
      }),
    );
  }

  async updateOrganizationSubject(
    organizationId: string,
    subjectId: string,
    actorUserId: string,
    dto: { name?: string; code?: string },
    actorName?: string,
  ) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const subject = await this.subjectRepo.findOne({
      where: { id: subjectId, organization_id: organizationId },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    if (dto.name?.trim()) {
      subject.name = dto.name.trim();
    }
    if (dto.code?.trim()) {
      subject.code = dto.code.trim();
    }

    const dup = await this.subjectRepo.findOne({
      where: {
        organization_id: organizationId,
        name: ILike(subject.name),
        code: ILike(subject.code ?? ''),
      },
    });
    if (dup && dup.id !== subjectId) {
      throw new ConflictException('A subject with this name and code already exists in the organization');
    }

    subject.updated_by = actorUserId;
    subject.updated_user_name = actorName ?? '';
    subject.updated_at = new Date();
    return this.subjectRepo.save(subject);
  }

  async removeOrganizationSubject(organizationId: string, subjectId: string, actorUserId: string) {
    await this.accessService.requireAcademicManager(organizationId, actorUserId);

    const subject = await this.subjectRepo.findOne({
      where: { id: subjectId, organization_id: organizationId },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const inUse = await this.classSubjectRepo.count({ where: { subject_id: subjectId } });
    if (inUse > 0) {
      throw new BadRequestException('Remove this subject from all classes before deleting it');
    }

    await this.subjectRepo.remove(subject);
    return { removed: true };
  }

  private toMemberView(member: OrganizationMemberEntity) {
    return {
      id: member.id,
      organization_id: member.organization_id,
      user_id: member.user_id,
      role: member.role,
      is_active: member.is_active,
      removed_at: member.removed_at,
      created_at: member.created_at,
      user: {
        id: member.user_id,
        full_name: member.user?.full_name ?? null,
        email: member.user?.email ?? null,
        phone: member.user?.phone ?? null,
        role: member.user?.role ?? null,
        teacher_public_id: member.user?.teacher_public_id ?? null,
        student_public_id: member.user?.student_public_id ?? null,
        public_id: member.user?.public_id ?? null,
        personal_teacher_enabled: Boolean(member.user?.personal_teacher_enabled),
      },
    };
  }
}
