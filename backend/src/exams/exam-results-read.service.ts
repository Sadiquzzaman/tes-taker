import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExamSubmissionStatusEnum } from './entities/student-exam-answer.entity';
import { ExamCategoryEnum } from './enums/exam-category.enum';

/** One student's result in one online exam, for the performance scores (P7-02). */
export interface OnlineResultFact {
  exam_id: string;
  name: string;
  /** The school day the exam ended. */
  exam_date: string;
  term_id: string | null;
  offering_id: string | null;
  subject_id: string | null;
  student_id: string;
  score: number;
  max_score: number;
  /** 0–100, two decimals. */
  percent: number;
}

const FINISHED = [ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED, ExamSubmissionStatusEnum.DISQUALIFIED];

/**
 * Online exam results the scores read (P7-02): the organisation's academic exams that ended
 * between two school days, with a finished and graded submission (a disqualified one counts with
 * the score it had). `published` keeps only results the students can see: exams without
 * hand-marked questions (graded on submit, nobody graded them by hand) or with published
 * results. Model tests and IELTS practice are left out. No access check: the results module checks.
 */
@Injectable()
export class ExamResultsReadService {
  constructor(private readonly dataSource: DataSource) {}

  async resultsOf(organizationId: string, studentIds: string[], from: string, to: string, timeZone: string, published = false): Promise<OnlineResultFact[]> {
    if (studentIds.length === 0) return [];
    const rows: {
      exam_id: string; name: string | null; exam_date: string; term_id: string | null; offering_id: string | null; subject_id: string | null;
      student_id: string; score: string; max_score: string;
    }[] = await this.dataSource.query(
      `SELECT e.id AS exam_id, e.test_name AS name,
              to_char((e.exam_end_time AT TIME ZONE 'UTC' AT TIME ZONE $5)::date, 'YYYY-MM-DD') AS exam_date,
              e.term_id, e.offering_id, coalesce(o.subject_id, e.primary_subject_id) AS subject_id,
              s.student_id, coalesce(s.total_score, 0) AS score, s.max_score
         FROM student_exam_submissions s
         JOIN exams e ON e.id = s.exam_id
         LEFT JOIN course_offerings o ON o.id = e.offering_id
        WHERE e.organization_id = $1 AND s.student_id = ANY($2)
          AND s.status = ANY($6) AND s.is_graded AND s.max_score > 0
          AND coalesce(e.is_model_test, false) = false AND e.exam_category = $7
          AND (e.exam_end_time AT TIME ZONE 'UTC' AT TIME ZONE $5)::date BETWEEN $3 AND $4
          ${published ? 'AND (e.result_published_at IS NOT NULL OR s.graded_by IS NULL)' : ''}`,
      [organizationId, studentIds, from, to, timeZone, FINISHED, ExamCategoryEnum.ACADEMIC],
    );
    return rows.map((row) => {
      const score = Number(row.score);
      const max = Number(row.max_score);
      return { ...row, name: row.name ?? '', score, max_score: max, percent: Math.round((score / max) * 10_000) / 100 };
    });
  }
}
