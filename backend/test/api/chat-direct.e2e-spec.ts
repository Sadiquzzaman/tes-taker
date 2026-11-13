import { DeepPartial } from 'typeorm';
import { ChatBroadcaster } from '../../src/chat/chat-broadcaster';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Contact = { id: string; name: string; via: string[] };
type Chat = { id: string; other: { id: string; name: string; is_teacher: boolean }; unread: number; other_read_at: string | null; last_message: { preview: string } | null };
type Message = { id: string; content: string; author: { id: string; is_teacher: boolean }; reply_to: { id: string } | null; deleted: boolean };

/**
 * Private teacher–student chats (P9-02, COM-02, COM-03): a student messages only teachers who
 * teach them, a teacher only their students; unread counts, read receipts, deleting your own
 * message, and one inbox notice per chat every 10 minutes (none when muted).
 */
describe('private chat API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  let emitted: { room: string; event: string; payload: Record<string, unknown> }[];

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
  const start = (token: string, userId: string) => call<Chat>('POST', '/chat/direct', token, { user_id: userId });
  const send = async (token: string, chatId: string, content: string, extra: Record<string, unknown> = {}) =>
    (await call<Message>('POST', `/chat/direct/${chatId}/messages`, token, { content, ...extra })).body.payload;
  const listOf = async (token: string) => (await call<Chat[]>('GET', '/chat/direct', token)).body.payload;
  const notices = (userId: string) => t.dataSource.getRepository(NotificationOutboxEntity).count({ where: { event_type: 'chat.direct_message', recipient_id: userId } });

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

  it('offers a student their teachers and a teacher their students, and refuses anyone else', async () => {
    const s = await school();
    const names = async (token: string) => (await call<Contact[]>('GET', '/chat/direct/contacts', token)).body.payload.map((c) => `${c.name}: ${c.via.join(', ')}`);
    expect(await names(s.pickedToken)).toEqual(['Karim: Class 6 A · Religion', 'Rina: Class 6 A · Math']);
    expect(await names(s.otherToken)).toEqual(['Rina: Class 6 A · Math']);
    expect(await names(s.rinaToken)).toEqual(['Other: Class 6 A · Math', 'Picked: Class 6 A · Math']);

    const karimId = (await call<Contact[]>('GET', '/chat/direct/contacts', s.pickedToken)).body.payload.find((c) => c.name === 'Karim')!.id;
    for (const [token, id] of [[s.otherToken, karimId], [s.karimToken, s.other.id], [s.pickedToken, s.other.id]] as const) {
      const refused = await start(token, id);
      expect([refused.status, refused.body.code]).toEqual([403, 'CHAT_NOT_ALLOWED']);
    }
    // One chat per pair, whoever starts it.
    const byStudent = (await start(s.pickedToken, s.rina.id)).body.payload;
    const byTeacher = (await start(s.rinaToken, s.picked.id)).body.payload;
    expect(byTeacher.id).toBe(byStudent.id);
    expect(byStudent.other).toEqual({ id: s.rina.id, name: 'Rina', is_teacher: true });
    expect(byTeacher.other).toEqual({ id: s.picked.id, name: 'Picked', is_teacher: false });
  });

  it('sends live with unread counts and read receipts; only the two people see it; one notice per 10 minutes', async () => {
    const s = await school();
    const chat = (await start(s.pickedToken, s.rina.id)).body.payload;
    const first = await send(s.pickedToken, chat.id, 'Can I submit tomorrow?');
    await send(s.pickedToken, chat.id, 'I was sick today.');
    expect(emitted).toContainEqual({ room: `direct:${chat.id}`, event: 'chat:message', payload: expect.objectContaining({ id: first.id }) });
    expect((await listOf(s.rinaToken))[0]).toMatchObject({ id: chat.id, unread: 2, last_message: { preview: 'I was sick today.' } });
    expect(await notices(s.rina.id)).toBe(1);

    expect((await listOf(s.pickedToken))[0].other_read_at).toBeNull();
    expect((await call('POST', `/chat/direct/${chat.id}/read`, s.rinaToken)).status).toBe(200);
    expect(emitted).toContainEqual({ room: `direct:${chat.id}`, event: 'chat:read', payload: expect.objectContaining({ chat_id: chat.id, user_id: s.rina.id }) });
    expect((await listOf(s.pickedToken))[0].other_read_at).not.toBeNull();
    expect((await listOf(s.rinaToken))[0].unread).toBe(0);

    const answer = await send(s.rinaToken, chat.id, 'Yes, by Thursday.', { reply_to_id: first.id });
    expect(answer).toMatchObject({ author: { id: s.rina.id, is_teacher: true }, reply_to: { id: first.id } });
    const history = (await call<Message[]>('GET', `/chat/direct/${chat.id}/messages`, s.pickedToken)).body.payload;
    expect(history.map((m) => m.content)).toEqual(['Yes, by Thursday.', 'I was sick today.', 'Can I submit tomorrow?']);

    for (const token of [s.otherToken, s.karimToken, s.ownerToken]) {
      expect((await call('GET', `/chat/direct/${chat.id}/messages`, token)).status).toBe(404);
    }
    expect((await call('DELETE', `/chat/direct/${chat.id}/messages/${first.id}`, s.rinaToken)).body.code).toBe('CHAT_NOT_AUTHOR');
    expect((await call('DELETE', `/chat/direct/${chat.id}/messages/${first.id}`, s.pickedToken)).status).toBe(200);
    expect((await call<Message[]>('GET', `/chat/direct/${chat.id}/messages`, s.rinaToken)).body.payload[2]).toMatchObject({ id: first.id, deleted: true, content: '' });
  });

  it('sends no notice to someone who muted the chat', async () => {
    const s = await school();
    const chat = (await start(s.rinaToken, s.other.id)).body.payload;
    expect((await call('PUT', `/chat/direct/${chat.id}/mute`, s.otherToken, { muted: true })).status).toBe(200);
    await send(s.rinaToken, chat.id, 'Please bring your notebook.');
    expect(await notices(s.other.id)).toBe(0);
    expect((await listOf(s.otherToken))[0].unread).toBe(1);
  });
});
