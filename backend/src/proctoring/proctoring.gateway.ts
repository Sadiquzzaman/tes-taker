import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { HttpException, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ProctoringStoreService } from './proctoring-store.service';
import { FLAG_CHECK, ProctoringEventsService, SERVER_EVENTS } from '../exams/proctoring-events.service';
import { ProctoringEventSourceEnum } from '../exams/entities/proctoring-event.entity';
import { RedisService } from '../config/redis.service';
import { NOTIFICATION_EVENTS } from '../notifications/notification.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { ExamService } from '../exams/exam.service';
import { JwtPayloadInterface } from '../auth/interfaces/jwt-payload.interface';
import { RolesEnum } from '../common/enums/roles.enum';
import type { ProctoringExamSubmitPayload } from './types/proctoring.types';

interface JoinExamPayload {
  examId: string;
  role?: 'student' | 'monitor';
  token?: string;
}

interface FlagReportPayload {
  examId: string;
  /** The browser's id for the flag, so it is stored once (live and again with the submit). */
  id?: string;
  /** The browser's own name for the flag (e.g. tab-switch), as the submit sends it. */
  kind?: string;
  type: string;
  message: string;
  points: number;
}

/** How often the server looks for students whose monitoring went quiet (PRO-07). */
const SWEEP_MS = 15_000;

const clientOrigin = process.env.CLIENT_ORIGIN ?? true;

/** Room for teacher/admin live monitors only — students are not members. */
const monitorsRoom = (examId: string) => `exam:${examId}:monitors`;
/** One student's own sockets in an exam: the teacher's warnings and "exam ended" reach them (PRO-03). */
const studentRoom = (examId: string, studentId: string) => `exam:${examId}:student:${studentId}`;
/** At most one alert per student every 5 minutes (PRO-08). */
const ALERT_EVERY_SECONDS = 300;

