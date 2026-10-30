import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { AcademicSessionsService } from './academic-sessions.service';
import { SectionEntity } from './entities/section.entity';

export interface SetupClassView {
  id: string;
  name: string;
  subject_count: number;
  section_count: number;
}

export interface SetupSummary {
  setup_completed_at: Date | null;
  /** The default session, where the wizard sets up sections. */
  session: { id: string; name: string; start_date: string; end_date: string };
  classes: SetupClassView[];
}

/**
 * The academic setup wizard (P2-04, FND-02) of a school or coaching centre: what is set up so far,
 * and finishing it. The structure itself is written through the class and section endpoints.
 */
@Injectable()
export class AcademicSetupService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    private readonly sessions: AcademicSessionsService,
    private readonly settings: OrgSettingsService,
  ) {}

  async summary(): Promise<SetupSummary> {
    const organizationId = this.requireOrganisation();
    const session = await this.sessions.ensureDefault(organizationId);
    const classes = await tenantScoped(this.classRepo).find({ order: { class_name: 'ASC' } });
    const ids = classes.map((c) => c.id);
    const [subjects, sections]: [ClassSubjectEntity[], SectionEntity[]] = ids.length
      ? await Promise.all([
          this.classSubjectRepo.find({ where: { class_id: In(ids) }, select: ['id', 'class_id'] }),
          tenantScoped(this.sectionRepo).find({ where: { class_id: In(ids), session_id: session.id }, select: ['id', 'class_id'] }),
        ])
      : [[], []];
    const settings = await this.settings.get(organizationId);
    return {
      setup_completed_at: settings.setup_completed_at,
      session: { id: session.id, name: session.name, start_date: session.start_date, end_date: session.end_date },
      classes: classes.map((c) => ({
        id: c.id,
        name: c.class_name,
        subject_count: subjects.filter((s) => s.class_id === c.id).length,
        section_count: sections.filter((s) => s.class_id === c.id).length,
      })),
    };
  }

  /** Finishes the setup: at least one class, and every class has a section in the default session. */
  async complete(userId: string): Promise<SetupSummary> {
    const organizationId = this.requireOrganisation();
    const summary = await this.summary();
    if (summary.classes.length === 0) {
      throw new BadRequestException('Add at least one class before finishing the setup');
    }
    const withoutSection = summary.classes.find((c) => c.section_count === 0);
    if (withoutSection) {
      throw new BadRequestException(`Add a section to ${withoutSection.name} before finishing the setup`);
    }
    await this.settings.markSetupComplete(organizationId, userId);
    return this.summary();
  }

  /** Schools and coaching centres only: a solo teacher's workspace has no setup wizard (owner decision). */
  private requireOrganisation(): string {
    const tenant = TenantContext.current();
    if (!tenant) throw new BadRequestException('Choose a workspace first');
    if (tenant.kind === OrganizationKindEnum.SOLO) {
      throw new BadRequestException('The setup wizard is for schools and coaching centres');
    }
    return tenant.organizationId;
  }
}
