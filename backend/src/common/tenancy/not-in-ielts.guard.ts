import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContext } from './tenant-context';
import { OrgSettingsService } from 'src/organizations/org-settings.service';

/** Error code for academic-only features called in an IELTS workspace (P12-03). */
export const NOT_IN_IELTS = 'NOT_IN_IELTS';

/**
 * Refuses an academic-only feature in an IELTS workspace (P12-03, IEL-12), e.g. leave requests.
 * Put it after OrganizationContextGuard, which sets the tenant.
 */
@Injectable()
export class NotInIeltsGuard implements CanActivate {
  constructor(private readonly orgSettings: OrgSettingsService) {}

  async canActivate(): Promise<boolean> {
    const tenant = TenantContext.current();
    if (tenant && (await this.orgSettings.isIelts(tenant.organizationId))) {
      throw new ForbiddenException({ message: 'This is not part of IELTS workspaces', code: NOT_IN_IELTS });
    }
    return true;
  }
}