@WebSocketGateway({
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ProctoringGateway implements OnGatewayDisconnect, OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(ProctoringGateway.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly proctoringStore: ProctoringStoreService,
    private readonly examService: ExamService,
    private readonly jwtService: JwtService,
    private readonly events: ProctoringEventsService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => void this.sweepLostMonitoring().catch((err: Error) => this.logger.warn(`Lost-monitoring sweep failed: ${err.message}`)), SWEEP_MS);
    this.sweepTimer.unref();
  }

  onApplicationShutdown(signal?: string): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    // Proactively disconnect connected clients so the Socket.IO server can
    // release its handles during a graceful shutdown.
    if (this.server) {
      this.server.disconnectSockets(true);
      this.logger.log(`Socket.IO connections closed gracefully (signal: ${signal ?? 'n/a'})`);
    }
  }

  private resolveToken(client: Socket, payload?: { token?: string }): string | null {
    const fromPayload = payload?.token;
    if (fromPayload) {
      return fromPayload;
    }
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) {
      return auth.token;
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }

  private verifyToken(token: string): JwtPayloadInterface | null {
    try {
      return this.jwtService.verify<JwtPayloadInterface>(token);
    } catch {
      return null;
    }
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response && 'message' in response) {
        const msg = (response as { message: string | string[] }).message;
        return Array.isArray(msg) ? msg.join(', ') : msg;
      }
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Request failed';
  }

  private emitToMonitors(examId: string, event: string, payload: unknown): void {
    this.server.to(monitorsRoom(examId)).emit(event, payload);
  }

  @SubscribeMessage('exam:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinExamPayload,
  ) {
    const { examId, role } = payload ?? {};
    const token = this.resolveToken(client, payload);
    if (!token) {
      client.emit('exam:error', { message: 'Authentication required.' });
      return;
    }

    const user = this.verifyToken(token);
    if (!user) {
      client.emit('exam:error', { message: 'Invalid or expired token.' });
      return;
    }

    try {
      await this.examService.assertExamExists(examId);
    } catch {
      client.emit('exam:error', { message: 'Exam not found.' });
      return;
    }

    if (role === 'monitor') {
      if (
        user.role !== RolesEnum.TEACHER &&
        user.role !== RolesEnum.ADMIN &&
        user.role !== RolesEnum.SUPER_ADMIN
      ) {
        client.emit('exam:error', { message: 'Only teachers can monitor exams.' });
        return;
      }

      try {
        await this.examService.assertTeacherCanMonitorExam(examId, user);
      } catch (err) {
        client.emit('exam:error', { message: this.extractErrorMessage(err) });
        return;
      }

      await client.join(monitorsRoom(examId));
      client.data = { ...(client.data ?? {}), examId, role: 'monitor' };

      client.emit('monitor:state', {
        sessions: await this.proctoringStore.getExamSessions(examId),
      });
      return;
    }

    if (user.role !== RolesEnum.STUDENT) {
      client.emit('exam:error', { message: 'Only students can join as examinees.' });
      return;
    }

    try {
      await this.examService.assertStudentCanTakeExam(examId, user);
    } catch (err) {
      client.emit('exam:error', { message: this.extractErrorMessage(err) });
      return;
    }

    await client.join(examId);
    await client.join(studentRoom(examId, user.id));
    const info = await this.events.examInfo(examId);
    client.data = {
      ...(client.data ?? {}),
      examId,
      role: 'student',
      studentId: user.id,
      organizationId: info?.organization_id ?? null,
      examName: info?.name ?? '',
      creatorId: info?.created_by ?? null,
      alertFlags: info?.alert_flags ?? null,
    };

    const previous = await this.proctoringStore.getSession(examId, user.id);
    const session = await this.proctoringStore.upsertStudentSession(examId, client.id, user.id, user.full_name ?? user.email ?? 'Student');
    if (previous?.lostSince) await this.monitoringBack(examId, user.id);

    // Fan-out only to monitors (not every student) — avoids O(n²) join storms.
    this.emitToMonitors(examId, 'session:joined', { ...session, liveStatus: 'WRITING' });
    client.emit('session:ready', session);
  }

  /** The student's browser says it is still there (every 15 seconds); silence for 60 is "Monitoring lost" (PRO-07). */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const { examId, studentId, role } = (client.data ?? {}) as { examId?: string; studentId?: string; role?: string };
    if (role !== 'student' || !examId || !studentId) return;
    const touched = await this.proctoringStore.touch(examId, studentId);
    if (touched?.wasLost) await this.monitoringBack(examId, studentId);
  }

  @SubscribeMessage('flag:report')
  async handleFlagReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FlagReportPayload,
  ) {
    const { examId, message, points, id, kind } = payload ?? {};
    const type = kind && FLAG_CHECK[kind] !== undefined ? kind : payload?.type;
    const data = (client.data ?? {}) as {
      examId?: string;
      studentId?: string;
      role?: string;
      organizationId?: string | null;
      examName?: string;
      creatorId?: string | null;
      alertFlags?: number | null;
    };
    // Only a student who joined this exam reports flags, for themselves.
    if (!examId || !type || !message || typeof points !== 'number' || data.role !== 'student' || data.examId !== examId || !data.studentId) {
      return;
    }

    const result = await this.proctoringStore.recordFlag(examId, data.studentId, { id, type, message, points });
    if (!result) {
      return;
    }
    await this.events.record({ id: examId, organization_id: data.organizationId ?? null }, data.studentId, ProctoringEventSourceEnum.LIVE, [
      { client_id: result.flag.id, type, message, points, occurred_at: new Date(result.flag.timestamp) },
    ]);
    if (result.wasLost) await this.monitoringBack(examId, data.studentId);

    // Slim payload for monitors — do not rebroadcast the full flag history.
    this.emitToMonitors(examId, 'flag:update', {
      studentId: result.session.studentId,
      socketId: result.session.socketId,
      studentName: result.session.studentName,
      totalFlagPoints: result.session.totalFlagPoints,
      flagCount: result.session.flagCount,
      flag: result.flag,
    });
    if (data.alertFlags && result.session.flagCount >= data.alertFlags) {
      await this.alert(examId, data, result.session.studentName, result.session.flagCount);
    }
  }

  /** A student reached the exam's alert level (PRO-08): the monitors and the teacher's inbox, at most every 5 minutes. */
  private async alert(
    examId: string,
    data: { studentId?: string; organizationId?: string | null; examName?: string; creatorId?: string | null },
    studentName: string,
    flagCount: number,
  ): Promise<void> {
    if ((await this.redis.incrWithTtl(`proctor:alert:${examId}:${data.studentId}`, ALERT_EVERY_SECONDS)) !== 1) return;
    this.emitToMonitors(examId, 'alert', { studentId: data.studentId, studentName, flagCount });
    if (!data.creatorId) return;
    await this.notifications.notifyUsers({
      eventType: NOTIFICATION_EVENTS.PROCTORING_ALERT,
      organizationId: data.organizationId ?? null,
      userIds: [data.creatorId],
      variables: { student_name: studentName, exam_name: data.examName ?? '', flags: String(flagCount), path: `/tests/${examId}/monitor` },
      dedupeKey: `${NOTIFICATION_EVENTS.PROCTORING_ALERT}:${examId}:${data.studentId}:${Math.floor(Date.now() / (ALERT_EVERY_SECONDS * 1000))}`,
    });
  }

  /** The teacher's warning to one student (PRO-03), shown on the student's screen. */
  warnStudent(examId: string, studentId: string, message: string, from: string): void {
    this.server.to(studentRoom(examId, studentId)).emit('proctor:warning', { message, from, at: new Date().toISOString() });
  }

  /** One student's exam was ended by the teacher (PRO-03): their screen closes it, the monitors update. */
  async studentEnded(examId: string, studentId: string, reason: string): Promise<void> {
    await this.proctoringStore.markSubmitted(examId, studentId, 'ENDED');
    this.server.to(studentRoom(examId, studentId)).emit('exam:ended', { reason });
    this.emitToMonitors(examId, 'session:ended', { studentId, reason, liveStatus: 'ENDED' });
  }

  @SubscribeMessage('exam:submit')
  async handleExamSubmit(@ConnectedSocket() client: Socket, @MessageBody() payload: ProctoringExamSubmitPayload) {
    const { examId, studentName, totalFlagPoints } = payload ?? {};
    const data = (client.data ?? {}) as { examId?: string; studentId?: string; role?: string };
    if (!examId || data.role !== 'student' || data.examId !== examId || !data.studentId) {
      return;
    }
    await this.proctoringStore.markSubmitted(examId, data.studentId);

    // Do not broadcast answers to the room (privacy + bandwidth).
    // Teachers receive submission metadata only; scores remain on the HTTP finalize path.
    this.emitToMonitors(examId, 'exam:submitted', {
      studentId: data.studentId,
      studentName,
      totalFlagPoints,
      submittedAt: new Date().toISOString(),
    });
  }

  async handleDisconnect(client: Socket) {
    const { examId, studentId, role } = (client.data ?? {}) as { examId?: string; studentId?: string; role?: string };
    if (role !== 'student' || !examId || !studentId) {
      return;
    }
    const session = await this.proctoringStore.markDisconnected(examId, studentId, client.id);
    if (session) this.emitToMonitors(examId, 'session:left', { socketId: client.id, studentId, liveStatus: 'DISCONNECTED' });
  }

  /**
   * Every 15 seconds: students of live exams not heard from for 60 seconds are marked
   * "Monitoring lost" once, recorded as an event and shown on the monitors (PRO-07).
   */
  async sweepLostMonitoring(now = Date.now()): Promise<number> {
    let count = 0;
    for (const examId of await this.proctoringStore.activeExamIds()) {
      const sessions = await this.proctoringStore.getExamSessions(examId);
      if (sessions.length === 0) {
        await this.proctoringStore.forgetExam(examId);
        continue;
      }
      for (const session of await this.proctoringStore.newlyLost(examId, now)) {
        await this.events.recordServerEvent(examId, session.studentId, SERVER_EVENTS.MONITORING_LOST, 'No signal from the student for 60 seconds');
        this.emitToMonitors(examId, 'session:lost', { studentId: session.studentId, studentName: session.studentName, lostSince: session.lostSince, liveStatus: 'LOST' });
        count += 1;
      }
    }
    return count;
  }

  private async monitoringBack(examId: string, studentId: string): Promise<void> {
    await this.events.recordServerEvent(examId, studentId, SERVER_EVENTS.MONITORING_BACK, 'Signal from the student again');
    this.emitToMonitors(examId, 'session:back', { studentId, liveStatus: 'WRITING' });
  }
}
