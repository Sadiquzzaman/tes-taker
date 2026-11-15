import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { CreateIeltsAssignmentDto, UpdateIeltsAssignmentDto } from './dto/ielts-attempt.dto';
import { IeltsAssignmentEntity } from './entities/ielts-assignment.entity';
import { overallBand } from './bands';
import { IeltsAttemptEntity, IeltsAttemptStatusEnum } from './entities/ielts-attempt.entity';
import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsTestEntity, IeltsTestStatusEnum } from './entities/ielts-test.entity';
import { IeltsAttemptsService } from './ielts-attempts.service';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';
import { MODULE_ORDER } from './ielts-templates';

export interface IeltsAssignmentView {
  id: string;
  test_id: string;
  section: { id: string; name: string };
  opens_at: Date;
  closes_at: Date;
  students: number;
  /** Students who handed in each module. */
  submitted: Partial<Record<IeltsModuleEnum, number>>;
}

export interface IeltsResultRow {
  student: { id: string; full_name: string };
  /** All four modules marked: their average to the nearest half band (IEL-08). */
  overall: number | null;
  modules: Partial<Record<IeltsModuleEnum, { attempt_id: string; status: string; mode: string | null; raw_score: number | null; band: number | null; submitted_at: Date | null }>>;
}

/**
 * Opening published IELTS tests for batches (IEL-08) and their results, for the centre's staff.
 * Removing an opening hides it from students; attempts are kept.
 */
@Injectable()
export class IeltsAssignmentsService {
  constructor(
    @InjectRepository(IeltsAssignmentEntity) private readonly assignments: Repository<IeltsAssignmentEntity>,
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly attempts: IeltsAttemptsService,
  ) {}

  async create(tenant: Tenant, userId: string, testId: string, dto: CreateIeltsAssignmentDto): Promise<IeltsAssignmentView> {
    await this.assertStaff(tenant);
    const test = await this.dataSource.getRepository(IeltsTestEntity).findOne({ where: { id: testId, organization_id: tenant.organizationId, deleted_at: IsNull() } });
    if (!test) throw new NotFoundException({ message: 'Test not found', code: IELTS_ERRORS.TEST_NOT_FOUND });
    if (test.status !== IeltsTestStatusEnum.PUBLISHED) this.invalid('Publish the test before opening it for a batch');
    const [section] = await this.dataSource.query(`SELECT id FROM sections WHERE id = $1 AND organization_id = $2`, [dto.section_id, tenant.organizationId]);
    if (!section) this.invalid('Choose a batch of this centre');
    const window = this.window(dto.opens_at, dto.closes_at);
    const saved = await this.assignments.save(
      this.assignments.create({ organization_id: tenant.organizationId, test_id: test.id, section_id: dto.section_id, ...window, created_by: userId }),
    );
    return (await this.views(tenant.organizationId, [saved]))[0];
  }

  /** Staff: a test's openings, with batch size and hand-ins per module. */
  async list(tenant: Tenant, testId: string): Promise<IeltsAssignmentView[]> {
    await this.assertStaff(tenant);
    const rows = await this.assignments.find({ where: { test_id: testId, organization_id: tenant.organizationId, deleted_at: IsNull() }, order: { opens_at: 'DESC' } });
    return this.views(tenant.organizationId, rows);
  }

  async update(tenant: Tenant, assignmentId: string, dto: UpdateIeltsAssignmentDto): Promise<IeltsAssignmentView> {
    await this.assertStaff(tenant);
    const row = await this.find(tenant, assignmentId);
    const window = this.window(dto.opens_at ?? row.opens_at.toISOString(), dto.closes_at ?? row.closes_at.toISOString());
    await this.assignments.update({ id: row.id }, window);
    return (await this.views(tenant.organizationId, [{ ...row, ...window }]))[0];
  }

  /** Hides an opening from students (kept with its attempts). */
  async remove(tenant: Tenant, userId: string, assignmentId: string): Promise<void> {
    await this.assertStaff(tenant);
    const row = await this.find(tenant, assignmentId);
    await this.assignments.update({ id: row.id }, { deleted_at: new Date(), deleted_by: userId });
  }

