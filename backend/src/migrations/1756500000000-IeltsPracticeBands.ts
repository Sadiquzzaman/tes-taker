import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-bands IELTS Listening / Reading attempts on tests with fewer than 40 questions (P10 fix,
 * 16 Nov): they were banded as if the score were out of 40, so 12 of 13 got band 4. The score is
 * now scaled to 40 first (12 of 13 → 37 → 8.5 on the default table), as new attempts are.
 *
 * Changes only `ielts_attempts.band` of those attempts (raw scores stay). Safe to run twice (it
 * gives the same bands); logs how many it changed. Down keeps the corrected bands.
 */
export class IeltsPracticeBands1756500000000 implements MigrationInterface {
  name = 'IeltsPracticeBands1756500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const changed: { id: string }[] = await queryRunner.query(`
      WITH totals AS (
        SELECT p.test_id, p.module, SUM(CASE WHEN g.type = 'MCQ_MULTI' THEN jsonb_array_length(q.answer->'keys') ELSE 1 END)::int AS n
          FROM ielts_test_parts p
          JOIN ielts_question_groups g ON g.part_id = p.id AND g.deleted_at IS NULL
          JOIN ielts_questions q ON q.group_id = g.id AND q.deleted_at IS NULL
         GROUP BY p.test_id, p.module
      ),
      targets AS (
        SELECT a.id, a.organization_id, a.module, t.test_type, round(a.raw_score * 40.0 / tt.n)::int AS scaled
          FROM ielts_attempts a
          JOIN ielts_tests t ON t.id = a.test_id
          JOIN totals tt ON tt.test_id = a.test_id AND tt.module = a.module
         WHERE a.status = 'MARKED' AND a.module IN ('LISTENING', 'READING') AND a.raw_score IS NOT NULL AND tt.n > 0 AND tt.n < 40
      ),
      bands AS (
        SELECT x.id,
               (SELECT (r->>'band')::numeric
                  FROM ielts_band_tables b, jsonb_array_elements(b.rows) r
                 WHERE b.module = x.module
                   AND b.test_type IS NOT DISTINCT FROM (CASE WHEN x.module = 'READING' THEN x.test_type END)
                   AND (b.organization_id = x.organization_id OR b.organization_id IS NULL)
                   AND (r->>'min_raw')::int <= x.scaled
                 ORDER BY (b.organization_id IS NULL), (r->>'min_raw')::int DESC
                 LIMIT 1) AS band
          FROM targets x
      )
      UPDATE ielts_attempts a SET band = bands.band
        FROM bands
       WHERE a.id = bands.id AND bands.band IS NOT NULL AND a.band IS DISTINCT FROM bands.band
      RETURNING a.id
    `);
    console.log(`[IeltsPracticeBands] re-banded attempts: ${changed.length}`);
  }

  public async down(): Promise<void> {
    // The old bands were wrong; nothing to undo.
  }
}
