import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { HttpException } from '@nestjs/common';
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

@WebSocketGateway({
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ProctoringGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly proctoringStore: ProctoringStoreService,
    private readonly examService: ExamService,
    private readonly jwtService: JwtService,
  ) {}

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

    await client.join(examId);

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

    const session = this.proctoringStore.upsertStudentSession(
      examId,
      client.id,
      user.id,
      user.full_name ?? user.email ?? 'Student',
    );

    this.server.to(examId).emit('session:joined', session);
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

    this.server.to(examId).emit('flag:update', {
      session: result.session,
      flag: result.flag,
    });
  }

  @SubscribeMessage('exam:submit')
  handleExamSubmit(@MessageBody() payload: ProctoringExamSubmitPayload) {
    const { examId, studentId, studentName, answers, totalFlagPoints } = payload ?? {};
    if (!examId || !studentId || !studentName) {
      return;
    }

    this.server.to(examId).emit('exam:submitted', {
      studentId,
      studentName,
      answers,
      totalFlagPoints,
      submittedAt: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    for (const room of client.rooms) {
      if (room === client.id) {
        continue;
      }

      this.proctoringStore.removeStudentSession(room, client.id);
      this.server.to(room).emit('session:left', { socketId: client.id });
    }
  }
}
