import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../config/redis.service';
import type { ProctoringFlagEntry, ProctoringLiveStatus, ProctoringStudentSession } from './types/proctoring.types';

/** No signal for this long and a writing student is "Monitoring lost" (PRO-07). */
export const LOST_AFTER_MS = 60_000;
/** Live state is kept this long after the last change (an exam day and its review). */
const TTL_SECONDS = 2 * 24 * 3600;
/** The recent flags kept with the session; the full history is in proctoring_events. */
const RECENT_FLAGS = 20;

const studentsKey = (examId: string) => `proctor:exam:${examId}:students`;
const sessionKey = (examId: string, studentId: string) => `proctor:exam:${examId}:s:${studentId}`;
const ACTIVE_KEY = 'proctor:active-exams';

/**
 * Live proctoring state per exam and student (P8-02, design §6.2), in Redis so it survives a
 * restart: who is writing, when their browser was last heard from, their flags so far. A student
 * not heard from for 60 seconds while writing shows as LOST (computed from `lastSeenAt`).
 */
@Injectable()
export class ProctoringStoreService {
  constructor(private readonly redis: RedisService) {}

  /** The status the monitor shows: LOST when a writing student has gone quiet. */
  static liveStatus(session: ProctoringStudentSession, now = Date.now()): ProctoringLiveStatus {
    if (session.status === 'WRITING' && now - Date.parse(session.lastSeenAt) > LOST_AFTER_MS) return 'LOST';
    return session.status;
  }

  async getExamSessions(examId: string, now = Date.now()): Promise<(ProctoringStudentSession & { liveStatus: ProctoringLiveStatus })[]> {
    const ids = await this.redis.smembers(studentsKey(examId));
    const raw = await this.redis.mget(ids.map((id) => sessionKey(examId, id)));
    return raw
      .filter((value): value is string => Boolean(value))
      .map((value) => JSON.parse(value) as ProctoringStudentSession)
      .map((session) => ({ ...session, liveStatus: ProctoringStoreService.liveStatus(session, now) }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  async getSession(examId: string, studentId: string): Promise<ProctoringStudentSession | null> {
    const value = await this.redis.get(sessionKey(examId, studentId));
    return value ? (JSON.parse(value) as ProctoringStudentSession) : null;
  }

  /** A student joins (or comes back): their flags are kept; they are writing and heard from now. */
  async upsertStudentSession(examId: string, socketId: string, studentId: string, studentName: string): Promise<ProctoringStudentSession> {
    const now = new Date().toISOString();
    const existing = await this.getSession(examId, studentId);
    const session: ProctoringStudentSession = {
      totalFlagPoints: 0,
      flagCount: 0,
      latestFlag: null,
      flags: [],
      joinedAt: now,
      ...existing,
      socketId,
      studentId,
      studentName,
      lastSeenAt: now,
      status: existing?.status === 'SUBMITTED' ? 'SUBMITTED' : 'WRITING',
      lostSince: null,
    };
    await this.save(examId, session);
    await this.redis.sadd(studentsKey(examId), studentId, TTL_SECONDS);
    await this.redis.sadd(ACTIVE_KEY, examId, TTL_SECONDS);
    return session;
  }

  /** A sign of life (heartbeat or flag); says whether the student had been lost. */
  async touch(examId: string, studentId: string): Promise<{ session: ProctoringStudentSession; wasLost: boolean } | null> {
    const session = await this.getSession(examId, studentId);
    if (!session) return null;
    const wasLost = session.lostSince !== null;
    session.lastSeenAt = new Date().toISOString();
    session.lostSince = null;
    if (session.status === 'DISCONNECTED') session.status = 'WRITING';
    await this.save(examId, session);
    return { session, wasLost };
  }

  async recordFlag(
    examId: string,
    studentId: string,
    flag: Omit<ProctoringFlagEntry, 'id' | 'timestamp'> & { id?: string },
  ): Promise<{ session: ProctoringStudentSession; flag: ProctoringFlagEntry; wasLost: boolean } | null> {
    const touched = await this.touch(examId, studentId);
    if (!touched) return null;
    const { session, wasLost } = touched;
    const entry: ProctoringFlagEntry = { ...flag, id: flag.id ?? randomUUID(), timestamp: new Date().toISOString() };
    session.flags = [entry, ...session.flags].slice(0, RECENT_FLAGS);
    session.flagCount += 1;
    session.totalFlagPoints += entry.points;
    session.latestFlag = entry;
    await this.save(examId, session);
    return { session, flag: entry, wasLost };
  }

  async markSubmitted(examId: string, studentId: string): Promise<ProctoringStudentSession | null> {
    const session = await this.getSession(examId, studentId);
    if (!session) return null;
    session.status = 'SUBMITTED';
    session.lostSince = null;
    await this.save(examId, session);
    return session;
  }

  /** The student's socket closed; a newer socket of theirs is not affected. */
  async markDisconnected(examId: string, studentId: string, socketId: string): Promise<ProctoringStudentSession | null> {
    const session = await this.getSession(examId, studentId);
    if (!session || session.socketId !== socketId || session.status !== 'WRITING') return null;
    session.status = 'DISCONNECTED';
    await this.save(examId, session);
    return session;
  }

  /** Writing students who just went quiet for 60 seconds: marked once, until heard from again. */
  async newlyLost(examId: string, now = Date.now()): Promise<ProctoringStudentSession[]> {
    const lost: ProctoringStudentSession[] = [];
    for (const session of await this.getExamSessions(examId, now)) {
      if (session.liveStatus !== 'LOST' && !(session.status === 'DISCONNECTED' && now - Date.parse(session.lastSeenAt) > LOST_AFTER_MS)) continue;
      if (session.lostSince) continue;
      const { liveStatus: _live, ...stored } = session;
      stored.lostSince = new Date(now).toISOString();
      await this.save(examId, stored);
      lost.push(stored);
    }
    return lost;
  }

  /** Exams with live sessions in the last two days (for the lost-monitoring sweep). */
  activeExamIds(): Promise<string[]> {
    return this.redis.smembers(ACTIVE_KEY);
  }

  async forgetExam(examId: string): Promise<void> {
    await this.redis.srem(ACTIVE_KEY, examId);
  }

  private save(examId: string, session: ProctoringStudentSession): Promise<void> {
    return this.redis.set(sessionKey(examId, session.studentId), JSON.stringify(session), TTL_SECONDS);
  }
}
