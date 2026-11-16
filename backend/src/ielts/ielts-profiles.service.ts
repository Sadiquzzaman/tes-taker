import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { WorkspaceTypeEnum } from 'src/organizations/enums/workspace-type.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { isBand } from './bands';
import { UpdateIeltsProfileDto } from './dto/ielts-profile.dto';
import { IeltsModuleEnum, IeltsProfileEntity, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IELTS_ERRORS } from './ielts-errors';

export interface IeltsProfileView {
  student: { id: string; full_name: string; batch: string | null };
  test_type: IeltsTestTypeEnum | null;
  target_overall: number | null;
  target_bands: Partial<Record<IeltsModuleEnum, number>>;
  test_date: string | null;
  /** Days until the booked test (negative once it has passed). */
  days_to_test: number | null;
  updated_at: Date | null;
}

/**
 * IELTS student profiles (Epic 11, IEL-02): test type, target bands and the booked test date.
 * Staff of an IELTS centre see and change every student's; a student sees their own. IELTS
 * centres only (403 IELTS_ONLY_CENTRES elsewhere).
 */
@Injectable()
export class IeltsProfilesService {
  constructor(
    @InjectRepository(IeltsProfileEntity) private readonly profiles: Repository<IeltsProfileEntity>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** The request's organisation is an IELTS centre (workspace type IELTS). */
  async assertIeltsCentre(tenant: Tenant): Promise<void> {
    const [row] = await this.dataSource.query(`SELECT workspace_type FROM organizations WHERE id = $1`, [tenant.organizationId]);
    if (row?.workspace_type !== WorkspaceTypeEnum.IELTS) {
      throw new ForbiddenException({ message: 'IELTS pages are for IELTS centres', code: IELTS_ERRORS.ONLY_IELTS_CENTRES });
    }
  }

  /** Staff: the centre's students (or one batch's) with their profiles, by name. */
  async list(tenant: Tenant, sectionId?: string): Promise<IeltsProfileView[]> {
    this.assertStaff(tenant);
    await this.assertIeltsCentre(tenant);
    const students = await this.students(tenant.organizationId, sectionId);
    const rows = students.length ? await this.profiles.find({ where: { organization_id: tenant.organizationId, student_id: In(students.map((s) => s.id)) } }) : [];
    const byStudent = new Map(rows.map((r) => [r.student_id, r]));
    return students.map((s) => this.view(s, byStudent.get(s.id) ?? null));
  }

  /** One student's profile: staff any student of the centre, a student their own. */
  async get(tenant: Tenant, userId: string, studentId: string): Promise<IeltsProfileView> {
    await this.assertIeltsCentre(tenant);
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT && studentId !== userId) this.notFound();
    const [student] = await this.students(tenant.organizationId, undefined, studentId);
    if (!student) this.notFound();
    const row = await this.profiles.findOne({ where: { organization_id: tenant.organizationId, student_id: studentId } });
    return this.view(student, row);
  }

  /** Staff set a student's test type, targets and test date (audited). */
  async update(tenant: Tenant, userId: string, studentId: string, dto: UpdateIeltsProfileDto): Promise<IeltsProfileView> {
    this.assertStaff(tenant);
    await this.assertIeltsCentre(tenant);
    const [student] = await this.students(tenant.organizationId, undefined, studentId);
    if (!student) this.notFound();
    if (dto.target_overall !== undefined && dto.target_overall !== null && !isBand(dto.target_overall)) this.badBand();
    const targets: Partial<Record<IeltsModuleEnum, number>> = {};
    for (const [module, band] of Object.entries(dto.target_bands ?? {})) {
      if (!Object.values(IeltsModuleEnum).includes(module as IeltsModuleEnum)) this.badBand();
      if (band === null || band === undefined) continue;
      if (!isBand(band)) this.badBand();
      targets[module as IeltsModuleEnum] = band;
    }
    const existing = await this.profiles.findOne({ where: { organization_id: tenant.organizationId, student_id: studentId } });
    const before = existing ? this.view(student, existing) : null;
    const saved = await this.profiles.save(
      this.profiles.create({
        ...(existing ?? { organization_id: tenant.organizationId, student_id: studentId }),
        ...(dto.test_type !== undefined ? { test_type: dto.test_type } : {}),
        ...(dto.target_overall !== undefined ? { target_overall: dto.target_overall === null ? null : String(dto.target_overall) } : {}),
        ...(dto.target_bands !== undefined ? { target_bands: targets } : {}),
        ...(dto.test_date !== undefined ? { test_date: dto.test_date ? dto.test_date.slice(0, 10) : null } : {}),
        updated_by: userId,
        updated_at: new Date(),
      }),
    );
    const after = this.view(student, saved);
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_PROFILE_UPDATE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_profile',
      entityId: saved.id,
      before: before ? { test_type: before.test_type, target_overall: before.target_overall, target_bands: before.target_bands, test_date: before.test_date } : null,
      after: { student_id: studentId, test_type: after.test_type, target_overall: after.target_overall, target_bands: after.target_bands, test_date: after.test_date },
    });
    return after;
  }

  // ------------------------------------------------------------------ helpers

  private assertStaff(tenant: Tenant): void {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
  }

  /** Active students of the centre (in one batch, or one student), with their batch. */
  private async students(organizationId: string, sectionId?: string, studentId?: string): Promise<{ id: string; full_name: string; batch: string | null }[]> {
    const rows: { id: string; full_name: string; batch: string | null }[] = await this.dataSource.query(
      `SELECT DISTINCT ON (u.id) u.id, u.full_name, trim(concat(c.class_name, ' ', s.name)) AS batch
         FROM enrolments e
         JOIN users u ON u.id = e.student_id
         JOIN sections s ON s.id = e.section_id
         JOIN classes c ON c.id = s.class_id
         JOIN academic_sessions ses ON ses.id = s.session_id AND ses.status = 'ACTIVE'
        WHERE e.organization_id = $1 AND e.status = 'ACTIVE'
          AND ($2::uuid IS NULL OR e.section_id = $2) AND ($3::uuid IS NULL OR e.student_id = $3)
        ORDER BY u.id, s.name`,
      [organizationId, sectionId ?? null, studentId ?? null],
    );
    return rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  private view(student: { id: string; full_name: string; batch: string | null }, row: IeltsProfileEntity | null): IeltsProfileView {
    const testDate = row?.test_date ?? null;
    return {
      student,
      test_type: row?.test_type ?? null,
      target_overall: row?.target_overall === null || row?.target_overall === undefined ? null : Number(row.target_overall),
      target_bands: row?.target_bands ?? {},
      test_date: testDate,
      days_to_test: testDate ? Math.round((Date.parse(`${testDate}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000) : null,
      updated_at: row?.updated_at ?? null,
    };
  }

  private badBand(): never {
    throw new BadRequestException({ message: 'A band is 0 to 9 in half bands', code: IELTS_ERRORS.BAND_INVALID });
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Student not found', code: IELTS_ERRORS.STUDENT_NOT_FOUND });
  }
}
