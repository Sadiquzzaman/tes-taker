import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProctoringEventEntity, ProctoringEventSourceEnum } from './entities/proctoring-event.entity';

/** The check (plan feature key) each flag type comes from; server events and screen sharing belong to none. */
export const FLAG_CHECK: Record<string, string> = {
  'tab-switch': 'proctoring_tab_switch',
  'window-blur': 'proctoring_browser_change',
  'fullscreen-exit': 'proctoring_fullscreen_exit',
  'no-face': 'proctoring_no_face',
  'camera-blocked': 'proctoring_no_face',
  'multiple-faces': 'proctoring_multiple_face',
  'looking-away': 'proctoring_looking_away',
  'phone-detected': 'proctoring_phone',
  'paste-attempt': 'proctoring_copy_paste',
  'restricted-action': 'proctoring_copy_paste',
  'voice-detected': 'proctoring_voice',
  'idle-too-long': 'proctoring_idle',
  'devtools-open': 'proctoring_devtools',
  'double-display': 'proctoring_double_display',
};

/** What the server records itself (PRO-07). */
export const SERVER_EVENTS = { MONITORING_LOST: 'monitoring-lost', MONITORING_BACK: 'monitoring-back' } as const;

export interface ProctoringEventInput {
  client_id?: string | null;
  type: string;
  message?: string | null;
  points?: number;
  occurred_at: Date;
}

/**
 * Proctoring events as rows (P8-02): flags sent live and with the final submit (stored once by
 * the browser's flag id) and what the server notices, for the live monitor's timeline and the
 * integrity report. No access check: the gateway and the exam services check.
 */
@Injectable()
export class ProctoringEventsService {
  constructor(
    @InjectRepository(ProctoringEventEntity)
    private readonly eventRepo: Repository<ProctoringEventEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** The exam's organisation (null for exams from before organisations). */
  async examOrganization(examId: string): Promise<string | null> {
    const [row] = await this.dataSource.query(`SELECT organization_id FROM exams WHERE id = $1`, [examId]);
    return row?.organization_id ?? null;
  }

  /** Something the server noticed itself (PRO-07), e.g. monitoring lost. */
  async recordServerEvent(examId: string, studentId: string, type: string, message: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO proctoring_events (organization_id, exam_id, student_id, type, message, points, source, occurred_at)
       SELECT e.organization_id, e.id, $2, $3, $4, 0, $5, now() FROM exams e WHERE e.id = $1`,
      [examId, studentId, type, message, ProctoringEventSourceEnum.SERVER],
    );
  }

  async record(
    exam: { id: string; organization_id: string | null },
    studentId: string,
    source: ProctoringEventSourceEnum,
    events: ProctoringEventInput[],
  ): Promise<number> {
    if (events.length === 0) return 0;
    const rows = events.map((event) => ({
      organization_id: exam.organization_id,
      exam_id: exam.id,
      student_id: studentId,
      client_id: event.client_id ? String(event.client_id).slice(0, 64) : null,
      type: String(event.type).slice(0, 40),
      check_key: FLAG_CHECK[event.type] ?? null,
      message: event.message ? String(event.message).slice(0, 300) : null,
      points: Math.max(0, Math.min(100, Math.round(Number(event.points ?? 0)) || 0)),
      source,
      occurred_at: Number.isNaN(event.occurred_at.getTime()) ? new Date() : event.occurred_at,
    }));
    const result = await this.eventRepo.createQueryBuilder().insert().into(ProctoringEventEntity).values(rows).orIgnore().execute();
    return result.identifiers.filter(Boolean).length;
  }

  /** A student's events in an exam, oldest first (the flag timeline). */
  timeline(examId: string, studentId: string): Promise<ProctoringEventEntity[]> {
    return this.eventRepo.find({ where: { exam_id: examId, student_id: studentId }, order: { occurred_at: 'ASC', created_at: 'ASC' } });
  }
}
