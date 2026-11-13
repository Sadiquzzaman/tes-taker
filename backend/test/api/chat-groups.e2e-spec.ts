import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ChatBroadcaster } from '../../src/chat/chat-broadcaster';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Group = { id: string; offering_id: string; section_label: string; subject: { name: string }; role: string; unread: number; announcement_only: boolean; last_message: { preview: string } | null };
type Message = { id: string; parent_id: string | null; content: string; author: { id: string; name: string; is_teacher: boolean }; comment_count: number; reply_to: { id: string } | null; attachments: { name: string; url: string }[]; pinned: boolean; deleted: boolean };

/**
 * Group chats (P9-01, COM-01, COM-03): one per subject class for its students and teachers, with
 * posts, comment threads, replies, files, announcement mode, pins, unread counts, mute and the
 * socket events. The socket namespace is replaced by a stand-in that records what is sent.
 */
describe('group chat API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  let emitted: { room: string; event: string; payload: Record<string, unknown> }[];

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const groupsOf = async (token: string) => (await call<Group[]>('GET', '/chat/groups', token)).body.payload;

  /**
   * A school with Class 6 A: Math (taught by Rina; everyone takes it) and Religion (taught by
   * Karim; only Picked takes it), and the chat feature on.
   */
  const school = async ({ chatOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    if (chatOn) {
      const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/chat`, { body: { value: true, reason: 'P9-01 test' }, token: t.tokenFor(admin) });
      expect(enabled.status).toBe(200);
    }
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const religion = await subjects.save({ name: 'Religion', code: 'REL', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [math, religion]) await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: subject.id });
    const [picked, other] = [await make.student({ full_name: 'Picked' }), await make.student({ full_name: 'Other' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [picked.email, other.email] });
    const [section] = (await call<{ id: string; session_id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
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
    const s = {
      organization,
      ownerToken,
      rina,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      picked,
      other,
      pickedToken: token(picked, OrganizationMemberRoleEnum.STUDENT),
      otherToken: token(other, OrganizationMemberRoleEnum.STUDENT),
      mathOffering,
      religionOffering,
      sessionId: section.session_id,
    };
    return s;
  };
  const mathGroup = async (s: Awaited<ReturnType<typeof school>>) => (await groupsOf(s.rinaToken)).find((g) => g.offering_id === s.mathOffering)!.id;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    t.app.get(ChatBroadcaster).attach({
      to: (room: string | string[]) => ({ emit: (event: string, payload: Record<string, unknown>) => [room].flat().forEach((r) => emitted.push({ room: r, event, payload })) }),
      in: () => ({ socketsJoin: () => undefined }),
    } as never);
  });

  beforeEach(() => {
    emitted = [];
  });

  afterAll(async () => {
    await t.close();
  });

  it("gives each person the group chats of the subject classes they teach or take; others can't open them", async () => {
    const s = await school();
    const names = (groups: Group[]) => groups.map((g) => `${g.section_label} · ${g.subject.name} (${g.role})`).sort();
    expect(names(await groupsOf(s.rinaToken))).toEqual(['Class 6 A · Math (TEACHER)']);
    expect(names(await groupsOf(s.karimToken))).toEqual(['Class 6 A · Religion (TEACHER)']);
    expect(names(await groupsOf(s.pickedToken))).toEqual(['Class 6 A · Math (STUDENT)', 'Class 6 A · Religion (STUDENT)']);
    expect(names(await groupsOf(s.otherToken))).toEqual(['Class 6 A · Math (STUDENT)']);
    // The owner is not a member (admin access to chats comes with the access log).
    expect(await groupsOf(s.ownerToken)).toEqual([]);

    const religion = (await groupsOf(s.pickedToken)).find((g) => g.offering_id === s.religionOffering)!.id;
    for (const token of [s.otherToken, s.rinaToken, s.ownerToken]) {
      const res = await call(`GET`, `/chat/groups/${religion}/messages`, token);
      expect([res.status, res.body.code]).toEqual([404, 'CHAT_NOT_FOUND']);
    }
    // Asking twice gives the same group.
    expect((await groupsOf(s.karimToken))[0].id).toBe(religion);
  });

  it('posts, comments and replies arrive on the socket, count as unread until read, and show the author', async () => {
    const s = await school();
    const group = await mathGroup(s);
    const post = (await call<Message>('POST', `/chat/groups/${group}/messages`, s.pickedToken, { content: '  Is chapter 3 on the test?  ' })).body.payload;
    expect(post).toMatchObject({ parent_id: null, content: 'Is chapter 3 on the test?', author: { id: s.picked.id, name: 'Picked', is_teacher: false }, comment_count: 0 });
    expect(emitted).toContainEqual({ room: `group:${group}`, event: 'chat:message', payload: expect.objectContaining({ id: post.id }) });

    const answer = await call<Message>('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'Yes, all of it.', parent_id: post.id });
    expect(answer.body.payload).toMatchObject({ parent_id: post.id, author: { name: 'Rina', is_teacher: true } });
    const reply = await call<Message>('POST', `/chat/groups/${group}/messages`, s.otherToken, { content: 'Thanks!', parent_id: post.id, reply_to_id: answer.body.payload.id });
    expect(reply.body.payload.reply_to).toMatchObject({ id: answer.body.payload.id });

    const posts = (await call<Message[]>('GET', `/chat/groups/${group}/messages`, s.otherToken)).body.payload;
    expect(posts.map((p) => [p.content, p.comment_count])).toEqual([['Is chapter 3 on the test?', 2]]);
    const comments = (await call<Message[]>('GET', `/chat/groups/${group}/messages/${post.id}/comments`, s.otherToken)).body.payload;
    expect(comments.map((c) => c.content)).toEqual(['Yes, all of it.', 'Thanks!']);

    // Unread: what others wrote since the person last read (sending counts as reading).
    const unread = async (token: string) => (await groupsOf(token)).find((g) => g.id === group)!.unread;
    expect([await unread(s.pickedToken), await unread(s.rinaToken), await unread(s.otherToken)]).toEqual([2, 1, 0]);
    expect((await call('POST', `/chat/groups/${group}/read`, s.rinaToken)).status).toBe(200);
    expect(await unread(s.rinaToken)).toBe(0);
    expect((await groupsOf(s.otherToken)).find((g) => g.id === group)!.last_message).toMatchObject({ preview: 'Thanks!' });

    // Empty messages and comments on comments are refused.
    expect((await call('POST', `/chat/groups/${group}/messages`, s.otherToken, { content: '   ' })).body.code).toBe('CHAT_EMPTY');
    expect((await call('POST', `/chat/groups/${group}/messages`, s.otherToken, { content: 'x', parent_id: answer.body.payload.id })).body.code).toBe('CHAT_NOT_A_POST');
  });

  it('takes files only from the sender’s own chat uploads', async () => {
    const s = await school();
    const group = await mathGroup(s);
    const upload = (owner: UserEntity, purpose = FilePurposeEnum.DISCUSSION) =>
      t.dataSource.getRepository(FileObjectEntity).save({
        organization_id: s.organization.id,
        owner_id: owner.id,
        purpose,
        s3_key: `org/${s.organization.id}/discussion/${Math.random()}`,
        mime: 'application/pdf',
        original_name: 'notes.pdf',
        size_bytes: 2000,
        original_size_bytes: 2000,
        status: FileStatusEnum.READY,
      } as DeepPartial<FileObjectEntity>);
    const mine = await upload(s.picked);
    const sent = await call<Message>('POST', `/chat/groups/${group}/messages`, s.pickedToken, { file_ids: [mine.id] });
    expect(sent.body.payload.attachments).toEqual([expect.objectContaining({ name: 'notes.pdf', url: `/files/${mine.id}/content` })]);
    for (const file of [await upload(s.other), await upload(s.picked, FilePurposeEnum.HOMEWORK)]) {
      const res = await call('POST', `/chat/groups/${group}/messages`, s.pickedToken, { file_ids: [file.id] });
      expect([res.status, res.body.code]).toEqual([400, 'CHAT_FILE_INVALID']);
    }
  });

  it('announcement mode: only teachers post, everyone comments, and members who did not mute are told', async () => {
    const s = await school();
    const group = await mathGroup(s);
    expect((await call('PATCH', `/chat/groups/${group}`, s.pickedToken, { announcement_only: true })).body.code).toBe('CHAT_NOT_TEACHER');
    expect((await call('PATCH', `/chat/groups/${group}`, s.rinaToken, { announcement_only: true })).status).toBe(200);
    expect(emitted).toContainEqual({ room: `group:${group}`, event: 'chat:group', payload: expect.objectContaining({ announcement_only: true }) });

    const refused = await call('POST', `/chat/groups/${group}/messages`, s.pickedToken, { content: 'Hello?' });
    expect([refused.status, refused.body.code]).toEqual([403, 'CHAT_TEACHERS_ONLY']);
    expect((await call('PUT', `/chat/groups/${group}/mute`, s.otherToken, { muted: true })).status).toBe(200);
    const notice = await call<Message>('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'Test on Sunday, chapters 1 to 3.' });
    expect(notice.status).toBe(201);
    expect((await call('POST', `/chat/groups/${group}/messages`, s.pickedToken, { content: 'Which pages?', parent_id: notice.body.payload.id })).status).toBe(201);

    const told = await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { event_type: 'chat.announcement' } });
    const toThisGroup = told.filter((row) => (row.payload as { path?: string }).path === `/chat?group=${group}`);
    expect(toThisGroup.map((row) => row.recipient_id)).toEqual([s.picked.id]);
    expect(toThisGroup[0].payload).toMatchObject({ group: 'Class 6 A · Math', author: 'Rina', preview: 'Test on Sunday, chapters 1 to 3.' });

    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { entity_id: group, action: 'chat.group_update' } })).toBe(1);
  });

  it("deletes: your own, or a teacher anyone's (audited); teachers pin up to 3 posts", async () => {
    const s = await school();
    const group = await mathGroup(s);
    const send = async (token: string, content: string, parent_id?: string) => (await call<Message>('POST', `/chat/groups/${group}/messages`, token, { content, parent_id })).body.payload;
    const post = await send(s.pickedToken, 'My answer is 42');
    const comment = await send(s.otherToken, 'Mine too', post.id);

    expect((await call('DELETE', `/chat/groups/${group}/messages/${post.id}`, s.otherToken)).body.code).toBe('CHAT_NOT_TEACHER');
    expect((await call('DELETE', `/chat/groups/${group}/messages/${comment.id}`, s.otherToken)).status).toBe(200);
    expect((await call<Message[]>('GET', `/chat/groups/${group}/messages`, s.pickedToken)).body.payload[0].comment_count).toBe(0);
    expect((await call('DELETE', `/chat/groups/${group}/messages/${post.id}`, s.rinaToken)).status).toBe(200);
    const [gone] = (await call<Message[]>('GET', `/chat/groups/${group}/messages`, s.pickedToken)).body.payload;
    expect(gone).toMatchObject({ id: post.id, deleted: true, content: '' });
    expect(emitted).toContainEqual({ room: `group:${group}`, event: 'chat:deleted', payload: { group_id: group, id: post.id, parent_id: null } });
    await t.app.get(AuditService).flush();
    const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { entity_id: group, action: 'chat.message_delete' } });
    expect(logs.map((l) => l.before)).toEqual([expect.objectContaining({ message_id: post.id, author_id: s.picked.id, content: 'My answer is 42' })]);

    const posts: Message[] = [];
    for (const n of [1, 2, 3, 4]) posts.push(await send(s.rinaToken, `Note ${n}`));
    expect((await call('PUT', `/chat/groups/${group}/messages/${posts[0].id}/pin`, s.pickedToken, { pinned: true })).body.code).toBe('CHAT_NOT_TEACHER');
    for (const p of posts) await call('PUT', `/chat/groups/${group}/messages/${p.id}/pin`, s.rinaToken, { pinned: true });
    const detail = await call<{ pinned: Message[] }>('GET', `/chat/groups/${group}`, s.pickedToken);
    expect(detail.body.payload.pinned.map((p) => p.content)).toEqual(['Note 4', 'Note 3', 'Note 2']);
    await call('PUT', `/chat/groups/${group}/messages/${posts[3].id}/pin`, s.rinaToken, { pinned: false });
    expect((await call<{ pinned: Message[] }>('GET', `/chat/groups/${group}`, s.pickedToken)).body.payload.pinned.map((p) => p.content)).toEqual(['Note 3', 'Note 2']);
  });

  it("keeps a closed session's chat read-only, and needs the chat feature", async () => {
    const s = await school();
    const group = await mathGroup(s);
    await call('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'Last class notes' });
    await t.dataSource.query(`UPDATE academic_sessions SET status = 'CLOSED' WHERE id = $1`, [s.sessionId]);
    const refused = await call('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'One more' });
    expect([refused.status, refused.body.code]).toEqual([409, 'CHAT_READ_ONLY']);
    expect((await call<Message[]>('GET', `/chat/groups/${group}/messages`, s.rinaToken)).body.payload.map((m) => m.content)).toEqual(['Last class notes']);

    const off = await school({ chatOn: false });
    expect((await call('GET', '/chat/groups', off.rinaToken)).status).toBe(403);
  });
});
