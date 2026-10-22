import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organizations, membership, teacher-subject assignments, class teachers,
 * and nullable organization_id / class_kind on classes and exams.
 */
export class CreateOrganizationsAndRelated1754400000000 implements MigrationInterface {
  name = 'CreateOrganizationsAndRelated1754400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organizations_status_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organization_members_role_enum" AS ENUM ('OWNER', 'ADMIN', 'TEACHER', 'STUDENT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "classes_class_kind_enum" AS ENUM ('ORGANIZATION', 'PERSONAL');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "name" character varying(200) NOT NULL,
        "status" "organizations_status_enum" NOT NULL DEFAULT 'pending',
        "rejected_reason" character varying(500),
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organizations_reviewed_by" FOREIGN KEY ("reviewed_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_name" ON "organizations" ("name")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_status" ON "organizations" ("status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "organization_members_role_enum" NOT NULL,
        CONSTRAINT "PK_organization_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_members_org_user" UNIQUE ("organization_id", "user_id"),
        CONSTRAINT "FK_organization_members_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organization_members_org" ON "organization_members" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_organization_members_user" ON "organization_members" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_teacher_subjects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "organization_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "subject_id" uuid NOT NULL,
        CONSTRAINT "PK_organization_teacher_subjects" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_org_teacher_subject" UNIQUE ("organization_id", "teacher_id", "subject_id"),
        CONSTRAINT "FK_ots_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ots_teacher" FOREIGN KEY ("teacher_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ots_subject" FOREIGN KEY ("subject_id")
          REFERENCES "subjects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_teachers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "class_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "subject_id" uuid,
        CONSTRAINT "PK_class_teachers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_teachers_class" FOREIGN KEY ("class_id")
          REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_teachers_teacher" FOREIGN KEY ("teacher_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_teachers_subject" FOREIGN KEY ("subject_id")
          REFERENCES "subjects"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_class_teachers_class_teacher_subject"
      ON "class_teachers" ("class_id", "teacher_id", COALESCE("subject_id", '00000000-0000-0000-0000-000000000000'))
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "class_kind" "classes_class_kind_enum" NOT NULL DEFAULT 'PERSONAL'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "classes"
          ADD CONSTRAINT "FK_classes_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "exams"
      ADD COLUMN IF NOT EXISTS "organization_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "exams"
          ADD CONSTRAINT "FK_exams_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "FK_exams_organization"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "FK_classes_organization"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN IF EXISTS "class_kind"`);
    await queryRunner.query(`ALTER TABLE "classes" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_teachers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_teacher_subjects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "classes_class_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organization_members_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organizations_status_enum"`);
  }
}
