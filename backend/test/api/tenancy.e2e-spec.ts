import { ClassEntity } from '../../src/classes/entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from '../../src/classes/entities/class-student.entity';
import { ClassKindEnum } from '../../src/classes/enums/class-kind.enum';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type ClassRow = { id: string; organization_id: string | null };

/**
 * One tenancy model (P2-01, design §8.1): a teacher's own workspace is a SOLO organisation, and
 * nobody reaches another organisation's classes, whatever session they use.
 */
describe('tenancy API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  let soloA: UserEntity;
  let soloB: UserEntity;
  let schoolOwner: UserEntity;
  let otherSchoolOwner: UserEntity;
  let school: OrganizationEntity;
  let otherSchool: OrganizationEntity;
  let schoolClass: ClassEntity;
  let classOfA: ClassRow;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, {
      session_mode: 'organization',
      context_type: 'organization',
      organization_id: organization.id,
      member_role: role,
    });

  const soloOrganizationOf = async (user: UserEntity) =>
    t.dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder('o')
      .innerJoin('organization_members', 'm', 'm.organization_id = o.id')
      .where('m.user_id = :id AND m.role = :owner AND o.kind = :solo', {
        id: user.id,
        owner: OrganizationMemberRoleEnum.OWNER,
        solo: OrganizationKindEnum.SOLO,
      })
      .getMany();

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    soloA = await make.teacher();
    soloB = await make.teacher();
    schoolOwner = await make.teacher({ personal_teacher_enabled: false });
    otherSchoolOwner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(schoolOwner);
    otherSchool = await make.organization(otherSchoolOwner);
    schoolClass = await make.classOf(schoolOwner, { organization_id: school.id, class_kind: ClassKindEnum.ORGANIZATION });

    const created = await t.api.post<Payload<ClassRow>>('/classes', { class_name: 'Physics 9' }, t.tokenFor(soloA));
    expect(created.status).toBe(201);
    classOfA = created.body.payload;
  });

  afterAll(async () => {
    await t.close();
  });

  describe('a solo teacher', () => {
    it('gets one SOLO organisation, and their new class is saved in it', async () => {
      const solos = await soloOrganizationOf(soloA);
      expect(solos).toHaveLength(1);
      expect(solos[0]).toMatchObject({ status: 'approved', kind: OrganizationKindEnum.SOLO });
      expect(classOfA.organization_id).toBe(solos[0].id);

      // A second request reuses it.
      await t.api.get('/classes', t.tokenFor(soloA));
      expect(await soloOrganizationOf(soloA)).toHaveLength(1);
    });

    it('sees only their own classes', async () => {
      const mine = await t.api.get<Payload<ClassRow[]>>('/classes', t.tokenFor(soloA));
      expect(mine.body.payload.map((row) => row.id)).toEqual([classOfA.id]);

      const theirs = await t.api.get<Payload<ClassRow[]>>('/classes', t.tokenFor(soloB));
      expect(theirs.status).toBe(200);
      expect(theirs.body.payload).toEqual([]);
    });

    it("cannot open another teacher's class or a school's class", async () => {
      expect((await t.api.get(`/classes/${classOfA.id}`, t.tokenFor(soloB))).status).toBe(403);
      expect((await t.api.get(`/classes/${schoolClass.id}`, t.tokenFor(soloA))).status).toBe(403);
    });
  });

  describe('a school member', () => {
    it('opens their own school class in an organisation session', async () => {
      const response = await t.api.get<Payload<ClassRow>>(`/classes/${schoolClass.id}`, orgSession(schoolOwner, school));
      expect(response.status).toBe(200);
      expect(response.body.payload.id).toBe(schoolClass.id);
    });

    it("cannot open another school's class or a solo teacher's class", async () => {
      const token = orgSession(otherSchoolOwner, otherSchool);
      expect((await t.api.get(`/classes/${schoolClass.id}`, token)).status).toBe(403);
      expect((await t.api.get(`/classes/${classOfA.id}`, token)).status).toBe(403);
    });

    it('cannot claim a school they do not belong to', async () => {
      const response = await t.api.get('/classes', orgSession(otherSchoolOwner, school));
      expect(response.status).toBe(403);
    });
  });

  describe('a student', () => {
    it("in a solo teacher's workspace sees only that teacher's classes", async () => {
      const student = await make.student();
      const join = (classId: string) =>
        t.dataSource.getRepository(ClassStudentEntity).save({
          class_id: classId,
          student_id: student.id,
          status: ClassStudentStatusEnum.JOINED,
          joined_at: new Date(),
        });
      await join(classOfA.id);
      await join(schoolClass.id);

      const token = t.tokenFor(student, { context_type: 'individual_teacher', teacher_id: soloA.id });
      const classes = await t.api.get<Payload<Array<{ id: string }>>>('/student/classes', token);
      expect(classes.status).toBe(200);
      expect(classes.body.payload.map((row) => row.id)).toEqual([classOfA.id]);

      // The workspace list offers the solo teacher, never their SOLO organisation as an organisation.
      const contexts = await t.api.get<Payload<Array<{ type: string; teacher_id?: string; organization_id?: string }>>>(
        '/auth/contexts',
        t.tokenFor(student),
      );
      expect(contexts.body.payload).toContainEqual(expect.objectContaining({ type: 'individual_teacher', teacher_id: soloA.id }));
    });
  });

  describe('SOLO organisations stay out of organisation lists', () => {
    it("are not in the teacher's workspace list as organisations", async () => {
      const contexts = await t.api.get<Payload<Array<{ type: string; organization_id?: string }>>>('/auth/contexts', t.tokenFor(soloA));
      const [solo] = await soloOrganizationOf(soloA);
      expect(contexts.body.payload).toContainEqual(expect.objectContaining({ type: 'personal_teacher' }));
      expect(contexts.body.payload.some((context) => context.organization_id === solo.id)).toBe(false);

      const mine = await t.api.get<Payload<Array<{ id: string }>>>('/organizations/mine', t.tokenFor(soloA));
      expect(mine.body.payload.some((org) => org.id === solo.id)).toBe(false);
    });

    it("are not in the platform admin's organisation review list", async () => {
      const admin = await make.user(RolesEnum.SUPER_ADMIN);
      const list = await t.api.get<Payload<Array<{ id: string }>>>('/organizations/admin', t.tokenFor(admin));
      expect(list.status).toBe(200);
      const ids = list.body.payload.map((org) => org.id);
      expect(ids).toEqual(expect.arrayContaining([school.id, otherSchool.id]));
      const [solo] = await soloOrganizationOf(soloA);
      expect(ids).not.toContain(solo.id);
    });

    it('are listed for the platform admin when asked for with kind=SOLO', async () => {
      const admin = await make.user(RolesEnum.SUPER_ADMIN);
      const list = await t.api.get<Payload<Array<{ id: string; kind: string; owner: { id: string } | null }>>>(
        '/organizations/admin?kind=SOLO&limit=50',
        t.tokenFor(admin),
      );
      expect(list.status).toBe(200);
      const [solo] = await soloOrganizationOf(soloA);
      expect(list.body.payload).toContainEqual(expect.objectContaining({ id: solo.id, kind: 'SOLO', owner: expect.objectContaining({ id: soloA.id }) }));
      expect(list.body.payload.every((org) => org.kind === 'SOLO')).toBe(true);
    });
  });
});
