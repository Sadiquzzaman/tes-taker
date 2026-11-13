import type { Server, Socket } from 'socket.io';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { ProctoringEventEntity } from '../../src/exams/entities/proctoring-event.entity';
import { StudentExamSubmissionEntity } from '../../src/exams/entities/student-exam-answer.entity';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { ProctoringGateway } from '../../src/proctoring/proctoring.gateway';
import { LOST_AFTER_MS, ProctoringStoreService } from '../../src/proctoring/proctoring-store.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Emitted = { room: string; event: string; payload: Record<string, unknown> };

/**
 * Live proctoring state (P8-02, PRO-07): sessions kept in Redis, flags stored as rows once (live
 * and again with the submit), and "Monitoring lost" after 60 seconds without a signal. The
 * gateway's handlers are called with stand-in sockets (no socket client in the test tools).
 */
describe('live proctoring state', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let gateway: ProctoringGateway;
  let realServer: Server;
  let emitted: Emitted[];

  const socket = (token: string, id = `socket-${Math.random().toString(36).slice(2)}`) =>
    ({ id, handshake: { auth: { token }, headers: {} }, data: {}, join: jest.fn(async () => undefined), emit: jest.fn() }) as unknown as Socket & { emit: jest.Mock };
  const toMonitors = (event: string, examId: string) => emitted.filter((e) => e.room === `exam:${examId}:monitors` && e.event === event).map((e) => e.payload);
  const eventsOf = (examId: string, student: UserEntity) =>
    t.dataSource.getRepository(ProctoringEventEntity).find({ where: { exam_id: examId, student_id: student.id }, order: { occurred_at: 'ASC', created_at: 'ASC' } });

  /** A teacher's open exam and a student who joined it live. */
  const exam = async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    const row = await make.openExam(teacher, { organization_id: solo.id });
    const student = await make.student();
    const studentSocket = socket(t.tokenFor(student));
    await gateway.handleJoin(studentSocket, { examId: row.id });
    return { teacher, exam: row, student, studentSocket };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    gateway = t.app.get(ProctoringGateway);
    realServer = gateway.server;
  });

  beforeEach(() => {
    emitted = [];
    gateway.server = { to: (room: string) => ({ emit: (event: string, payload: Record<string, unknown>) => emitted.push({ room, event, payload }) }) } as unknown as Server;
  });

  afterAll(async () => {
    gateway.server = realServer;
    await t.close();
  });

  it('keeps a student’s session in Redis, shows it to the teacher, and stores each flag once', async () => {
    const s = await exam();
    expect(s.studentSocket.emit).toHaveBeenCalledWith('session:ready', expect.objectContaining({ studentId: s.student.id, status: 'WRITING' }));
    expect(toMonitors('session:joined', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, liveStatus: 'WRITING' })]);

    await gateway.handleFlagReport(s.studentSocket, { examId: s.exam.id, id: 'flag-1', kind: 'tab-switch', type: 'TAB_SWITCH', message: 'Left the tab', points: 1 });
    expect(toMonitors('flag:update', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, flagCount: 1, totalFlagPoints: 1 })]);
    // A socket that did not join this exam cannot report flags for anyone.
    await gateway.handleFlagReport(socket(t.tokenFor(s.student)), { examId: s.exam.id, type: 'tab-switch', message: 'x', points: 1 });

    // The teacher sees the state over REST too (and so after a restart: it is in Redis).
    const sessions = await t.api.get<{ payload: { sessions: { studentId: string; liveStatus: string; flagCount: number }[] } }>(
      `/exams/${s.exam.id}/proctoring/sessions`,
      t.tokenFor(s.teacher),
    );
    expect(sessions.body.payload.sessions).toEqual([expect.objectContaining({ studentId: s.student.id, liveStatus: 'WRITING', flagCount: 1 })]);
    const monitor = socket(t.tokenFor(s.teacher));
    await gateway.handleJoin(monitor, { examId: s.exam.id, role: 'monitor' });
    expect(monitor.emit).toHaveBeenCalledWith('monitor:state', { sessions: [expect.objectContaining({ studentId: s.student.id, flagCount: 1 })] });

    // The final submit sends every flag again, plus one the live channel missed: each is stored once.
    expect((await t.api.post(`/student/exams/${s.exam.id}/start`, {}, t.tokenFor(s.student))).status).toBe(201);
    await t.api.post(
      `/student/exams/${s.exam.id}/answersheet`,
      {
        answersheet: {},
        reason: 'manual',
        proctoring_events: [
          { id: 'flag-1', type: 'tab-switch', message: 'Left the tab', points: 1, timestamp: new Date().toISOString() },
          { id: 'flag-2', type: 'phone-detected', message: 'Phone', points: 3, timestamp: new Date().toISOString() },
        ],
      },
      t.tokenFor(s.student),
    );
    expect((await eventsOf(s.exam.id, s.student)).map((e) => [e.client_id, e.source, e.check_key])).toEqual([
      ['flag-1', 'LIVE', 'proctoring_tab_switch'],
      ['flag-2', 'SUBMIT', 'proctoring_phone'],
    ]);
  });

  it('marks a writing student "Monitoring lost" after 60 seconds without a signal, once, and back when heard from', async () => {
    const s = await exam();
    const store = t.app.get(ProctoringStoreService);
    const later = Date.now() + LOST_AFTER_MS + 5_000;
    expect(await gateway.sweepLostMonitoring(Date.now())).toBe(0);

    await gateway.sweepLostMonitoring(later);
    expect(toMonitors('session:lost', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, liveStatus: 'LOST' })]);
    // Only once per silence.
    await gateway.sweepLostMonitoring(later + 15_000);
    expect(toMonitors('session:lost', s.exam.id)).toHaveLength(1);

    await gateway.handleHeartbeat(s.studentSocket);
    expect(toMonitors('session:back', s.exam.id)).toEqual([{ studentId: s.student.id, liveStatus: 'WRITING' }]);
    expect((await store.getExamSessions(s.exam.id))[0]).toMatchObject({ liveStatus: 'WRITING', lostSince: null });
    expect((await eventsOf(s.exam.id, s.student)).map((e) => [e.type, e.source])).toEqual([
      ['monitoring-lost', 'SERVER'],
      ['monitoring-back', 'SERVER'],
    ]);

    // A closed socket shows as disconnected, then as lost when it does not come back.
    await gateway.handleDisconnect(s.studentSocket);
    expect(toMonitors('session:left', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, liveStatus: 'DISCONNECTED' })]);
    expect((await store.getExamSessions(s.exam.id))[0].liveStatus).toBe('DISCONNECTED');
    await gateway.sweepLostMonitoring(Date.now() + LOST_AFTER_MS + 5_000);
    expect(toMonitors('session:lost', s.exam.id)).toHaveLength(2);
  });

  it('keeps a student who submitted as submitted, not lost', async () => {
    const s = await exam();
    await gateway.handleExamSubmit(s.studentSocket, { examId: s.exam.id, studentId: s.student.id, studentName: 'x', answers: {}, totalFlagPoints: 0 });
    expect(toMonitors('exam:submitted', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id })]);
    await gateway.sweepLostMonitoring(Date.now() + 10 * LOST_AFTER_MS);
    expect(toMonitors('session:lost', s.exam.id)).toEqual([]);
    expect((await t.app.get(ProctoringStoreService).getExamSessions(s.exam.id))[0].liveStatus).toBe('SUBMITTED');
  });

  describe('the live monitor (P8-03, PRO-03, PRO-08)', () => {
    /** A school: the owner, a teacher who made an exam, another teacher, and a student writing it. */
    const school = async ({ alertFlags = null as number | null } = {}) => {
      const owner = await make.teacher();
      const organization = await make.organization(owner);
      const [teacher, other] = [await make.teacher(), await make.teacher()];
      for (const user of [teacher, other]) await make.member(organization, user, OrganizationMemberRoleEnum.TEACHER);
      const orgToken = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
        t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
      const row = await make.openExam(teacher, { organization_id: organization.id, alert_flags: alertFlags });
      const student = await make.student();
      await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
      const studentToken = orgToken(student, OrganizationMemberRoleEnum.STUDENT);
      const studentSocket = socket(studentToken);
      await gateway.handleJoin(studentSocket, { examId: row.id });
      return {
        exam: row,
        student,
        studentSocket,
        studentToken,
        ownerToken: orgToken(owner, OrganizationMemberRoleEnum.OWNER),
        teacherToken: orgToken(teacher, OrganizationMemberRoleEnum.TEACHER),
        otherToken: orgToken(other, OrganizationMemberRoleEnum.TEACHER),
        teacher,
      };
    };

    it("lets the exam's teacher and the school's owner watch, with each student's time left; not another teacher", async () => {
      const s = await school();
      expect((await t.api.post(`/student/exams/${s.exam.id}/start`, {}, s.studentToken)).status).toBe(201);
      for (const token of [s.teacherToken, s.ownerToken]) {
        const res = await t.api.get<{ payload: { sessions: { studentId: string; deadline: string | null; attemptStatus: string }[] } }>(`/exams/${s.exam.id}/proctoring/sessions`, token);
        expect(res.status).toBe(200);
        expect(res.body.payload.sessions[0]).toMatchObject({ studentId: s.student.id, attemptStatus: 'IN_PROGRESS' });
        expect(res.body.payload.sessions[0].deadline).not.toBeNull();
      }
      expect((await t.api.get(`/exams/${s.exam.id}/proctoring/sessions`, s.otherToken)).status).toBe(403);
      expect((await t.api.post(`/exams/${s.exam.id}/proctoring/students/${s.student.id}/warn`, { message: 'Eyes on your screen.' }, s.otherToken)).status).toBe(403);
    });

    it('warns one student on their screen and ends one student’s exam with a reason, recorded and audited', async () => {
      const s = await school();
      expect((await t.api.post(`/student/exams/${s.exam.id}/start`, {}, s.studentToken)).status).toBe(201);
      const warned = await t.api.post(`/exams/${s.exam.id}/proctoring/students/${s.student.id}/warn`, { message: ' Eyes on your screen. ' }, s.teacherToken);
      expect(warned.status).toBe(200);
      expect(emitted).toContainEqual({ room: `exam:${s.exam.id}:student:${s.student.id}`, event: 'proctor:warning', payload: expect.objectContaining({ message: 'Eyes on your screen.' }) });

      const ended = await t.api.post<{ payload: { status: string } }>(`/exams/${s.exam.id}/proctoring/students/${s.student.id}/end`, { reason: 'Talking off camera' }, s.ownerToken);
      expect([ended.status, ended.body.payload.status]).toEqual([200, 'DISQUALIFIED']);
      expect((await t.dataSource.getRepository(StudentExamSubmissionEntity).findOneByOrFail({ exam_id: s.exam.id, student_id: s.student.id })).disqualification_reason).toBe(
        'Ended by the teacher: Talking off camera',
      );
      expect(emitted).toContainEqual({ room: `exam:${s.exam.id}:student:${s.student.id}`, event: 'exam:ended', payload: { reason: 'Talking off camera' } });
      expect(toMonitors('session:ended', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, liveStatus: 'ENDED' })]);
      expect((await t.app.get(ProctoringStoreService).getExamSessions(s.exam.id))[0].liveStatus).toBe('ENDED');
      const again = await t.api.post<{ code?: string }>(`/exams/${s.exam.id}/proctoring/students/${s.student.id}/end`, { reason: 'Again' }, s.ownerToken);
      expect([again.status, again.body.code]).toEqual([409, 'EXAM_STUDENT_NOT_WRITING']);

      const timeline = await t.api.get<{ payload: { type: string; message: string }[] }>(`/exams/${s.exam.id}/proctoring/students/${s.student.id}/timeline`, s.teacherToken);
      expect(timeline.body.payload.map((e) => [e.type, e.message])).toEqual([
        ['teacher-warning', 'Eyes on your screen.'],
        ['teacher-ended', 'Talking off camera'],
      ]);
      await t.app.get(AuditService).flush();
      expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { entity_id: s.exam.id, action: 'exam.student_ended' } })).toBe(1);
    });

    it("alerts the exam's teacher when a student reaches the exam's alert level, at most once in 5 minutes", async () => {
      const s = await school({ alertFlags: 2 });
      for (const n of [1, 2, 3]) {
        await gateway.handleFlagReport(s.studentSocket, { examId: s.exam.id, id: `alert-${n}`, kind: 'tab-switch', type: 'TAB_SWITCH', message: 'Left the tab', points: 1 });
      }
      expect(toMonitors('alert', s.exam.id)).toEqual([expect.objectContaining({ studentId: s.student.id, flagCount: 2 })]);
      const inbox = await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { event_type: 'proctoring.alert', recipient_id: s.teacher.id } });
      expect(inbox).toHaveLength(1);
      expect(inbox[0].payload).toMatchObject({ flags: '2', path: `/tests/${s.exam.id}/monitor` });
      expect((await t.dataSource.getRepository(ExamEntity).findOneByOrFail({ id: s.exam.id })).alert_flags).toBe(2);
    });
  });
});
