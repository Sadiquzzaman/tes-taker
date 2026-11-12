import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One calendar subscription link per person across all their workspaces (CAL-07 follow-up).
 * `calendar_feed_tokens.organization_id` becomes optional: NULL is a personal link, built from
 * every workspace the person belongs to; existing per-workspace links keep working unchanged.
 *
 * No existing row changes. Safe to run twice; logs a count check. Reverting refuses while
 * personal links exist (the old schema cannot hold them), so nothing is deleted silently.
 */
export class PersonalCalendarLinks1756340000000 implements MigrationInterface {
  name = 'PersonalCalendarLinks1756340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "calendar_feed_tokens" ALTER COLUMN "organization_id" DROP NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_feed_tokens_personal" ON "calendar_feed_tokens" ("user_id") WHERE "organization_id" IS NULL`,
    );
    const [counts] = await queryRunner.query(
      `SELECT count(*)::int AS tokens, count(*) FILTER (WHERE organization_id IS NULL)::int AS personal FROM calendar_feed_tokens`,
    );
    console.log(`[PersonalCalendarLinks] tokens: ${counts.tokens}, personal: ${counts.personal}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ personal }] = await queryRunner.query(`SELECT count(*)::int AS personal FROM calendar_feed_tokens WHERE organization_id IS NULL`);
    if (personal > 0) {
      throw new Error(`[PersonalCalendarLinks] ${personal} personal calendar links exist; the old schema cannot hold them. Not reverted.`);
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_feed_tokens_personal"`);
    await queryRunner.query(`ALTER TABLE "calendar_feed_tokens" ALTER COLUMN "organization_id" SET NOT NULL`);
  }
}