  /** Staff: each student of the batch with their result per module (expired attempts are handed in first). */
  async results(tenant: Tenant, assignmentId: string): Promise<IeltsResultRow[]> {
    await this.assertStaff(tenant);
    const row = await this.find(tenant, assignmentId);
    await this.attempts.finishExpired({ assignmentId: row.id });
    const students: { id: string; full_name: string }[] = await this.dataSource.query(
      `SELECT u.id, u.full_name FROM enrolments e JOIN users u ON u.id = e.student_id
        WHERE e.section_id = $1 AND e.organization_id = $2 AND e.status = 'ACTIVE' ORDER BY u.full_name`,
      [row.section_id, tenant.organizationId],
    );
    const attempts = await this.dataSource.getRepository(IeltsAttemptEntity).find({ where: { assignment_id: row.id } });
    return students.map((student) => {
      const mine = attempts.filter((a) => a.student_id === student.id);
      const bands = MODULE_ORDER.map((m) => mine.find((a) => a.module === m && a.status === IeltsAttemptStatusEnum.MARKED)?.band ?? null);
      return {
      student,
      overall: bands.every((b) => b !== null) ? overallBand(bands.map(Number)) : null,
      modules: Object.fromEntries(
        attempts
          .filter((a) => a.student_id === student.id)
          .map((a) => [a.module, { attempt_id: a.id, status: a.status, mode: a.mode, raw_score: a.raw_score, band: a.band === null ? null : Number(a.band), submitted_at: a.submitted_at }]),
      ),
      };
    });
  }

  // ------------------------------------------------------------------ helpers

  private async assertStaff(tenant: Tenant): Promise<void> {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
  }

  private async find(tenant: Tenant, assignmentId: string): Promise<IeltsAssignmentEntity> {
    const row = await this.assignments.findOne({ where: { id: assignmentId, organization_id: tenant.organizationId, deleted_at: IsNull() } });
    if (!row) throw new NotFoundException({ message: 'Opening not found', code: IELTS_ERRORS.ASSIGNMENT_NOT_FOUND });
    return row;
  }

  private window(opensAt: string, closesAt: string): { opens_at: Date; closes_at: Date } {
    const opens_at = new Date(opensAt);
    const closes_at = new Date(closesAt);
    if (!(closes_at > opens_at)) this.invalid('The test must close after it opens');
    return { opens_at, closes_at };
  }

  private async views(organizationId: string, rows: IeltsAssignmentEntity[]): Promise<IeltsAssignmentView[]> {
    if (!rows.length) return [];
    const sections: { id: string; name: string; students: number }[] = await this.dataSource.query(
      `SELECT s.id, trim(concat(c.class_name, ' ', s.name)) AS name,
              (SELECT count(*)::int FROM enrolments e WHERE e.section_id = s.id AND e.status = 'ACTIVE') AS students
         FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = ANY($1::uuid[]) AND s.organization_id = $2`,
      [[...new Set(rows.map((r) => r.section_id))], organizationId],
    );
    const counts: { assignment_id: string; module: IeltsModuleEnum; n: number }[] = await this.dataSource.query(
      `SELECT assignment_id, module, count(*)::int AS n FROM ielts_attempts WHERE assignment_id = ANY($1::uuid[]) AND status <> 'IN_PROGRESS' GROUP BY assignment_id, module`,
      [rows.map((r) => r.id)],
    );
    return rows.map((r) => {
      const section = sections.find((s) => s.id === r.section_id);
      return {
        id: r.id,
        test_id: r.test_id,
        section: { id: r.section_id, name: section?.name ?? '' },
        opens_at: r.opens_at,
        closes_at: r.closes_at,
        students: section?.students ?? 0,
        submitted: Object.fromEntries(counts.filter((c) => c.assignment_id === r.id).map((c) => [c.module, c.n])),
      };
    });
  }

  private invalid(message: string): never {
    throw new BadRequestException({ message, code: IELTS_ERRORS.ASSIGNMENT_INVALID });
  }
}
