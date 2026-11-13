import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProctoringEventSourceEnum } from './entities/proctoring-event.entity';
import { ProctoringEventsService } from './proctoring-events.service';

export interface IntegrityStudentRow {
  student_id: string;
  student_name: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  flags: number;
  /** Flags per check (plan feature key), most first. */
  checks: { check: string; count: number }[];
  disqualification_reason: string | null;
  last_review: { decision: string; reason: string; decided_at: Date } | null;
}

/**
 * The integrity report (P8-04, PRO-04, PRO-05): for an exam, flags by check and every student who
 * started it with their flags, result and the latest review; for one student, the full report with
 * the flag timeline and every review. Reads the exam's own tables. The caller checks access.
 */
@Injectable()
export class ExamIntegrityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: ProctoringEventsService,
  ) {}

  async examReport(examId: string) {
    const [checkRows, studentRows, flagRows, reviewRows] = await Promise.all([
      this.dataSource.query(
        `SELECT check_key AS "check", COUNT(*)::int AS count, COUNT(DISTINCT student_id)::int AS students
           FROM proctoring_events
          WHERE exam_id = $1 AND source <> $2 AND check_key IS NOT NULL
          GROUP BY check_key ORDER BY count DESC`,
        [examId, ProctoringEventSourceEnum.SERVER],
      ),
      this.dataSource.query(
        `SELECT s.student_id, u.full_name AS student_name, s.status, s.total_score, s.max_score, s.disqualification_reason
           FROM student_exam_submissions s JOIN users u ON u.id = s.student_id
          WHERE s.exam_id = $1`,
        [examId],
      ),
      this.dataSource.query(
        `SELECT student_id, check_key AS "check", COUNT(*)::int AS count
           FROM proctoring_events
          WHERE exam_id = $1 AND source <> $2
          GROUP BY student_id, check_key`,
        [examId, ProctoringEventSourceEnum.SERVER],
      ),
      this.dataSource.query(
        `SELECT DISTINCT ON (student_id) student_id, decision, reason, decided_at
           FROM exam_attempt_reviews WHERE exam_id = $1
          ORDER BY student_id, decided_at DESC`,
        [examId],
      ),
    ]);

    const flagsByStudent = new Map<string, { check: string; count: number }[]>();
    for (const row of flagRows as { student_id: string; check: string | null; count: number }[]) {
      const list = flagsByStudent.get(row.student_id) ?? [];
      list.push({ check: row.check ?? 'other', count: row.count });
      flagsByStudent.set(row.student_id, list);
    }
    const reviewByStudent = new Map<string, { decision: string; reason: string; decided_at: Date }>(
      (reviewRows as { student_id: string; decision: string; reason: string; decided_at: Date }[]).map((r) => [r.student_id, { decision: r.decision, reason: r.reason, decided_at: r.decided_at }]),
    );

    const students: IntegrityStudentRow[] = (studentRows as Record<string, unknown>[]).map((row) => {
      const checks = (flagsByStudent.get(row.student_id as string) ?? []).sort((a, b) => b.count - a.count);
      return {
        student_id: row.student_id as string,
        student_name: (row.student_name as string) ?? '',
        status: row.status as string,
        total_score: row.total_score === null ? null : Number(row.total_score),
        max_score: row.max_score === null ? null : Number(row.max_score),
        flags: checks.reduce((sum, c) => sum + c.count, 0),
        checks,
        disqualification_reason: (row.disqualification_reason as string | null) ?? null,
        last_review: reviewByStudent.get(row.student_id as string) ?? null,
      };
    });
    // Most flagged first; then by name.
    students.sort((a, b) => b.flags - a.flags || a.student_name.localeCompare(b.student_name));

    return {
      exam_id: examId,
      summary: {
        students: students.length,
        flagged: students.filter((s) => s.flags > 0).length,
        disqualified: students.filter((s) => s.status === 'DISQUALIFIED').length,
        reviewed: reviewByStudent.size,
      },
      by_check: checkRows as { check: string; count: number; students: number }[],
      students,
    };
  }

  /** One student's report: their attempt, flags by check, the timeline and every review (newest first). */
  async studentReport(examId: string, studentId: string) {
    const [[attempt], timeline, reviews] = await Promise.all([
      this.dataSource.query(
        `SELECT s.student_id, u.full_name AS student_name, s.status, s.started_at, s.submitted_at, s.total_score, s.max_score, s.disqualification_reason
           FROM student_exam_submissions s JOIN users u ON u.id = s.student_id
          WHERE s.exam_id = $1 AND s.student_id = $2`,
        [examId, studentId],
      ),
      this.events.timeline(examId, studentId),
      this.dataSource.query(
        `SELECT r.id, r.decision, r.reason, r.previous_status, r.previous_score, r.decided_at, u.full_name AS decided_by_name
           FROM exam_attempt_reviews r LEFT JOIN users u ON u.id = r.decided_by
          WHERE r.exam_id = $1 AND r.student_id = $2
          ORDER BY r.decided_at DESC`,
        [examId, studentId],
      ),
    ]);
    if (!attempt) return null;
    const counts = new Map<string, number>();
    for (const event of timeline) {
      if (event.source === ProctoringEventSourceEnum.SERVER) continue;
      const key = event.check_key ?? 'other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return {
      attempt: {
        ...attempt,
        total_score: attempt.total_score === null ? null : Number(attempt.total_score),
        max_score: attempt.max_score === null ? null : Number(attempt.max_score),
      },
      checks: [...counts.entries()].map(([check, count]) => ({ check, count })).sort((a, b) => b.count - a.count),
      timeline: timeline.map((e) => ({ id: e.id, type: e.type, check: e.check_key, message: e.message, points: e.points, source: e.source, occurred_at: e.occurred_at })),
      reviews: (reviews as Record<string, unknown>[]).map((r) => ({ ...r, previous_score: r.previous_score === null ? null : Number(r.previous_score) })),
    };
  }
}
