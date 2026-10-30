import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE_COLUMNS = `
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_by" uuid, "created_user_name" character varying(100),
  "updated_by" uuid, "updated_user_name" character varying(100),
  "created_at" TIMESTAMP, "updated_at" TIMESTAMP`;

/** Bangladesh national grading (FND-11), as in BANGLADESH_NATIONAL_BANDS. */
const BANGLADESH_BANDS: Array<[number, number, string, number]> = [
  [80, 100, 'A+', 5],
  [70, 79.99, 'A', 4],
  [60, 69.99, 'A-', 3.5],
  [50, 59.99, 'B', 3],
  [40, 49.99, 'C', 2],
  [33, 39.99, 'D', 1],
  [0, 32.99, 'F', 0],
];

/**
 * Grading scales (P2-06, FND-11; design §9 grading_scales, grading_bands).
 *
 * New tables, plus the platform default scale (Bangladesh national, organization_id NULL,
 * is_default) with its seven bands. Organisations get their own scale only when they edit
 * the bands. Rows are never deleted: a replaced or reset scale is deactivated
 * (is_active '0', deactivated_at/by), and a partial unique index allows one active scale per
 * organisation. No existing data is touched. Safe to run twice.
 */
export class GradingScales1755700000000 implements MigrationInterface {
  name = 'GradingScales1755700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['grading_scales', 'grading_bands']) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."${table}_is_active_enum" AS ENUM('1', '0');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grading_scales" (${BASE_COLUMNS},
        "is_active" "public"."grading_scales_is_active_enum" NOT NULL DEFAULT '1',
        "organization_id" uuid, "name" character varying(60) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "deactivated_at" TIMESTAMP WITH TIME ZONE, "deactivated_by" uuid,
        CONSTRAINT "PK_29f2b70456707ef17e019b5e770" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grading_scales_active_org" ON "grading_scales" ("organization_id")
      WHERE "organization_id" IS NOT NULL AND "is_active" = '1'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grading_scales_platform_default" ON "grading_scales" ("is_default")
      WHERE "is_default" = true AND "is_active" = '1'
    `);
    await this.addConstraint(queryRunner, 'grading_scales', 'FK_9f989a2439600de04077327302d',
      `FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "grading_bands" (${BASE_COLUMNS},
        "is_active" "public"."grading_bands_is_active_enum" NOT NULL DEFAULT '1',
        "scale_id" uuid NOT NULL, "min_pct" numeric(5,2) NOT NULL, "max_pct" numeric(5,2) NOT NULL,
        "grade" character varying(5) NOT NULL, "gpa" numeric(3,2),
        CONSTRAINT "PK_fba41be974b8167ac6c6fd950aa" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1eabdbd1834e36f024ea97a74b" ON "grading_bands" ("scale_id")`);
    await this.addConstraint(queryRunner, 'grading_bands', 'FK_1eabdbd1834e36f024ea97a74b5',
      `FOREIGN KEY ("scale_id") REFERENCES "grading_scales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // The platform default, only if there is none (a second run, or one edited later, is kept).
    const values = BANGLADESH_BANDS.map(([min, max, grade, gpa]) => `(${min}, ${max}, '${grade}', ${gpa})`).join(', ');
    await queryRunner.query(`
      WITH scale AS (
        INSERT INTO grading_scales (organization_id, name, is_default, created_user_name, created_at, is_active)
        SELECT NULL, 'Bangladesh national', true, 'Migration P2-06', now(), '1'
        WHERE NOT EXISTS (SELECT 1 FROM grading_scales WHERE is_default = true AND is_active = '1')
        RETURNING id
      )
      INSERT INTO grading_bands (scale_id, min_pct, max_pct, grade, gpa, created_user_name, created_at, is_active)
      SELECT scale.id, b.min_pct, b.max_pct, b.grade, b.gpa, 'Migration P2-06', now(), '1'
      FROM scale CROSS JOIN (VALUES ${values}) AS b(min_pct, max_pct, grade, gpa)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "grading_bands"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grading_scales"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."grading_bands_is_active_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."grading_scales_is_active_enum"`);
  }

  private async addConstraint(queryRunner: QueryRunner, table: string, name: string, definition: string): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
        END IF;
      END $$;
    `);
  }
}
