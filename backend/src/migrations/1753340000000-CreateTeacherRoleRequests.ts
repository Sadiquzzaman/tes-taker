import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates teacher_role_requests for the Request-to-Become-a-Teacher workflow.
 */
export class CreateTeacherRoleRequests1753340000000 implements MigrationInterface {
  name = 'CreateTeacherRoleRequests1753340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "teacher_role_requests_status_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_role_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "status" "teacher_role_requests_status_enum" NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMPTZ,
        "note" character varying(500),
        CONSTRAINT "PK_teacher_role_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teacher_role_requests_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_role_requests_user_id"
      ON "teacher_role_requests" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_role_requests_status"
      ON "teacher_role_requests" ("status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_role_requests_pending_user"
      ON "teacher_role_requests" ("user_id")
      WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_role_requests_pending_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teacher_role_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teacher_role_requests_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_role_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "teacher_role_requests_status_enum"`);
  }
}
