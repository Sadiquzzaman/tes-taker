import { ForbiddenException, Injectable } from '@nestjs/common';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { HomeworkSettings, OrgSettingsService } from 'src/organizations/org-settings.service';
import { UpdateHomeworkSettingsDto } from './dto/homework.dto';
import { HOMEWORK_ERRORS } from './homework-errors';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;

/**
 * The organisation's homework settings (Epic 2 settings table): late work accepted or not, the late
 * penalty, how many times a student may hand in again, and the most files per hand-in. Stored in
 * org_settings (organizations module); this service owns the rules. Staff read them; owners and
 * admins (a solo teacher in their own workspace) change them.
 */
@Injectable()
export class HomeworkSettingsService {
  constructor(
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  get(tenant: Tenant): Promise<HomeworkSettings> {
    if (tenant.viaEnrolment || ![OWNER, ADMIN, ASSISTANT, TEACHER].includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace see its homework settings', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
    return this.orgSettings.getHomework(tenant.organizationId);
  }

  async update(tenant: Tenant, userId: string, dto: UpdateHomeworkSettingsDto): Promise<HomeworkSettings> {
    if (tenant.viaEnrolment || ![OWNER, ADMIN].includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only owners and admins change homework settings', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
    const changes: Partial<HomeworkSettings> = {};
    if (dto.late_allowed !== undefined) changes.late_allowed = dto.late_allowed;
    if (dto.late_penalty) changes.late_penalty = { type: dto.late_penalty.type, percent: dto.late_penalty.type === 'NONE' ? 0 : dto.late_penalty.percent };
    if (dto.resubmissions !== undefined) changes.resubmissions = dto.resubmissions;
    if (dto.max_files !== undefined) changes.max_files = dto.max_files;
    if (Object.keys(changes).length === 0) return this.orgSettings.getHomework(tenant.organizationId);

    const { before, after } = await this.orgSettings.saveHomework(tenant.organizationId, userId, changes);
    const diff = auditChanges(before, after);
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.HOMEWORK_SETTINGS_UPDATE,
        organizationId: tenant.organizationId,
        actorId: userId,
        entityType: 'org_settings',
        entityId: tenant.organizationId,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  }
}
