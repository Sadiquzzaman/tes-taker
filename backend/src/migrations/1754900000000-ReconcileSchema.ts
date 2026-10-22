import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings every database to the same schema after BaselineSchema1753000000000:
 *
 * 1. Removes objects the older migrations created under their own names next to the
 *    entity-named (FK_/IDX_<hash>) ones the baseline already made. On an empty database
 *    they are duplicates; on beta `synchronize` already removed them, so these drops do nothing.
 * 2. organizations.organization_number: nullable, no default, as the entity declares
 *    (PublicIdService assigns it). The sequence stays: PublicIdService still advances it.
 *    Also drops UQ_organizations_organization_number, an exact copy of the entity's unique constraint.
 * 3. Restores the rules `synchronize` dropped on beta:
 *    - one pending teacher-role request per user;
 *    - organization subjects unique by (organization, name, code) ignoring case.
 *    Each stops with a clear error if existing rows break the rule.
 */
const DUPLICATE_FOREIGN_KEYS: Array<[table: string, constraint: string]> = [
  ['subjects', 'FK_subjects_organization'],
  ['exam_questions', 'FK_exam_questions_subject_id'],
  ['classes', 'FK_classes_organization'],
  ['exams', 'FK_exams_organization'],
];

const DUPLICATE_INDEXES = [
  'IDX_teacher_role_requests_user_id',
  'IDX_teacher_role_requests_status',
  'IDX_organizations_name',
  'IDX_organizations_status',
  'IDX_organizations_organization_number',
  'IDX_subjects_organization_id',
  'IDX_organization_members_org',
  'IDX_organization_members_user',
  'IDX_exam_questions_subject_id',
  'IDX_exams_exam_category',
  'IDX_class_private_conversations_class_subject',
  'IDX_class_private_messages_conversation_created',
  'IDX_class_discussion_comments_post_created',
  'IDX_class_discussion_posts_class_subject_created',
  'IDX_class_discussion_posts_author',
];

export class ReconcileSchema1754900000000 implements MigrationInterface {
  name = 'ReconcileSchema1754900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Duplicates left by the older migrations
    for (const [table, constraint] of DUPLICATE_FOREIGN_KEYS) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`);
    }
    for (const index of DUPLICATE_INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
    }

    // 2) organization_number as the entity declares it
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "organization_number" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "organization_number" DROP NOT NULL`);
    await queryRunner.query(`ALTER SEQUENCE IF EXISTS "organizations_organization_number_seq" OWNED BY NONE`);
    // On a new database, give the sequence the range PublicIdService creates it with.
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM "organizations")
          AND EXISTS (
            SELECT 1 FROM pg_sequence
            WHERE seqrelid = to_regclass('organizations_organization_number_seq') AND seqmin < 100001
          ) THEN
          ALTER SEQUENCE "organizations_organization_number_seq"
            MINVALUE 100001 START WITH 100001 RESTART WITH 100001;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "UQ_organizations_organization_number"`,
    );

    // 3a) One pending teacher-role request per user
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "teacher_role_requests"
          WHERE "status" = 'pending'
          GROUP BY "user_id" HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'ReconcileSchema: some users have more than one pending teacher request; resolve them before migrating';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_role_requests_pending_user"
      ON "teacher_role_requests" ("user_id")
      WHERE "status" = 'pending'
    `);

    // 3b) Organization subjects: unique by (organization, name, code), ignoring case
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "subjects"
          WHERE "organization_id" IS NOT NULL
          GROUP BY "organization_id", LOWER("name"), LOWER("code") HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'ReconcileSchema: an organization has subjects whose name and code differ only by case; resolve them before migrating';
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_org_name_code"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_subjects_org_name_code"
      ON "subjects" ("organization_id", LOWER("name"), LOWER("code"))
      WHERE "organization_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back to the schema beta had before this migration. The duplicates are not recreated.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_subjects_org_name_code"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_subjects_org_name_code"
      ON "subjects" ("organization_id", "name", "code")
      WHERE "organization_id" IS NOT NULL
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_role_requests_pending_user"`);
  }
}
