import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { HttpException, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ProctoringStoreService } from './proctoring-store.service';
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
  type: string;
  message: string;
  points: number;
}

const clientOrigin = process.env.CLIENT_ORIGIN ?? true;

/** Room for teacher/admin live monitors only — students are not members. */
const monitorsRoom = (examId: string) => `exam:${examId}:monitors`;

@WebSocketGateway({
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ProctoringGateway implements OnGatewayDisconnect, OnApplicationShutdown {
  private readonly logger = new Logger(ProctoringGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly proctoringStore: ProctoringStoreService,
    private readonly examService: ExamService,
    private readonly jwtService: JwtService,
  ) {}

  onApplicationShutdown(signal?: string): void {
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
      // Keep legacy room join for disconnect bookkeeping of monitor sockets.
      await client.join(examId);
      client.data = { ...(client.data ?? {}), examId, role: 'monitor' };

      client.emit('monitor:state', {
        sessions: this.proctoringStore.getExamSessions(examId),
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
    client.data = { ...(client.data ?? {}), examId, role: 'student', studentId: user.id };

    const session = this.proctoringStore.upsertStudentSession(
      examId,
      client.id,
      user.id,
      user.full_name ?? user.email ?? 'Student',
    );

    // Fan-out only to monitors (not every student) — avoids O(n²) join storms.
    this.emitToMonitors(examId, 'session:joined', {
      socketId: session.socketId,
      studentId: session.studentId,
      studentName: session.studentName,
      joinedAt: session.joinedAt,
      totalFlagPoints: session.totalFlagPoints,
    });
    client.emit('session:ready', session);
  }

  @SubscribeMessage('flag:report')
  handleFlagReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FlagReportPayload,
  ) {
    const { examId, type, message, points } = payload ?? {};
    if (!examId || !type || !message || typeof points !== 'number') {
      return;
    }

    const result = this.proctoringStore.recordFlag(examId, client.id, {
      type,
      message,
      points,
    });

    if (!result) {
      return;
    }

    // Slim payload for monitors — do not rebroadcast the full flag history.
    this.emitToMonitors(examId, 'flag:update', {
      studentId: result.session.studentId,
      socketId: result.session.socketId,
      studentName: result.session.studentName,
      totalFlagPoints: result.session.totalFlagPoints,
      flag: result.flag,
    });
  }

  @SubscribeMessage('exam:submit')
  handleExamSubmit(@MessageBody() payload: ProctoringExamSubmitPayload) {
    const { examId, studentId, studentName, totalFlagPoints } = payload ?? {};
    if (!examId || !studentId || !studentName) {
      return;
    }

    // Do not broadcast answers to the room (privacy + bandwidth).
    // Teachers receive submission metadata only; scores remain on the HTTP finalize path.
    this.emitToMonitors(examId, 'exam:submitted', {
      studentId,
      studentName,
      totalFlagPoints,
      submittedAt: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    for (const room of client.rooms) {
      if (room === client.id || room.endsWith(':monitors')) {
        continue;
      }

      this.proctoringStore.removeStudentSession(room, client.id);
      this.emitToMonitors(room, 'session:left', { socketId: client.id });
    }
  }
}
