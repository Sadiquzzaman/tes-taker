import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { IeltsBandTableEntity } from '../../src/ielts/entities/ielts-band-table.entity';
import { IeltsModuleEnum, IeltsTestTypeEnum } from '../../src/ielts/entities/ielts-profile.entity';
import { IeltsBandTablesService } from '../../src/ielts/ielts-band-tables.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Table = { module: string; test_type: string | null; rows: { min_raw: number; band: number }[]; customised: boolean };

/**
 * Band tables (P10-02, IEL-04, IEL-05): every centre starts on the platform defaults for
 * Listening, Academic Reading and General Training Reading; owners and admins save the centre's
 * own copy and can put it back; scoring reads the centre's table, else the default.
 */
describe('IELTS band tables', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  /** A centre (IELTS or school) with its owner, a teacher and a student. */
  const centre = async ({ ielts = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (ielts) {
      await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    }
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-02 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const teacher = await make.teacher();
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const student = await make.student();
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    return {
      organization,
      ownerToken: token(owner, OrganizationMemberRoleEnum.OWNER),
      teacherToken: token(teacher, OrganizationMemberRoleEnum.TEACHER),
      studentToken: token(student, OrganizationMemberRoleEnum.STUDENT),
    };
  };

  const listening = (tables: Table[]) => tables.find((x) => x.module === 'LISTENING') as Table;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('starts every centre on the three default tables; students cannot read them', async () => {
    const s = await centre();
    const tables = (await call<Table[]>('GET', '/ielts/band-tables', s.teacherToken)).body.payload;
    expect(tables.map((x) => [x.module, x.test_type, x.customised])).toEqual([
      ['LISTENING', null, false],
      ['READING', 'ACADEMIC', false],
      ['READING', 'GENERAL', false],
    ]);
    // Each runs from the top band down to raw 0.
    for (const table of tables) {
      expect(table.rows[0].band).toBe(9);
      expect(table.rows[table.rows.length - 1]).toEqual({ min_raw: 0, band: 0 });
    }
    expect((await call('GET', '/ielts/band-tables', s.studentToken)).body.code).toBe('IELTS_STAFF_ONLY');
  });

  it('lets owners and admins save the centre’s own copy and put it back; scoring follows it', async () => {
    const s = await centre();
    const other = await centre();
    const service = t.app.get(IeltsBandTablesService);
    const rows = [{ min_raw: 35, band: 9 }, { min_raw: 20, band: 6 }, { min_raw: 0, band: 2 }];
    const scope = { module: 'LISTENING', rows };

    expect((await call('PUT', '/ielts/band-tables', s.teacherToken, scope)).body.code).toBe('IELTS_MANAGERS_ONLY');
    expect(await service.bandFor(s.organization.id, IeltsModuleEnum.LISTENING, IeltsTestTypeEnum.ACADEMIC, 30)).toBe(7);

    const saved = await call<Table>('PUT', '/ielts/band-tables', s.ownerToken, scope);
    expect(saved.status).toBe(200);
    expect(saved.body.payload).toMatchObject({ module: 'LISTENING', test_type: null, rows, customised: true });
    expect(listening((await call<Table[]>('GET', '/ielts/band-tables', s.teacherToken)).body.payload).rows).toEqual(rows);
    expect(await service.bandFor(s.organization.id, IeltsModuleEnum.LISTENING, IeltsTestTypeEnum.ACADEMIC, 30)).toBe(6);
    // Another centre keeps the default.
    expect(listening((await call<Table[]>('GET', '/ielts/band-tables', other.teacherToken)).body.payload).customised).toBe(false);
    expect(await service.bandFor(other.organization.id, IeltsModuleEnum.LISTENING, IeltsTestTypeEnum.ACADEMIC, 30)).toBe(7);

    // Reading has two tables; a General Training change leaves Academic alone.
    const general = await call<Table>('PUT', '/ielts/band-tables', s.ownerToken, { module: 'READING', test_type: 'GENERAL', rows });
    expect(general.body.payload).toMatchObject({ test_type: 'GENERAL', customised: true });
    expect(await service.bandFor(s.organization.id, IeltsModuleEnum.READING, IeltsTestTypeEnum.GENERAL, 36)).toBe(9);
    expect(await service.bandFor(s.organization.id, IeltsModuleEnum.READING, IeltsTestTypeEnum.ACADEMIC, 36)).toBe(8);

    const reset = await call<Table>('POST', '/ielts/band-tables/reset', s.ownerToken, { module: 'LISTENING' });
    expect(reset.status).toBe(200);
    expect(reset.body.payload.customised).toBe(false);
    expect(await service.bandFor(s.organization.id, IeltsModuleEnum.LISTENING, IeltsTestTypeEnum.ACADEMIC, 30)).toBe(7);
    // The copy is kept (nothing is deleted), and every change is in the audit log.
    expect(await t.dataSource.getRepository(IeltsBandTableEntity).count({ where: { organization_id: s.organization.id } })).toBe(2);
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'ielts.band_table_update' } })).toBe(3);
  });

  it('refuses tables that do not run from 40 down to 0 in half bands', async () => {
    const s = await centre();
    for (const bad of [
      { module: 'LISTENING', rows: [] },
      { module: 'LISTENING', rows: [{ min_raw: 30, band: 7 }] },
      { module: 'LISTENING', rows: [{ min_raw: 30, band: 6 }, { min_raw: 20, band: 7 }, { min_raw: 0, band: 0 }] },
      { module: 'LISTENING', rows: [{ min_raw: 30, band: 7.2 }, { min_raw: 0, band: 0 }] },
      { module: 'LISTENING', test_type: 'ACADEMIC', rows: [{ min_raw: 0, band: 0 }] },
      { module: 'READING', rows: [{ min_raw: 0, band: 0 }] },
    ]) {
      const res = await call('PUT', '/ielts/band-tables', s.ownerToken, bad);
      expect([res.status, res.body.code]).toEqual([400, 'IELTS_BAND_TABLE_INVALID']);
    }
    expect((await call('PUT', '/ielts/band-tables', s.ownerToken, { module: 'WRITING', rows: [{ min_raw: 0, band: 0 }] })).status).toBe(400);
  });

  it('answers only in IELTS centres', async () => {
    const school = await centre({ ielts: false });
    const res = await call('GET', '/ielts/band-tables', school.ownerToken);
    expect([res.status, res.body.code]).toEqual([403, 'IELTS_ONLY_CENTRES']);
  });
});
