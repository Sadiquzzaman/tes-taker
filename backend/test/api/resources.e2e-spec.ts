import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Resource = {
  id: string;
  type: string;
  title: string;
  url: string;
  download_allowed: boolean;
  archived: boolean;
  folder_id: string | null;
  shares: { offering_id: string; label: string }[];
  can_edit?: boolean;
  is_new?: boolean;
  file: { name: string } | null;
};
type Insights = { students: number; opened: { full_name: string; opens: number }[]; not_opened: { full_name: string }[] };

/**
 * The resource library (P9-03, RES-01, RES-03 to RES-06): staff add files and links and share them
 * with subject classes they teach; students see what is shared with them, "New" until opened;
 * archive and delete hide it from students; whoever added it sees who opened it.
 */
describe('resource library API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  const school = async ({ resourcesOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    if (resourcesOn) {
      const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/resources`, {
        body: { value: true, reason: 'P9-03 test' },
        token: t.tokenFor(admin),
      });
      expect(enabled.status).toBe(200);
    }
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const religion = await subjects.save({ name: 'Religion', code: 'REL', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [math, religion]) await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: subject.id });
    const [picked, other] = [await make.student({ full_name: 'Picked' }), await make.student({ full_name: 'Other' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [picked.email, other.email] });
    const [section] = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const offerings = (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${section.id}/offerings`, ownerToken)).body.payload;
    const mathOffering = offerings.find((o) => o.subject.id === math.id)!.id;
    const religionOffering = offerings.find((o) => o.subject.id === religion.id)!.id;
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathOffering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    await call('PUT', `/offerings/${religionOffering}/teachers`, ownerToken, { teacher_ids: [karim.id] });
    await call('PATCH', `/offerings/${religionOffering}`, ownerToken, { enrolment_mode: 'SELECTED' });
    await call('PUT', `/offerings/${religionOffering}/students`, ownerToken, { student_ids: [picked.id] });
    return {
      organization,
      owner,
      ownerToken,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      rina,
      picked,
      other,
      pickedToken: token(picked, OrganizationMemberRoleEnum.STUDENT),
      otherToken: token(other, OrganizationMemberRoleEnum.STUDENT),
      mathOffering,
      religionOffering,
      sectionId: section.id,
    };
  };

  const link = (s: Awaited<ReturnType<typeof school>>, extra: Record<string, unknown> = {}) => ({
    type: 'LINK',
    title: 'Algebra video',
    url: 'https://www.youtube.com/watch?v=abc',
    offering_ids: [s.mathOffering],
    ...extra,
  });
  const titles = (rows: Resource[]) => rows.map((r) => r.title).sort();

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds links and files shared with subject classes the teacher teaches', async () => {
    const s = await school();
    const created = await call<Resource>('POST', '/resources', s.rinaToken, link(s, { tags: [' video ', 'video', 'ch4'] }));
    expect(created.status).toBe(201);
    expect(created.body.payload).toMatchObject({ type: 'LINK', url: 'https://www.youtube.com/watch?v=abc', download_allowed: true, shares: [{ offering_id: s.mathOffering, label: 'Class 6 A · Math' }] });

    const upload = await t.dataSource.getRepository(FileObjectEntity).save({
      organization_id: s.organization.id,
      owner_id: s.rina.id,
      purpose: FilePurposeEnum.RESOURCE,
      s3_key: `org/${s.organization.id}/resources/${Math.random()}`,
      mime: 'application/pdf',
      original_name: 'notes.pdf',
      size_bytes: 3000,
      original_size_bytes: 3000,
      status: FileStatusEnum.READY,
    } as DeepPartial<FileObjectEntity>);
    const file = await call<Resource>('POST', '/resources', s.rinaToken, { type: 'FILE', title: 'Chapter 4 notes', file_id: upload.id, download_allowed: false, offering_ids: [s.mathOffering] });
    expect(file.body.payload).toMatchObject({ url: `/files/${upload.id}/content`, file: { name: 'notes.pdf' }, download_allowed: false });

    // Rina does not teach Religion; links must be web addresses; files must be her own resource uploads.
    expect((await call('POST', '/resources', s.rinaToken, link(s, { offering_ids: [s.religionOffering] }))).body.code).toBe('RESOURCE_SHARE_NOT_ALLOWED');
    expect((await call('POST', '/resources', s.rinaToken, link(s, { url: 'javascript:alert(1)' }))).body.code).toBe('RESOURCE_URL_INVALID');
    expect((await call('POST', '/resources', s.karimToken, { type: 'FILE', title: 'x', file_id: upload.id })).body.code).toBe('RESOURCE_FILE_INVALID');
    expect((await call('POST', '/resources', s.pickedToken, link(s))).body.code).toBe('RESOURCE_STAFF_ONLY');
    // The owner shares with any open subject class.
    expect((await call('POST', '/resources', s.ownerToken, link(s, { title: 'Religion reading', offering_ids: [s.religionOffering] }))).status).toBe(201);

    const choices = (await call<{ offering_id: string }[]>('GET', '/resources/subject-classes', s.rinaToken)).body.payload;
    expect(choices.map((c) => c.offering_id)).toEqual([s.mathOffering]);
  });

  it('shows students what is shared with them, New until opened; archived and deleted ones are hidden', async () => {
    const s = await school();
    const math = (await call<Resource>('POST', '/resources', s.rinaToken, link(s))).body.payload;
    const religion = (await call<Resource>('POST', '/resources', s.ownerToken, link(s, { title: 'Religion reading', offering_ids: [s.religionOffering] }))).body.payload;
    await call('POST', '/resources', s.rinaToken, link(s, { title: 'Not shared', offering_ids: [] }));

    expect(titles((await call<Resource[]>('GET', '/resources/mine', s.pickedToken)).body.payload)).toEqual(['Algebra video', 'Religion reading']);
    const otherList = (await call<Resource[]>('GET', '/resources/mine', s.otherToken)).body.payload;
    expect(otherList.map((r) => [r.title, r.is_new])).toEqual([['Algebra video', true]]);

    expect((await call('POST', `/resources/${religion.id}/open`, s.otherToken)).status).toBe(404);
    const opened = await call<Resource>('POST', `/resources/${math.id}/open`, s.otherToken);
    expect([opened.status, opened.body.payload.url]).toEqual([200, 'https://www.youtube.com/watch?v=abc']);
    await call('POST', `/resources/${math.id}/open`, s.otherToken);
    expect((await call<Resource[]>('GET', '/resources/mine', s.otherToken)).body.payload[0].is_new).toBe(false);
    expect(titles((await call<Resource[]>('GET', '/resources/mine?q=algeb', s.pickedToken)).body.payload)).toEqual(['Algebra video']);

    const insights = (await call<Insights>('GET', `/resources/${math.id}/insights`, s.rinaToken)).body.payload;
    expect(insights).toMatchObject({ students: 2, opened: [{ full_name: 'Other', opens: 2 }], not_opened: [{ full_name: 'Picked' }] });

    expect((await call('PATCH', `/resources/${math.id}`, s.rinaToken, { archived: true })).status).toBe(200);
    expect(titles((await call<Resource[]>('GET', '/resources/mine', s.pickedToken)).body.payload)).toEqual(['Religion reading']);
    expect(titles((await call<Resource[]>('GET', '/resources?archived=true', s.rinaToken)).body.payload)).toEqual(['Algebra video']);
    expect((await call('DELETE', `/resources/${religion.id}`, s.ownerToken)).status).toBe(200);
    expect((await call<Resource[]>('GET', '/resources/mine', s.pickedToken)).body.payload).toEqual([]);
  });

  it('lets only whoever added it (or owners, admins, staff) change it; teachers see what is shared with their classes', async () => {
    const s = await school();
    const mine = (await call<Resource>('POST', '/resources', s.rinaToken, link(s))).body.payload;
    await call('POST', '/resources', s.ownerToken, link(s, { title: 'Religion reading', offering_ids: [s.religionOffering] }));
    await call('POST', '/resources', s.ownerToken, link(s, { title: 'For Math too' }));

    expect(titles((await call<Resource[]>('GET', '/resources', s.rinaToken)).body.payload)).toEqual(['Algebra video', 'For Math too']);
    expect(titles((await call<Resource[]>('GET', '/resources', s.karimToken)).body.payload)).toEqual(['Religion reading']);
    expect(titles((await call<Resource[]>('GET', '/resources', s.ownerToken)).body.payload)).toEqual(['Algebra video', 'For Math too', 'Religion reading']);
    const rinaView = (await call<Resource[]>('GET', '/resources', s.rinaToken)).body.payload;
    expect(rinaView.map((r) => [r.title, r.can_edit]).sort()).toEqual([['Algebra video', true], ['For Math too', false]]);

    expect((await call('PATCH', `/resources/${mine.id}`, s.karimToken, { title: 'Mine now' })).body.code).toBe('RESOURCE_NOT_YOURS');
    expect((await call('GET', `/resources/${mine.id}/insights`, s.karimToken)).body.code).toBe('RESOURCE_NOT_YOURS');
    expect((await call<Resource>('PATCH', `/resources/${mine.id}`, s.ownerToken, { title: 'Algebra video 2' })).body.payload.title).toBe('Algebra video 2');
  });

  it('keeps a teacher’s own folders; deleting one moves its resources out', async () => {
    const s = await school();
    const folder = (await call<{ id: string; name: string }>('POST', '/resources/folders', s.rinaToken, { name: ' Chapter 4 ' })).body.payload;
    expect(folder.name).toBe('Chapter 4');
    const inFolder = (await call<Resource>('POST', '/resources', s.rinaToken, link(s, { folder_id: folder.id }))).body.payload;
    await call('POST', '/resources', s.rinaToken, link(s, { title: 'Loose' }));
    expect(titles((await call<Resource[]>('GET', `/resources?folder_id=${folder.id}`, s.rinaToken)).body.payload)).toEqual(['Algebra video']);
    expect(titles((await call<Resource[]>('GET', '/resources?folder_id=none', s.rinaToken)).body.payload)).toEqual(['Loose']);
    // Someone else's folder is not found.
    expect((await call('POST', '/resources', s.karimToken, { ...link(s, { offering_ids: [] }), folder_id: folder.id })).body.code).toBe('RESOURCE_FOLDER_NOT_FOUND');
    expect((await call('PATCH', `/resources/folders/${folder.id}`, s.rinaToken, { name: 'Ch. 4' })).status).toBe(200);
    expect((await call<{ name: string }[]>('GET', '/resources/folders', s.rinaToken)).body.payload.map((f) => f.name)).toEqual(['Ch. 4']);
    expect((await call('DELETE', `/resources/folders/${folder.id}`, s.rinaToken)).status).toBe(200);
    expect((await call<{ name: string }[]>('GET', '/resources/folders', s.rinaToken)).body.payload).toEqual([]);
    const moved = (await call<Resource[]>('GET', '/resources', s.rinaToken)).body.payload.find((r) => r.id === inFolder.id)!;
    expect(moved.folder_id).toBeNull();
  });

  it('needs the resources feature', async () => {
    const s = await school({ resourcesOn: false });
    expect((await call('GET', '/resources', s.rinaToken)).status).toBe(403);
  });
});
