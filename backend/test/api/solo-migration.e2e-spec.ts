import { ClassEntity } from '../../src/classes/entities/class.entity';
import { ClassKindEnum } from '../../src/classes/enums/class-kind.enum';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { SoloOrganizations1755200000000 } from '../../src/migrations/1755200000000-SoloOrganizations';
import { OrganizationMemberEntity } from '../../src/organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration M2 (P2-01) on data shaped like beta before the change: personal classes and exams
 * with no organisation. It must create one SOLO organisation per teacher who needs one, move
 * their rows into it, leave school data alone, and change nothing when run a second time.
 */
describe('SoloOrganizations migration', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  const soloOf = async (user: UserEntity) => {
    const rows = await t.dataSource
      .getRepository(OrganizationMemberEntity)
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.organization', 'o')
      .where('m.user_id = :id AND m.role = :owner AND o.kind = :solo', {
        id: user.id,
        owner: OrganizationMemberRoleEnum.OWNER,
        solo: OrganizationKindEnum.SOLO,
      })
      .getMany();
    return rows.map((row) => row.organization);
  };

  it('moves personal data into SOLO organisations, once', async () => {
    // Before: the old personal mode.
    const personal = await make.teacher({ full_name: 'Nadia Rahman' });
    const orgOnlyWithClass = await make.teacher({ personal_teacher_enabled: false });
    const orgOnly = await make.teacher({ personal_teacher_enabled: false });
    const schoolOwner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(schoolOwner);

    const personalClass = await make.classOf(personal, { class_kind: ClassKindEnum.PERSONAL });
    const classExam = await make.openExam(personal, { class_id: personalClass.id });
    const linkExam = await make.openExam(personal);
    const strayClass = await make.classOf(orgOnlyWithClass, { class_kind: ClassKindEnum.PERSONAL });
    const schoolClass = await make.classOf(schoolOwner, { organization_id: school.id, class_kind: ClassKindEnum.ORGANIZATION });
    const schoolExam = await make.openExam(schoolOwner, { organization_id: school.id, class_id: schoolClass.id });

    const runner = t.dataSource.createQueryRunner();
    const migration = new SoloOrganizations1755200000000();
    try {
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }

    const [solo] = await soloOf(personal);
    expect(await soloOf(personal)).toHaveLength(1);
    expect(solo).toMatchObject({ name: 'Nadia Rahman', status: 'approved', kind: OrganizationKindEnum.SOLO });
    expect(await soloOf(orgOnlyWithClass)).toHaveLength(1);
    // Teachers without personal teaching or personal data get none.
    expect(await soloOf(orgOnly)).toHaveLength(0);
    expect(await soloOf(schoolOwner)).toHaveLength(0);

    const classes = t.dataSource.getRepository(ClassEntity);
    const exams = t.dataSource.getRepository(ExamEntity);
    expect((await classes.findOneByOrFail({ id: personalClass.id })).organization_id).toBe(solo.id);
    expect((await exams.findOneByOrFail({ id: classExam.id })).organization_id).toBe(solo.id);
    expect((await exams.findOneByOrFail({ id: linkExam.id })).organization_id).toBe(solo.id);
    expect((await classes.findOneByOrFail({ id: strayClass.id })).organization_id).toBe((await soloOf(orgOnlyWithClass))[0].id);

    // School data is untouched.
    expect((await classes.findOneByOrFail({ id: schoolClass.id })).organization_id).toBe(school.id);
    expect((await exams.findOneByOrFail({ id: schoolExam.id })).organization_id).toBe(school.id);
    expect((await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ id: school.id })).kind).toBe(OrganizationKindEnum.SCHOOL);

    // Count check: nothing is left without an organisation.
    const [{ left }] = await t.dataSource.query(
      `SELECT (SELECT COUNT(*) FROM classes WHERE organization_id IS NULL) + (SELECT COUNT(*) FROM exams WHERE organization_id IS NULL) AS left`,
    );
    expect(Number(left)).toBe(0);
  });
});
