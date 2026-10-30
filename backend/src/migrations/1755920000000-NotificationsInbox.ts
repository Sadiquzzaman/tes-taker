import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * In-app notifications (P2-08 part 3, FND-12): each user's inbox behind the top-bar bell, and the
 * channels each user chose per kind of message (no row = the defaults; in-app is always on).
 *
 * New tables only, no data moved. Safe to run twice.
 */
export class NotificationsInbox1755920000000 implements MigrationInterface {
  name = 'NotificationsInbox1755920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_notification_prefs" (
        "user_id" uuid NOT NULL,
        "event_type" character varying(60) NOT NULL,
        "channels" character varying(10) array NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_db0bd84c0cf74f98971ccc95ea9" PRIMARY KEY ("user_id", "event_type")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid,
        "outbox_id" uuid,
        "type" character varying(60) NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text,
        "link" character varying(300),
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notifications_outbox" ON "notifications" ("outbox_id") WHERE "outbox_id" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read_created" ON "notifications" ("user_id", "read_at", "created_at")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a7c40a12f04a840da42832c4bdb') THEN
          ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "FK_a7c40a12f04a840da42832c4bdb"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9a8a82462cab47c73d25f49261f') THEN
          ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_cb7b1fb018b296f2107e998b2ff') THEN
          ALTER TABLE "notifications" ADD CONSTRAINT "FK_cb7b1fb018b296f2107e998b2ff"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_25647b9aa150108580a3c2d00d3') THEN
          ALTER TABLE "notifications" ADD CONSTRAINT "FK_25647b9aa150108580a3c2d00d3"
            FOREIGN KEY ("outbox_id") REFERENCES "notification_outbox"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_notification_prefs"`);
  }
}
