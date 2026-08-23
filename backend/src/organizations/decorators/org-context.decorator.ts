import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgContext as OrgContextType } from '../interfaces/org-context.interface';

/**
 * Reads `request.orgContext` set by OrganizationContextGuard.
 * Empty / omitted X-Organization-Id → null (individual teacher workspace).
 */
export const OrgContext = createParamDecorator(
  (
    data: keyof OrgContextType | undefined,
    ctx: ExecutionContext,
  ): OrgContextType | null | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const orgContext: OrgContextType | null | undefined = request.orgContext;

    if (data && orgContext) {
      return orgContext[data];
    }

    return orgContext ?? null;
  },
);
