import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The resource library (P9-03, RES-01, RES-03 to RES-06). Owned by the resources module.
 *
 * `resource_folders`: a teacher's own folders (one level).
 * `resources`: a file (an upload of the files module, purpose RESOURCE) or a link, with title,
 * description, subject, folder, tags, whether students may download it, archived (hidden from
 * students, kept) and soft delete.
 * `resource_shares`: the subject classes (section + subject) it is shared with.
 * `resource_views`: when each student first and last opened it, and how often (watch % comes with
 * video upload).
 *
 * New empty tables; no existing row changes. Safe to run twice; logs a count check.
 */
export class ResourceLibrary1756440000000 implements MigrationInterface {
  name = 'ResourceLibrary1756440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_folders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_resource_folders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_resource_folders_owner" ON "resource_folders" ("organization_id", "owner_id")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "type" character varying(10) NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "subject_id" uuid,
        "folder_id" uuid,
        "file_id" uuid,
        "url" character varying(1000),
        "tags" jsonb NOT NULL DEFAULT '[]',
        "download_allowed" boolean NOT NULL DEFAULT true,
        "archived_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        CONSTRAINT "PK_resources" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_resources_type" CHECK ("type" IN ('FILE', 'VIDEO', 'LINK')),
        CONSTRAINT "CHK_resources_source" CHECK (("type" = 'LINK' AND "url" IS NOT NULL) OR ("type" <> 'LINK' AND "file_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_resources_org_created" ON "resources" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_resources_owner" ON "resources" ("organization_id", "created_by")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_shares" (
        "resource_id" uuid NOT NULL,
        "offering_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resource_shares" PRIMARY KEY ("resource_id", "offering_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_resource_shares_offering" ON "resource_shares" ("offering_id")`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "resource_views" (
        "resource_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "first_opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "opens" integer NOT NULL DEFAULT 1,
        "watch_pct" smallint,
        CONSTRAINT "PK_resource_views" PRIMARY KEY ("resource_id", "student_id")
      )
    `);
    for (const [table, name, definition] of [
      ['resource_folders', 'FK_resource_folders_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resource_folders', 'FK_resource_folders_owner', `FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resources', 'FK_resources_organization', `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resources', 'FK_resources_subject', `FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['resources', 'FK_resources_folder', `FOREIGN KEY ("folder_id") REFERENCES "resource_folders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['resources', 'FK_resources_file', `FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`],
      ['resources', 'FK_resources_creator', `FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resource_shares', 'FK_resource_shares_resource', `FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resource_shares', 'FK_resource_shares_offering', `FOREIGN KEY ("offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resource_views', 'FK_resource_views_resource', `FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
      ['resource_views', 'FK_resource_views_student', `FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`],
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
      `SELECT (SELECT count(*)::int FROM resource_folders) AS folders, (SELECT count(*)::int FROM resources) AS resources,
              (SELECT count(*)::int FROM resource_shares) AS shares, (SELECT count(*)::int FROM resource_views) AS views`,
    );
    console.log(`[ResourceLibrary] folders: ${counts.folders}, resources: ${counts.resources}, shares: ${counts.shares}, views: ${counts.views}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_views"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_shares"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resources"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resource_folders"`);
  }
}
