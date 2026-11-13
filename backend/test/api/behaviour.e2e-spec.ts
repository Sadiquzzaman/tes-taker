import { DeepPartial } from 'typeorm';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from '../../src/academics/entities/academic-session.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { BehaviourService } from '../../src/results/behaviour.service';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Criterion = { id: string; name_en: string; name_bn: string };
type Grid = { criteria: Criterion[]; rows: { student: { id: string; full_name: string }; ratings: Record<string, number>; remark: string | null }[]; can_edit: boolean };

/**
 * Class behaviour (P7-01, PRF-04): each school's criteria (three to start with; owners and admins
 * change the list) and a grid per subject class and day where its teacher rates every student 1–5
 * with a remark; the averages feed the scores.
 */
describe('behaviour API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  /** Class 6 A: Math (Rina) and English (Karim), with two students, and the performance feature on. */
  const school = async ({ performanceOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const override = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/performance`, {
      body: { value: performanceOn, reason: 'P7-01 test' },
      token: t.tokenFor(admin),
    });
    expect(override.status).toBe(200);
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const english = await subjects.save({ name: 'English', code: 'ENG', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [math, english]) await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: subject.id });
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const [section] = (await call<{ id: string; session_id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const offerings = (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${section.id}/offerings`, ownerToken)).body.payload;
    const mathOffering = offerings.find((o) => o.subject.id === math.id)!.id;
    const englishOffering = offerings.find((o) => o.subject.id === english.id)!.id;
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathOffering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    await call('PUT', `/offerings/${englishOffering}/teachers`, ownerToken, { teacher_ids: [karim.id] });
    return {
      organization,
      ownerToken,
      sessionId: section.session_id,
      rina,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      rafi,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      mathOffering,
      englishOffering,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('starts with three criteria; owners and admins rename, add and retire them', async () => {
    const s = await school();
    const first = (await call<Criterion[]>('GET', '/behaviour/criteria', s.rinaToken)).body.payload;
    expect(first.map((c) => [c.name_en, c.name_bn])).toEqual([
      ['Participation', 'অংশগ্রহণ'],
      ['Discipline', 'শৃঙ্খলা'],
      ['Attentiveness', 'মনোযোগ'],
    ]);
    const list = [
      { id: first[0].id, name_en: 'Class participation', name_bn: 'ক্লাসে অংশগ্রহণ' },
      { id: first[1].id, name_en: 'Discipline', name_bn: 'শৃঙ্খলা' },
      { name_en: 'Homework habits', name_bn: 'বাড়ির কাজের অভ্যাস' },
    ];
    expect((await call('PUT', '/behaviour/criteria', s.rinaToken, { criteria: list })).status).toBe(403);
    const twice = await call('PUT', '/behaviour/criteria', s.ownerToken, { criteria: [list[1], { name_en: 'discipline', name_bn: 'অন্য' }] });
    expect([twice.status, twice.body.code]).toEqual([400, 'RESULTS_CRITERIA_INVALID']);
    const saved = await call<Criterion[]>('PUT', '/behaviour/criteria', s.ownerToken, { criteria: list });
    expect(saved.body.payload.map((c) => c.name_en)).toEqual(['Class participation', 'Discipline', 'Homework habits']);
    expect(saved.body.payload[0].id).toBe(first[0].id);
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'behaviour.criteria' } })).toBe(1);
  });

  it('rates each student 1–5 per criterion on a day, replaces the day on a second save, and averages them', async () => {
    const s = await school();
    const [p, d, a] = (await call<Criterion[]>('GET', '/behaviour/criteria', s.rinaToken)).body.payload;
    const day = '2026-11-12';
    const grid = await call<Grid>('GET', `/behaviour/grid?offering_id=${s.mathOffering}&date=${day}`, s.rinaToken);
    expect(grid.body.payload.rows.map((r) => r.student.full_name).sort()).toEqual(['Mitu', 'Rafi']);
    expect(grid.body.payload.can_edit).toBe(true);

    const six = await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: day, rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 6 } }] });
    expect([six.status, six.body.code]).toEqual([400, 'RESULTS_RATING_INVALID']);
    const future = await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: '2099-01-01', rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 4 } }] });
    expect(future.body.code).toBe('RESULTS_RATING_INVALID');
    const remarkOnly = await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: day, rows: [{ student_id: s.rafi.id, ratings: {}, remark: 'Quiet today' }] });
    expect([remarkOnly.status, remarkOnly.body.code]).toEqual([400, 'RESULTS_REMARK_NEEDS_RATING']);
    expect((await call('PUT', '/behaviour/grid', s.karimToken, { offering_id: s.mathOffering, date: day, rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 4 } }] })).status).toBe(404);
    expect((await call('GET', `/behaviour/grid?offering_id=${s.mathOffering}&date=${day}`, s.mituToken)).status).toBe(403);
    expect((await call('GET', '/behaviour/criteria', s.mituToken)).status).toBe(403);

    const saved = await call<Grid>('PUT', '/behaviour/grid', s.rinaToken, {
      offering_id: s.mathOffering,
      date: day,
      rows: [
        { student_id: s.mitu.id, ratings: { [p.id]: 5, [d.id]: 4, [a.id]: 3 }, remark: ' Asks good questions ' },
        { student_id: s.rafi.id, ratings: { [p.id]: 2, [d.id]: null } },
      ],
    });
    expect(saved.status).toBe(200);
    const mitu = saved.body.payload.rows.find((r) => r.student.id === s.mitu.id)!;
    expect(mitu).toMatchObject({ ratings: { [p.id]: 5, [d.id]: 4, [a.id]: 3 }, remark: 'Asks good questions' });
    expect(saved.body.payload.rows.find((r) => r.student.id === s.rafi.id)!.ratings).toEqual({ [p.id]: 2 });

    // The same day again replaces Mitu's participation; an empty criterion keeps its rating.
    await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: day, rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 4, [d.id]: null } }] });
    await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: '2026-11-13', rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 5 } }] });
    const averages = await t.app.get(BehaviourService).averagesOf(s.organization.id, [s.mitu.id, s.rafi.id], '2026-11-01', '2026-11-30');
    expect(averages.map((x) => [x.student_id === s.mitu.id ? 'Mitu' : 'Rafi', x.average, x.percent, x.ratings]).sort()).toEqual([
      ['Mitu', 4, 80, 4],
      ['Rafi', 2, 40, 1],
    ]);

    await t.app.get(AuditService).flush();
    const logged = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'behaviour.rate' } });
    expect(logged).toHaveLength(4);
  });

  it('is read-only in a closed session, needs the performance feature, and keeps schools apart', async () => {
    const s = await school();
    const [p] = (await call<Criterion[]>('GET', '/behaviour/criteria', s.rinaToken)).body.payload;
    const other = await school();
    expect((await call('GET', `/behaviour/grid?offering_id=${s.mathOffering}&date=2026-11-12`, other.ownerToken)).status).toBe(404);
    const foreign = await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: '2026-11-12', rows: [{ student_id: s.mitu.id, ratings: { [(await call<Criterion[]>('GET', '/behaviour/criteria', other.ownerToken)).body.payload[0].id]: 3 } }] });
    expect(foreign.body.code).toBe('RESULTS_RATING_INVALID');

    await t.dataSource.getRepository(AcademicSessionEntity).update({ organization_id: s.organization.id }, { status: AcademicSessionStatusEnum.CLOSED });
    const closed = await call('PUT', '/behaviour/grid', s.rinaToken, { offering_id: s.mathOffering, date: '2026-11-12', rows: [{ student_id: s.mitu.id, ratings: { [p.id]: 3 } }] });
    expect([closed.status, closed.body.code]).toEqual([409, 'RESULTS_SESSION_CLOSED']);
    expect((await call<Grid>('GET', `/behaviour/grid?offering_id=${s.mathOffering}&date=2026-11-12`, s.rinaToken)).body.payload.can_edit).toBe(false);

    const off = await school({ performanceOn: false });
    expect((await call('GET', '/behaviour/criteria', off.ownerToken)).body.code).toBe('FEATURE_NOT_IN_PLAN');
  });
});
