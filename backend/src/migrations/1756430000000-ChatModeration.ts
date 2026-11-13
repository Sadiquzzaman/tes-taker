import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat moderation (P9-02, COM-04, COM-05). Owned by the chat module; the chats themselves are in
 * MongoDB.
 *
 * `chat_access_logs`: an owner or admin opened a group or private chat (who, which, when, why).
 * Every opening is kept; the owner reads the log.
 * `message_reports`: a member reported a message, with the 5 messages before and after it as
 * they were (`context`); an owner or admin resolves it (the message KEPT or DELETED).
 *
 * New empty tables; no existing row changes. Safe to run twice; logs a count check.
 */
export class ChatModeration1756430000000 implements MigrationInterface {
  name = 'ChatModeration1756430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_access_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "chat_type" character varying(10) NOT NULL,
        "chat_id" uuid NOT NULL,
        "reason" character varying(300) NOT NULL,
        "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_access_logs" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_chat_access_logs_type" CHECK ("chat_type" IN ('GROUP', 'DIRECT'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_access_logs_org_opened" ON "chat_access_logs" ("organization_id", "opened_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_chat_access_logs_actor_chat" ON "chat_access_logs" ("actor_id", "chat_id", "opened_at")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "chat_type" character varying(10) NOT NULL,
        "chat_id" uuid NOT NULL,
        "message_id" uuid NOT NULL,
        "reporter_id" uuid NOT NULL,
        "reason" character varying(300) NOT NULL,
        "context" jsonb NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'OPEN',
        "resolution" character varying(10),
        "resolved_by" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reports" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_message_reports_type" CHECK ("chat_type" IN ('GROUP', 'DIRECT')),
        CONSTRAINT "CHK_message_reports_status" CHECK ("status" IN ('OPEN', 'RESOLVED')),
        CONSTRAINT "CHK_message_reports_resolution" CHECK ("resolution" IS NULL OR "resolution" IN ('KEPT', 'DELETED'))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_message_reports_message_reporter" ON "message_reports" ("message_id", "reporter_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_message_reports_org_status" ON "message_reports" ("organization_id", "status", "created_at")`);
    for (const [table, name, definition] of [
      ['chat_access_logs', 'FK_chat_access_logs_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['chat_access_logs', 'FK_chat_access_logs_actor', `FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['message_reports', 'FK_message_reports_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['message_reports', 'FK_message_reports_reporter', `FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['message_reports', 'FK_message_reports_resolver', `FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
          END IF;
        END $$;
      `);
    }
    const [counts] = await queryRunner.query(
      `SELECT (SELECT count(*)::int FROM chat_access_logs) AS logs, (SELECT count(*)::int FROM message_reports) AS reports`,
    );
    console.log(`[ChatModeration] access logs: ${counts.logs}, reports: ${counts.reports}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_access_logs"`);
  }
}
