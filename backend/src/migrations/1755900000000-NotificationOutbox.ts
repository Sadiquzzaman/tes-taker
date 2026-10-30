import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notifications, part 1 (P2-08, design §8.6, FND-12/14): the outbox every SMS and email goes
 * through (also the message log), and the message templates keyed by event, channel and language.
 *
 * New tables only, no data moved. A plain table for now (monthly partitioning is in docs/TODO.md).
 * The default templates are added by the API at start-up when missing, so admin edits are kept.
 * Safe to run twice.
 */
export class NotificationOutbox1755900000000 implements MigrationInterface {
  name = 'NotificationOutbox1755900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid,
        "event_type" character varying(60) NOT NULL,
        "recipient_type" character varying(10) NOT NULL,
        "recipient_id" uuid,
        "to_address" character varying(200),
        "channel" character varying(10) NOT NULL,
        "locale" character varying(5),
        "payload" jsonb NOT NULL DEFAULT '{}',
        "subject" character varying(200),
        "body" text,
        "dedupe_key" character varying(200),
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "urgent" boolean NOT NULL DEFAULT false,
        "send_after" TIMESTAMP WITH TIME ZONE,
        "attempts" smallint NOT NULL DEFAULT '0',
        "provider_msg_id" character varying(100),
        "credits_used" smallint NOT NULL DEFAULT '0',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "error" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_notification_outbox_recipient_type" CHECK ("recipient_type" IN ('USER', 'GUARDIAN', 'ADDRESS')),
        CONSTRAINT "CHK_notification_outbox_status" CHECK ("status" IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'NO_CREDIT')),
        CONSTRAINT "CHK_notification_outbox_channel" CHECK ("channel" IN ('IN_APP', 'EMAIL', 'SMS')),
        CONSTRAINT "PK_83d47c7dba1da2d038749fe757e" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_outbox_dedupe_key" ON "notification_outbox" ("dedupe_key")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notification_outbox_recipient_created" ON "notification_outbox" ("recipient_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notification_outbox_organization_created" ON "notification_outbox" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notification_outbox_status_send_after" ON "notification_outbox" ("status", "send_after")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_c243ec8035a61909bd46e94707f') THEN
          ALTER TABLE "notification_outbox" ADD CONSTRAINT "FK_c243ec8035a61909bd46e94707f"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid,
        "event_type" character varying(60) NOT NULL,
        "channel" character varying(10) NOT NULL,
        "locale" character varying(5) NOT NULL,
        "subject" character varying(200),
        "body" text NOT NULL,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_message_templates_locale" CHECK ("locale" IN ('bn', 'en')),
        CONSTRAINT "CHK_message_templates_channel" CHECK ("channel" IN ('IN_APP', 'EMAIL', 'SMS')),
        CONSTRAINT "PK_9ac2bd9635be662d183f314947d" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_message_templates_organization" ON "message_templates" ("organization_id", "event_type", "channel", "locale") WHERE "organization_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_message_templates_platform" ON "message_templates" ("event_type", "channel", "locale") WHERE "organization_id" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_outbox"`);
  }
}
