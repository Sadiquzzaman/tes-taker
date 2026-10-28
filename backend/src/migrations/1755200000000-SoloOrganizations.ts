import { MigrationInterface, QueryRunner } from 'typeorm';

/** Every SOLO organisation and its owner (the teacher whose own workspace it is). */
const SOLO_OWNERS = `
  SELECT m.user_id, m.organization_id
  FROM organization_members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE o.kind = 'SOLO' AND m.role = 'OWNER'
`;

/**
 * One tenancy model (P2-01, design §8.1 and migration step M2). Every account is an
 * organisation: a teacher's "personal" workspace becomes an organisation with kind = SOLO,
 * and their classes, exams and class conversations get its id instead of NULL.
 *
 * Expand + migrate only: organization_id stays nullable for one release (the contract step
 * makes it NOT NULL). Safe to run twice: it only creates SOLO organisations that are missing
 * and only fills organization_id where it is still NULL. It logs before/after counts.
 */
export class SoloOrganizations1755200000000 implements MigrationInterface {
  name = 'SoloOrganizations1755200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Expand: the new organisation columns (schema.dbml `organizations`).
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."organizations_kind_enum" AS ENUM('SCHOOL', 'COACHING', 'IELTS_CENTRE', 'SOLO', 'COLLEGE', 'UNIVERSITY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."organizations_workspace_type_enum" AS ENUM('ACADEMIC', 'IELTS', 'TERTIARY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "organizations"
        ADD COLUMN IF NOT EXISTS "kind" "public"."organizations_kind_enum" NOT NULL DEFAULT 'SCHOOL',
        ADD COLUMN IF NOT EXISTS "workspace_type" "public"."organizations_workspace_type_enum" NOT NULL DEFAULT 'ACADEMIC',
        ADD COLUMN IF NOT EXISTS "timezone" character varying(64) NOT NULL DEFAULT 'Asia/Dhaka',
        ADD COLUMN IF NOT EXISTS "default_locale" character varying(5) NOT NULL DEFAULT 'bn'
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3b1aee57d246d82c531016e652" ON "organizations" ("kind")`);

    const before = await this.personalCounts(queryRunner);

    // 2. A SOLO organisation (approved, owner = the teacher) for every teacher with personal
    //    teaching switched on or with personal classes or exams, unless they already have one.
    await queryRunner.query(`
      WITH teachers AS (
        SELECT u.id, u.full_name
        FROM users u
        WHERE u.personal_teacher_enabled = true
           OR EXISTS (SELECT 1 FROM classes c WHERE c.organization_id IS NULL AND c.teacher_id = u.id)
           OR EXISTS (SELECT 1 FROM exams e WHERE e.organization_id IS NULL AND e.created_by = u.id)
      ),
      missing AS (
        SELECT gen_random_uuid() AS organization_id, t.id AS user_id,
               COALESCE(NULLIF(TRIM(t.full_name), ''), 'My Teaching') AS name
        FROM teachers t
        WHERE t.id NOT IN (SELECT user_id FROM (${SOLO_OWNERS}) solo)
      ),
      created AS (
        INSERT INTO organizations (id, name, status, kind, created_by, created_user_name, created_at, is_active)
        SELECT organization_id, LEFT(name, 200), 'approved', 'SOLO', user_id, LEFT(name, 100), now(), '1'
        FROM missing
        RETURNING id, created_by, created_user_name
      )
      INSERT INTO organization_members (organization_id, user_id, role, created_by, created_user_name, created_at, is_active)
      SELECT id, created_by, 'OWNER', created_by, created_user_name, now(), '1'
      FROM created
    `);

    // 3. Move personal rows into their teacher's SOLO organisation.
    await queryRunner.query(`
      UPDATE classes c SET organization_id = solo.organization_id
      FROM (${SOLO_OWNERS}) solo
      WHERE c.organization_id IS NULL AND c.teacher_id = solo.user_id
    `);
    // An exam belongs to its class's organisation, otherwise to its creator's SOLO organisation.
    await queryRunner.query(`
      UPDATE exams e SET organization_id = c.organization_id
      FROM classes c
      JOIN organizations o ON o.id = c.organization_id AND o.kind = 'SOLO'
      WHERE e.organization_id IS NULL AND e.class_id = c.id
    `);
    await queryRunner.query(`
      UPDATE exams e SET organization_id = solo.organization_id
      FROM (${SOLO_OWNERS}) solo
      WHERE e.organization_id IS NULL AND e.created_by = solo.user_id
    `);
    for (const table of ['class_discussion_posts', 'class_private_conversations']) {
      await queryRunner.query(`
        UPDATE ${table} t SET organization_id = c.organization_id
        FROM classes c
        JOIN organizations o ON o.id = c.organization_id AND o.kind = 'SOLO'
        WHERE t.organization_id IS NULL AND t.class_id = c.id
      `);
    }

    const after = await this.personalCounts(queryRunner);
    const [{ solo }] = await queryRunner.query(`SELECT COUNT(*)::int AS solo FROM organizations WHERE kind = 'SOLO'`);
    // Count check (design §12): rows still without an organisation should be 0.
    console.log(`[SoloOrganizations] SOLO organisations: ${solo}. Rows without an organisation before -> after:`, before, '->', after);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to personal mode: rows in SOLO organisations lose their organisation again.
    for (const table of ['class_discussion_posts', 'class_private_conversations', 'exams', 'classes']) {
      await queryRunner.query(`
        UPDATE ${table} SET organization_id = NULL
        WHERE organization_id IN (SELECT id FROM organizations WHERE kind = 'SOLO')
      `);
    }
    await queryRunner.query(`DELETE FROM organizations WHERE kind = 'SOLO'`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_3b1aee57d246d82c531016e652"`);
    await queryRunner.query(`
      ALTER TABLE "organizations"
        DROP COLUMN IF EXISTS "default_locale",
        DROP COLUMN IF EXISTS "timezone",
        DROP COLUMN IF EXISTS "workspace_type",
        DROP COLUMN IF EXISTS "kind"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organizations_workspace_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."organizations_kind_enum"`);
  }

  private async personalCounts(queryRunner: QueryRunner): Promise<Record<string, number>> {
    const [row] = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM classes WHERE organization_id IS NULL)::int AS classes,
        (SELECT COUNT(*) FROM exams WHERE organization_id IS NULL)::int AS exams,
        (SELECT COUNT(*) FROM class_discussion_posts WHERE organization_id IS NULL)::int AS discussion_posts,
        (SELECT COUNT(*) FROM class_private_conversations WHERE organization_id IS NULL)::int AS private_conversations
    `);
    return row;
  }
}
