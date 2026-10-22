import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Sequential human-readable public IDs via PostgreSQL sequences.
 * UUID remains the internal PK / security boundary.
 *
 * organization → 100001+
 * teacher      → 10001+
 * student      → 1000001+
 *
 * Sequences are ensured at runtime (no migration required for synchronize/dev).
 */
@Injectable()
export class PublicIdService implements OnModuleInit {
  private readonly logger = new Logger(PublicIdService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureSequences();
    } catch (error) {
      this.logger.warn(
        `Could not ensure public ID sequences on boot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async ensureSequences(): Promise<void> {
    await this.dataSource.query(`
      CREATE SEQUENCE IF NOT EXISTS organization_public_id_seq
        AS BIGINT INCREMENT BY 1 MINVALUE 100001 START WITH 100001
    `);
    await this.dataSource.query(`
      CREATE SEQUENCE IF NOT EXISTS teacher_public_id_seq
        AS BIGINT INCREMENT BY 1 MINVALUE 10001 START WITH 10001
    `);
    await this.dataSource.query(`
      CREATE SEQUENCE IF NOT EXISTS student_public_id_seq
        AS BIGINT INCREMENT BY 1 MINVALUE 1000001 START WITH 1000001
    `);
    // Keep legacy org number sequence in sync for convenience login.
    await this.dataSource.query(`
      CREATE SEQUENCE IF NOT EXISTS organizations_organization_number_seq
        AS BIGINT INCREMENT BY 1 MINVALUE 100001 START WITH 100001
    `);
  }

  private async nextVal(sequenceName: string): Promise<string> {
    await this.ensureSequences();
    const rows = await this.dataSource.query(
      `SELECT nextval($1) AS num`,
      [sequenceName],
    );
    return String(rows?.[0]?.num ?? rows?.[0]?.nextval);
  }

  /** Organization public ID: 100001, 100002, ... */
  async nextOrganizationPublicId(): Promise<string> {
    // Prefer dedicated sequence; also advance legacy number sequence for parity.
    const id = await this.nextVal('organization_public_id_seq');
    try {
      await this.dataSource.query(
        `SELECT setval('organizations_organization_number_seq', GREATEST($1::bigint, COALESCE((SELECT last_value FROM organizations_organization_number_seq), 100000)), true)`,
        [id],
      );
    } catch {
      // Legacy sequence may be unavailable; organization_number can reuse this id.
    }
    return id;
  }

  /** Teacher public ID: 10001, 10002, ... */
  async nextTeacherPublicId(): Promise<string> {
    return this.nextVal('teacher_public_id_seq');
  }

  /** Student public ID: 1000001, 1000002, ... */
  async nextStudentPublicId(): Promise<string> {
    return this.nextVal('student_public_id_seq');
  }
}
