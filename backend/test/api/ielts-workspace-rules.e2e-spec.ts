import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { OrgSettingsService } from '../../src/organizations/org-settings.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };

/** IELTS workspaces (P12-03, IEL-12): guardians off by default, no attendance SMS, no leave requests. */
describe('IELTS workspace rules (P12-03)', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  const orgSession = (user: UserEntity, organization: OrganizationEntity) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: OrganizationMemberRoleEnum.OWNER });
  const centre = async (ielts: boolean) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner, ielts ? { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } : {});
    const classEntity = await make.classOf(owner, { organization_id: organization.id });
    const enrolment = await make.enrol(classEntity, await make.student());
    return { owner, organization, enrolment, token: orgSession(owner, organization) };
  };

  it('keeps guardians off in IELTS until the owner switches them on', async () => {
    const { owner, organization, enrolment, token } = await centre(true);
    const settings = await t.api.get<Body<{ guardians_enabled: boolean }>>(`/organizations/${organization.id}/settings`, t.tokenFor(owner));
    expect(settings.body.payload.guardians_enabled).toBe(false);
    const off = await t.api.get<Body<null>>(`/enrolments/${enrolment.id}/guardians`, token);
    expect(off.status).toBe(403);
    expect(off.body.code).toBe('GUARDIANS_OFF');

    const on = await t.api.request<Body<{ guardians_enabled: boolean }>>('PATCH', `/organizations/${organization.id}/settings`, {
      body: { guardians_enabled: true },
      token: t.tokenFor(owner),
    });
    expect(on.body.payload.guardians_enabled).toBe(true);
    expect((await t.api.get(`/enrolments/${enrolment.id}/guardians`, token)).status).toBe(200);
  });

  it('keeps guardians on for Academic as before', async () => {
    const { owner, organization, enrolment, token } = await centre(false);
    const settings = await t.api.get<Body<{ guardians_enabled: boolean }>>(`/organizations/${organization.id}/settings`, t.tokenFor(owner));
    expect(settings.body.payload.guardians_enabled).toBe(true);
    expect((await t.api.get(`/enrolments/${enrolment.id}/guardians`, token)).status).toBe(200);
  });

  it('sends no attendance SMS in IELTS, whatever the switches say', async () => {
    const ielts = await centre(true);
    const academic = await centre(false);
    const settings = t.app.get(OrgSettingsService);
    expect((await settings.getAttendance(ielts.organization.id)).guardian_sms).toEqual({ late: false, absent: false, leave: false });
    expect((await settings.getAttendance(academic.organization.id)).guardian_sms).toEqual({ late: true, absent: true, leave: true });
  });

  it('refuses leave requests in IELTS only', async () => {
    const ielts = await centre(true);
    const refused = await t.api.get<Body<null>>('/attendance/leave/mine', ielts.token);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('NOT_IN_IELTS');
    const academic = await centre(false);
    const academicLeave = await t.api.get<Body<null>>('/attendance/leave/mine', academic.token);
    expect(academicLeave.body.code).not.toBe('NOT_IN_IELTS');
  });
});
