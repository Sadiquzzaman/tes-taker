import { ForbiddenException } from '@nestjs/common';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { AcademicAccess } from './academic-access';
import { currentYearIn } from './academic-sessions.service';

const { OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT } = OrganizationMemberRoleEnum;

const as = (memberRole: OrganizationMemberRoleEnum, check: () => unknown, viaEnrolment = false) =>
  TenantContext.run(() => {
    TenantContext.set({ organizationId: 'org-1', kind: OrganizationKindEnum.SCHOOL, memberRole, viaEnrolment });
    try {
      check();
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  });

describe('AcademicAccess', () => {
  it.each([
    ['read', AcademicAccess.read, [OWNER, ADMIN, ASSISTANT, TEACHER]],
    ['manageStructure', AcademicAccess.manageStructure, [OWNER, ADMIN, ASSISTANT]],
    ['manageSessions', AcademicAccess.manageSessions, [OWNER, ADMIN]],
    ['reopenSession', AcademicAccess.reopenSession, [OWNER]],
  ])('%s is allowed for %j only', (_name, check, allowed) => {
    for (const role of [OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT]) {
      expect(as(role, check)).toBe(allowed.includes(role));
    }
  });

  it("refuses a student who reaches a solo teacher's workspace by enrolment", () => {
    expect(as(STUDENT, AcademicAccess.read, true)).toBe(false);
  });

  it('refuses a request without a workspace', () => {
    expect(TenantContext.run(() => () => AcademicAccess.read())).toThrow(ForbiddenException);
  });
});

describe('currentYearIn', () => {
  it('uses the calendar year of the time zone', () => {
    // 31 Dec 20:00 UTC is already 1 Jan in Dhaka (UTC+6).
    const newYearsEve = new Date('2026-12-31T20:00:00Z');
    expect(currentYearIn('Asia/Dhaka', newYearsEve)).toBe(2027);
    expect(currentYearIn('UTC', newYearsEve)).toBe(2026);
  });

  it('falls back to Asia/Dhaka for an unknown zone', () => {
    expect(currentYearIn('Not/AZone', new Date('2026-12-31T20:00:00Z'))).toBe(2027);
  });
});
