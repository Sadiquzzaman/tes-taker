import { SetMetadata } from '@nestjs/common';

export const BRANCH_SCOPED_KEY = 'branchScoped';

/**
 * Marks an endpoint (or a whole controller) as safe for branch managers (P12-01, FND-06): it
 * either holds nothing branch-specific (the plan, the workspace type) or limits its data to the
 * manager's branch (`Tenant.branchId`). OrganizationContextGuard refuses branch managers
 * everywhere else, so a new endpoint is closed to them until it is checked and marked.
 */
export const BranchScoped = () => SetMetadata(BRANCH_SCOPED_KEY, true);
