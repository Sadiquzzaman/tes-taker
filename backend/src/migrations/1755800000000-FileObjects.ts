import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stored files (P2-07, FND-15, FND-16, design §8.5): one row per uploaded file, whose
 * `size_bytes` counts toward the organisation's storage quota. Soft delete only (`deleted_at`,
 * `deleted_by`). `legacy_key` makes the M4 move of old /uploads files re-runnable.
 *
 * New table only, no data moved (the move is `pnpm files:migrate-legacy`). Safe to run twice.
 * `down()` drops the table, so file records made since are lost; the stored objects stay.
 */
export class FileObjects1755800000000 implements MigrationInterface {
  name = 'FileObjects1755800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_objects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid,
        "purpose" character varying(30) NOT NULL,
        "s3_key" character varying(400) NOT NULL,
        "mime" character varying(100) NOT NULL,
        "original_name" character varying(255),
        "size_bytes" bigint NOT NULL DEFAULT '0',
        "original_size_bytes" bigint,
        "width" integer,
        "height" integer,
        "duration_s" integer,
        "status" character varying(10) NOT NULL DEFAULT 'PENDING',
        "legacy_key" character varying(400),
        "delete_after" TIMESTAMP WITH TIME ZONE,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_file_objects_status" CHECK ("status" IN ('PENDING', 'READY', 'FAILED')),
        CONSTRAINT "PK_7b0aca4f7e155c5b2fad069669f" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_file_objects_legacy_key" ON "file_objects" ("legacy_key") WHERE "legacy_key" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_objects_delete_after" ON "file_objects" ("delete_after")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_objects_status_created" ON "file_objects" ("status", "created_at")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_objects_organization_purpose" ON "file_objects" ("organization_id", "purpose")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f9785a924506a53480a2cb43cb8') THEN
          ALTER TABLE "file_objects" ADD CONSTRAINT "FK_f9785a924506a53480a2cb43cb8"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_240a8fe5c3451e9636cbdbec31e') THEN
          ALTER TABLE "file_objects" ADD CONSTRAINT "FK_240a8fe5c3451e9636cbdbec31e"
            FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_4917ca34f834ba4210fbd2604e8') THEN
          ALTER TABLE "file_objects" ADD CONSTRAINT "FK_4917ca34f834ba4210fbd2604e8"
            FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    const [{ count }] = (await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "file_objects"`)) as Array<{ count: number }>;
    console.log(`[FileObjects] file_objects rows: ${count}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "file_objects"`);
  }
}
