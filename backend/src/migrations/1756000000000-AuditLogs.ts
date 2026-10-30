import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The audit log (P2-09, design §8.10): who did what, to which organisation and record, when.
 *
 * Append-only: a trigger rejects UPDATE. DELETE stays possible so an organisation's rows go with
 * it (ON DELETE CASCADE, design §10 hard delete); actors are kept as NULL if a user row is deleted.
 * New table only, no data moved. Safe to run twice.
 */
export class AuditLogs1756000000000 implements MigrationInterface {
  name = 'AuditLogs1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" BIGSERIAL NOT NULL,
        "organization_id" uuid,
        "actor_id" uuid,
        "action" character varying(80) NOT NULL,
        "entity_type" character varying(60),
        "entity_id" uuid,
        "before" jsonb,
        "after" jsonb,
        "reason" text,
        "ip" inet,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_organization_created" ON "audit_logs" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_created" ON "audit_logs" ("actor_id", "created_at")`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_145f35b204c731ba7fc1a0be0e7') THEN
          ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_145f35b204c731ba7fc1a0be0e7"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_177183f29f438c488b5e8510cdb') THEN
          ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb"
            FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // Append-only. The actor's ON DELETE SET NULL is the one update allowed (it changes only actor_id).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
      BEGIN
        IF NEW.actor_id IS NULL AND OLD.actor_id IS NOT NULL
           AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "audit_logs_append_only" ON "audit_logs"`);
    await queryRunner.query(`
      CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE ON "audit_logs"
      FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_append_only()`);
  }
}
