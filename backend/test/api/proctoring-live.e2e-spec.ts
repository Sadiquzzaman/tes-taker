import type { Server, Socket } from 'socket.io';
import { ProctoringEventEntity } from '../../src/exams/entities/proctoring-event.entity';
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
});
