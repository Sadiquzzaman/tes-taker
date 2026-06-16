import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ProctoringFlagEntry, ProctoringStudentSession } from './types/proctoring.types';

@Injectable()
export class ProctoringStoreService {
  private readonly sessions = new Map<string, Map<string, ProctoringStudentSession>>();

  getExamSessions(examId: string): ProctoringStudentSession[] {
    const room = this.sessions.get(examId);
    if (!room) {
      return [];
    }
    return Array.from(room.values());
  }

  upsertStudentSession(
    examId: string,
    socketId: string,
    studentId: string,
    studentName: string,
  ): ProctoringStudentSession {
    if (!this.sessions.has(examId)) {
      this.sessions.set(examId, new Map());
    }

    const room = this.sessions.get(examId)!;
    const existing = Array.from(room.values()).find((s) => s.studentId === studentId);

    const session: ProctoringStudentSession = existing ?? {
      socketId,
      studentId,
      studentName,
      joinedAt: new Date().toISOString(),
      totalFlagPoints: 0,
      flags: [],
    };

    session.socketId = socketId;
    session.studentName = studentName;
    room.set(socketId, session);
    return session;
  }

  recordFlag(
    examId: string,
    socketId: string,
    flag: Omit<ProctoringFlagEntry, 'id' | 'timestamp'>,
  ): { session: ProctoringStudentSession; flag: ProctoringFlagEntry } | null {
    const room = this.sessions.get(examId);
    if (!room) {
      return null;
    }

    const session = room.get(socketId);
    if (!session) {
      return null;
    }

    const entry: ProctoringFlagEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...flag,
    };

    session.flags.unshift(entry);
    session.totalFlagPoints += entry.points;
    return { session, flag: entry };
  }

  removeStudentSession(examId: string, socketId: string): void {
    this.sessions.get(examId)?.delete(socketId);
  }
}
