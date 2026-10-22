import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { OrganizationMemberEntity } from '../entities/organization-member.entity';
import { OrganizationEntity } from '../entities/organization.entity';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';
import { OrgContext } from '../interfaces/org-context.interface';

export const ORGANIZATION_ID_HEADER = 'x-organization-id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const rawHeader =
      request.headers?.[ORGANIZATION_ID_HEADER] ??
      request.headers?.['X-Organization-Id'];
    const headerOrgId =
      typeof rawHeader === 'string'
        ? rawHeader.trim()
        : Array.isArray(rawHeader)
          ? String(rawHeader[0] ?? '').trim()
          : '';

    // Organization login sessions lock context to the JWT claim.
    const jwtOrgId =
      typeof user?.organization_id === 'string' ? user.organization_id.trim() : '';

    if (jwtOrgId) {
      if (headerOrgId && headerOrgId !== jwtOrgId) {
        throw new ForbiddenException('Organization context does not match this session');
      }
      return this.attachOrgContext(request, jwtOrgId, user?.id);
    }

    // Individual sessions ignore org headers — always individual workspace.
    if (headerOrgId) {
      request.orgContext = null;
      return true;
    }

    request.orgContext = null;
    return true;
  }

  private async attachOrgContext(
    request: { orgContext?: OrgContext | null; organization?: OrganizationEntity },
    organizationId: string,
    userId?: string,
  ): Promise<boolean> {
    if (!UUID_RE.test(organizationId)) {
      throw new BadRequestException('Organization id must be a valid UUID');
    }

    if (!userId) {
      throw new ForbiddenException('Authentication required for organization context');
    }

    const organization = await this.organizationRepo.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ForbiddenException('Organization not found');
    }

    if (organization.status !== OrganizationStatusEnum.APPROVED) {
      throw new ForbiddenException(
        'Organization workspace is not available until the organization is approved',
      );
    }

    const membership = await this.memberRepo.findOne({
      where: {
        organization_id: organizationId,
        user_id: userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (membership.is_active === ActiveStatusEnum.INACTIVE) {
      throw new ForbiddenException('Your organization membership is inactive');
    }

    request.orgContext = {
      organizationId,
      memberRole: membership.role,
    };
    request.organization = organization;

    return true;
  }
}
