import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Calendar events (P5-05 part 1, CAL-03, CAL-06; design §9.9). Creates, owned by calendar,
 * `events` (type, title, description, start and end, place, whole organisation, status, who
 * cancelled) and `event_attendees` (a section or a person per row).
 *
 * New empty tables; no existing row changes. Safe to run twice; logs a count check.
 */
export class Events1756310000000 implements MigrationInterface {
  name = 'Events1756310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['events_is_active_enum', `'1', '0'`],
      ['event_type', `'EXAM', 'MEETING', 'PARENT_MEETING', 'ACTIVITY', 'OTHER'`],
      ['event_status', `'SCHEDULED', 'CANCELLED'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${type}" AS ENUM(${values});
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" "public"."events_is_active_enum" NOT NULL DEFAULT '1',
        "created_by" uuid, "created_user_name" character varying(100),
        "updated_by" uuid, "updated_user_name" character varying(100),
        "created_at" TIMESTAMP, "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "type" "public"."event_type" NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "place" character varying(120),
        "whole_org" boolean NOT NULL DEFAULT false,
        "status" "public"."event_status" NOT NULL DEFAULT 'SCHEDULED',
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_by" uuid,
        CONSTRAINT "PK_events" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_events_times" CHECK ("ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_org_starts" ON "events" ("organization_id", "starts_at")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_attendees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "section_id" uuid,
        "user_id" uuid,
        CONSTRAINT "PK_event_attendees" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_event_attendees_one" CHECK (("section_id" IS NULL) <> ("user_id" IS NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_attendees_event" ON "event_attendees" ("event_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_attendees_section" ON "event_attendees" ("section_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_event_attendees_user" ON "event_attendees" ("user_id")`);
    await this.addConstraint(queryRunner, 'event_attendees', 'FK_event_attendees_event',
      `FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'event_attendees', 'FK_event_attendees_section',
      `FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await this.addConstraint(queryRunner, 'event_attendees', 'FK_event_attendees_user',
      `FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    const [counts] = await queryRunner.query(`
      SELECT (SELECT count(*)::int FROM events) AS events, (SELECT count(*)::int FROM event_attendees) AS attendees
    `);
    console.log(`[Events] events: ${counts.events}, attendees: ${counts.attendees}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "event_attendees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."event_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."event_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."events_is_active_enum"`);
  }

  private async addConstraint(queryRunner: QueryRunner, table: string, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
