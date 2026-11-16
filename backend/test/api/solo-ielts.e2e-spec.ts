import { RolesEnum } from '../../src/common/enums/roles.enum';
import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { TeacherRoleRequestEntity } from '../../src/teacher-requests/entities/teacher-role-request.entity';
import { TeacherRequestService } from '../../src/teacher-requests/teacher-request.service';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Session = { access_token: string; workspace_type?: string; context_type?: string };

/** Solo IELTS trainers (P12-03, IEL-11): the choice at teacher sign-up makes an IELTS solo workspace on approval. */
describe('solo IELTS trainers (P12-03)', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let crypto: CryptoUtil;
  const password = 'Solo#Ielts123';

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    crypto = t.app.get(CryptoUtil);
  });

  afterAll(async () => {
    await t.close();
  });

  const approve = async (requestId: string) => {
    const admin = await make.user(RolesEnum.ADMIN);
    const response = await t.api.request('PATCH', `/teacher-requests/admin/${requestId}/approve`, { body: {}, token: t.tokenFor(admin) });
    expect(response.status).toBe(200);
  };
  const soloOf = async (userId: string) =>
    t.dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder('o')
      .innerJoin('organization_members', 'm', 'm.organization_id = o.id')
      .where('m.user_id = :userId AND o.kind = :solo', { userId, solo: OrganizationKindEnum.SOLO })
      .getOne();

  it('keeps the choice from sign-up on the teacher request', async () => {
    const phone = `017${String(Date.now()).slice(-8)}`;
    const signup = await t.api.post('/auth/register', {
      full_name: 'Solo Trainer',
      email: `solo.${phone}@example.test`,
      phone,
      password,
      confirm_password: password,
      request_teacher: true,
      workspace_type: 'IELTS',
    });
    expect(signup.status).toBeLessThan(300);
    const [row] = await t.dataSource.query(
      `SELECT r.workspace_type FROM teacher_role_requests r JOIN users u ON u.id = r.user_id WHERE u.phone = $1`,
      [phone],
    );
    expect(row.workspace_type).toBe('IELTS');
    expect((await t.api.post('/auth/register', { full_name: 'X', email: 'x.solo@example.test', phone: `018${String(Date.now()).slice(-8)}`, password, confirm_password: password, request_teacher: true, workspace_type: 'TERTIARY' })).status).toBe(400);
  });

  it('makes an IELTS solo workspace on approval; sign-in says IELTS and the IELTS pages answer', async () => {
    const student = await make.student({ password: await crypto.hashPassword(password) });
    const request = await t.app.get(TeacherRequestService).createRequest(student.id, { workspace_type: 'IELTS' });
    await approve((request as { id: string }).id);

    const solo = await soloOf(student.id);
    expect(solo).toMatchObject({ workspace_type: 'IELTS' });
    expect(solo?.level_labels).toMatchObject({ preset: 'COURSE_BATCH' });

    const login = await t.api.post<Body<Session>>('/auth/login', { phone: student.phone, password });
    expect(login.status).toBe(200);
    expect(login.body.payload.workspace_type).toBe('IELTS');
    const refreshed = await t.api.post<Body<Session>>('/auth/refresh', { refreshToken: (login.body.payload as unknown as { refresh_token: string }).refresh_token });
    expect(refreshed.body.payload.workspace_type).toBe('IELTS');

    // The IELTS check accepts the solo workspace (any plan feature aside).
    const type = await t.api.get<Body<{ workspace_type: string; kind: string }>>('/workspace/type', login.body.payload.access_token);
    expect(type.body.payload).toMatchObject({ workspace_type: 'IELTS', kind: 'SOLO' });
  });

  it('keeps Academic as before for everyone else', async () => {
    const student = await make.student({ password: await crypto.hashPassword(password) });
    const request = await t.app.get(TeacherRequestService).createRequest(student.id);
    expect(await t.dataSource.getRepository(TeacherRoleRequestEntity).findOneBy({ id: (request as { id: string }).id })).toMatchObject({ workspace_type: 'ACADEMIC' });
    await approve((request as { id: string }).id);
    const login = await t.api.post<Body<Session>>('/auth/login', { phone: student.phone, password });
    expect(login.body.payload.workspace_type).toBe('ACADEMIC');
  });
});
