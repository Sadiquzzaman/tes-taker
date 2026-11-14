import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ChatBroadcaster } from '../../src/chat/chat-broadcaster';
import { ChatAccessLogEntity } from '../../src/chat/entities/chat-access-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Group = { id: string; offering_id: string; read_only: boolean };
type AdminChat = { type: string; id: string; label: string; closed: boolean };
type Message = { id: string; content: string; deleted: boolean };
type Report = { id: string; chat_label: string; reporter: { name: string }; reason: string; context: { content: string; reported: boolean }[]; status: string; resolution: string | null };

/**
 * Supervising chats (P9-02, COM-04, COM-05): owners and admins see every chat by name, open one
 * only with a reason (logged; the owner reads the log), then delete messages, mute a person and
 * close the chat (audited); members report messages, which reach the queue with their context.
 */
describe('chat moderation API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

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
    const principal = await make.teacher({ full_name: 'Principal' });
    await make.member(organization, principal, OrganizationMemberRoleEnum.ADMIN);
    const s = {
      organization,
      ownerToken,
      owner,
      principal,
      karim,
      adminToken: token(principal, OrganizationMemberRoleEnum.ADMIN),
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
  const mathGroup = async (s: Awaited<ReturnType<typeof school>>) => (await call<Group[]>('GET', '/chat/groups', s.rinaToken)).body.payload.find((g) => g.offering_id === s.mathOffering)!.id;
  const post = async (token: string, group: string, content: string) => (await call<Message>('POST', `/chat/groups/${group}/messages`, token, { content })).body.payload;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    t.app.get(ChatBroadcaster).attach({ to: () => ({ emit: () => undefined }), in: () => ({ socketsJoin: () => undefined }) } as never);
  });

  afterAll(async () => {
    await t.close();
  });

  it('lists chats by name for owners and admins, opens one only with a reason, and logs it for the owner', async () => {
    const s = await school();
    const group = await mathGroup(s);
    await post(s.pickedToken, group, 'Hello class');
    const direct = (await call<{ id: string }>('POST', '/chat/direct', s.pickedToken, { user_id: s.rina.id })).body.payload.id;

    const refused = await call('GET', '/chat/admin/chats', s.rinaToken);
    expect([refused.status, refused.body.code]).toEqual([403, 'CHAT_NOT_ADMIN']);
    const chats = (await call<AdminChat[]>('GET', '/chat/admin/chats', s.adminToken)).body.payload;
    // Groups exist once a member has listed their chats (only Rina has: Math).
    expect(chats.map((c) => [c.type, c.label]).sort()).toEqual([
      ['DIRECT', 'Rina ↔ Picked'],
      ['GROUP', 'Class 6 A · Math'],
    ]);

    const unopened = await call('GET', `/chat/admin/chats/GROUP/${group}/messages`, s.adminToken);
    expect([unopened.status, unopened.body.code]).toEqual([403, 'CHAT_REASON_REQUIRED']);
    expect((await call('POST', `/chat/admin/chats/GROUP/${group}/open`, s.adminToken, { reason: ' ' })).status).toBe(400);
    const opened = await call<{ chat: AdminChat; messages: Message[] }>('POST', `/chat/admin/chats/GROUP/${group}/open`, s.adminToken, { reason: 'A parent complained' });
    expect(opened.body.payload.chat).toMatchObject({ type: 'GROUP', label: 'Class 6 A · Math', closed: false });
    expect(opened.body.payload.messages.map((m) => m.content)).toEqual(['Hello class']);
    expect((await call('GET', `/chat/admin/chats/GROUP/${group}/messages`, s.adminToken)).status).toBe(200);
    // Opening one chat does not open another.
    expect((await call('GET', `/chat/admin/chats/DIRECT/${direct}/messages`, s.adminToken)).body.code).toBe('CHAT_REASON_REQUIRED');

    expect((await call('GET', '/chat/admin/access-log', s.adminToken)).status).toBe(403);
    const log = await call<{ actor: { name: string }; chat_label: string; reason: string }[]>('GET', '/chat/admin/access-log', s.ownerToken);
    expect(log.body.payload).toEqual([expect.objectContaining({ actor: expect.objectContaining({ name: 'Principal' }), chat_label: 'Class 6 A · Math', reason: 'A parent complained' })]);
    expect(await t.dataSource.getRepository(ChatAccessLogEntity).count({ where: { organization_id: s.organization.id } })).toBe(1);
    // Other schools' chats are not found.
    const other = await school();
    expect((await call('POST', `/chat/admin/chats/GROUP/${group}/open`, other.ownerToken, { reason: 'x' })).status).toBe(404);
  });

  it('deletes a message, mutes a person for a while and closes the chat, all audited', async () => {
    const s = await school();
    const group = await mathGroup(s);
    const rude = await post(s.pickedToken, group, 'Something rude');
    await call('POST', `/chat/admin/chats/GROUP/${group}/open`, s.ownerToken, { reason: 'Rude messages reported in class' });

    expect((await call('DELETE', `/chat/admin/chats/GROUP/${group}/messages/${rude.id}`, s.ownerToken)).status).toBe(200);
    expect((await call<Message[]>('GET', `/chat/groups/${group}/messages`, s.otherToken)).body.payload[0]).toMatchObject({ id: rude.id, deleted: true, content: '' });

    const muted = await call<{ until: string }>('POST', `/chat/admin/chats/GROUP/${group}/mutes`, s.ownerToken, { user_id: s.picked.id, hours: 24, reason: 'Rude' });
    expect(muted.status).toBe(201);
    const blocked = await call('POST', `/chat/groups/${group}/messages`, s.pickedToken, { content: 'Sorry' });
    expect([blocked.status, blocked.body.code]).toEqual([403, 'CHAT_MUTED']);
    expect((await call('POST', `/chat/groups/${group}/messages`, s.otherToken, { content: 'Fine for me' })).status).toBe(201);
    // Only members of the chat can be muted in it.
    expect((await call('POST', `/chat/admin/chats/GROUP/${group}/mutes`, s.ownerToken, { user_id: s.karim.id, hours: 1 })).status).toBe(404);

    expect((await call('PUT', `/chat/admin/chats/GROUP/${group}/closed`, s.ownerToken, { closed: true })).status).toBe(200);
    const closed = await call('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'Notes' });
    expect([closed.status, closed.body.code]).toEqual([409, 'CHAT_CLOSED']);
    expect((await call<Group[]>('GET', '/chat/groups', s.rinaToken)).body.payload.find((g) => g.id === group)!.read_only).toBe(true);
    await call('PUT', `/chat/admin/chats/GROUP/${group}/closed`, s.ownerToken, { closed: false });
    expect((await call('POST', `/chat/groups/${group}/messages`, s.rinaToken, { content: 'Notes' })).status).toBe(201);

    await t.app.get(AuditService).flush();
    const actions = (await t.dataSource.getRepository(AuditLogEntity).find({ where: { entity_id: group } })).map((a) => a.action).sort();
    expect(actions).toEqual(['chat.admin_delete', 'chat.close', 'chat.close', 'chat.user_mute']);
  });

  it('takes a report with the messages around it, tells owners and admins, and resolves it', async () => {
    const s = await school();
    const group = await mathGroup(s);
    for (const n of [1, 2, 3, 4, 5, 6]) await post(s.otherToken, group, `Before ${n}`);
    const bad = await post(s.pickedToken, group, 'Calling names');
    for (const n of [1, 2]) await post(s.otherToken, group, `After ${n}`);

    const report = { chat_type: 'GROUP', chat_id: group, message_id: bad.id, reason: 'Calling a classmate names' };
    expect((await call('POST', '/chat/reports', s.karimToken, report)).status).toBe(404);
    expect((await call('POST', '/chat/reports', s.otherToken, report)).status).toBe(201);
    expect((await call('POST', '/chat/reports', s.otherToken, report)).body.code).toBe('CHAT_ALREADY_REPORTED');
    expect((await call('POST', '/chat/reports', s.rinaToken, { ...report, reason: 'Agree' })).status).toBe(201);

    const told = await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { event_type: 'chat.message_reported' } });
    const recipients = new Set(told.filter((r) => (r.payload as { reason?: string }).reason === 'Calling a classmate names').map((r) => r.recipient_id));
    expect(recipients).toEqual(new Set([s.owner.id, s.principal.id]));

    const queue = (await call<Report[]>('GET', '/chat/admin/reports', s.adminToken)).body.payload;
    const mine = queue.find((r) => r.reporter.name === 'Other')!;
    expect(mine).toMatchObject({ chat_label: 'Class 6 A · Math', reason: 'Calling a classmate names', status: 'OPEN' });
    expect(mine.context.map((m) => [m.content, m.reported])).toEqual([
      ['Before 2', false], ['Before 3', false], ['Before 4', false], ['Before 5', false], ['Before 6', false],
      ['Calling names', true],
      ['After 1', false], ['After 2', false],
    ]);
    expect((await call('GET', '/chat/admin/reports', s.rinaToken)).status).toBe(403);

    expect((await call('POST', `/chat/admin/reports/${mine.id}/resolve`, s.adminToken, { resolution: 'DELETED' })).status).toBe(200);
    expect((await call<Message[]>('GET', `/chat/groups/${group}/messages?limit=100`, s.otherToken)).body.payload.find((m) => m.id === bad.id)).toMatchObject({ deleted: true });
    // Both reports of the message are resolved.
    expect((await call<Report[]>('GET', '/chat/admin/reports', s.adminToken)).body.payload).toEqual([]);
    const resolved = (await call<Report[]>('GET', '/chat/admin/reports?status=RESOLVED', s.adminToken)).body.payload;
    expect(resolved.map((r) => r.resolution)).toEqual(['DELETED', 'DELETED']);
  });

  it('works for private chats too: report, open, close', async () => {
    const s = await school();
    const direct = (await call<{ id: string }>('POST', '/chat/direct', s.rinaToken, { user_id: s.picked.id })).body.payload.id;
    const msg = (await call<Message>('POST', `/chat/direct/${direct}/messages`, s.rinaToken, { content: 'Meet me after class' })).body.payload;
    expect((await call('POST', '/chat/reports', s.pickedToken, { chat_type: 'DIRECT', chat_id: direct, message_id: msg.id, reason: 'Uncomfortable' })).status).toBe(201);
    expect((await call('POST', '/chat/reports', s.otherToken, { chat_type: 'DIRECT', chat_id: direct, message_id: msg.id, reason: 'x' })).status).toBe(404);
    await call('POST', `/chat/admin/chats/DIRECT/${direct}/open`, s.ownerToken, { reason: 'Student report' });
    expect((await call('PUT', `/chat/admin/chats/DIRECT/${direct}/closed`, s.ownerToken, { closed: true })).status).toBe(200);
    expect((await call('POST', `/chat/direct/${direct}/messages`, s.rinaToken, { content: 'Hello?' })).body.code).toBe('CHAT_CLOSED');
    expect((await call<{ closed: boolean }[]>('GET', '/chat/direct', s.pickedToken)).body.payload[0].closed).toBe(true);
  });
});
