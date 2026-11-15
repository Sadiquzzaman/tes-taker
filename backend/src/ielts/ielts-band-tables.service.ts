import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { IELTS_DEFAULT_BAND_TABLES } from './band-table-defaults';
import { BandRow, bandFromRaw, isValidBandTable } from './bands';
import { IeltsBandTableScopeDto, UpdateIeltsBandTableDto } from './dto/ielts-band-table.dto';
import { IeltsBandTableEntity } from './entities/ielts-band-table.entity';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';

type Scope = { module: IeltsModuleEnum.LISTENING | IeltsModuleEnum.READING; test_type: IeltsTestTypeEnum | null };

export interface IeltsBandTableView extends Scope {
  rows: BandRow[];
  /** The centre changed this table (its rows differ from the platform default). */
  customised: boolean;
  updated_at: Date | null;
}

/** The three tables every centre has: Listening, Academic Reading, General Training Reading. */
const SCOPES: Scope[] = [
  { module: IeltsModuleEnum.LISTENING, test_type: null },
  { module: IeltsModuleEnum.READING, test_type: IeltsTestTypeEnum.ACADEMIC },
  { module: IeltsModuleEnum.READING, test_type: IeltsTestTypeEnum.GENERAL },
];

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

/**
 * Raw → band tables (IEL-04, IEL-05). Every centre starts on the platform defaults; owners and
 * admins edit a table, which saves the centre's own copy, and can put it back to the default.
 * Listening and Reading scoring (P10-04) reads bands through `bandFor`.
 */
@Injectable()
export class IeltsBandTablesService implements OnModuleInit {
  constructor(
    @InjectRepository(IeltsBandTableEntity) private readonly tables: Repository<IeltsBandTableEntity>,
    private readonly profiles: IeltsProfilesService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    // Seeding runs in the API process only; the worker boots at the same time (worker.ts).
    if (process.env.APP_ROLE === 'worker') return;
    await this.seedDefaults();
  }

  /** Adds the platform default tables that do not exist yet; existing ones are never changed. */
  async seedDefaults(): Promise<void> {
    for (const table of IELTS_DEFAULT_BAND_TABLES) {
      const scope: Scope = { module: table.module, test_type: table.test_type };
      if (await this.tables.exists({ where: { organization_id: IsNull(), ...this.where(scope) } })) continue;
      await this.tables.save(this.tables.create({ organization_id: null, ...scope, rows: table.rows }));
    }
  }

  /** Staff: the centre's three tables (its own copy or the default). */
  async list(tenant: Tenant): Promise<IeltsBandTableView[]> {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
    const rows = await this.tables.find({ where: [{ organization_id: tenant.organizationId }, { organization_id: IsNull() }] });
    return SCOPES.map((scope) => this.view(scope, rows));
  }

  /** Owners and admins: save the centre's own copy of one table (audited). */
  async update(tenant: Tenant, userId: string, dto: UpdateIeltsBandTableDto): Promise<IeltsBandTableView> {
    const scope = await this.prepare(tenant, dto);
    if (!isValidBandTable(dto.rows)) {
      throw new BadRequestException({ message: 'A band table runs from 40 down to 0 with bands that never go up', code: IELTS_ERRORS.BAND_TABLE_INVALID });
    }
    return this.save(tenant, userId, scope, dto.rows.map((row) => ({ min_raw: row.min_raw, band: row.band })));
  }

  /** Owners and admins: put one table back to the platform default (audited; the row is kept). */
  async reset(tenant: Tenant, userId: string, dto: IeltsBandTableScopeDto): Promise<IeltsBandTableView> {
    const scope = await this.prepare(tenant, dto);
    const platform = await this.tables.findOneOrFail({ where: { organization_id: IsNull(), ...this.where(scope) } });
    return this.save(tenant, userId, scope, platform.rows);
  }

  /** The band for a raw Listening / Reading score in a centre (its own table, else the default). */
  async bandFor(organizationId: string, module: Scope['module'], testType: IeltsTestTypeEnum, raw: number): Promise<number> {
    const scope: Scope = { module, test_type: module === IeltsModuleEnum.READING ? testType : null };
    const rows = await this.tables.find({ where: [{ organization_id: organizationId, ...this.where(scope) }, { organization_id: IsNull(), ...this.where(scope) }] });
    const table = rows.find((r) => r.organization_id === organizationId) ?? rows[0];
    return bandFromRaw(table?.rows ?? [], raw);
  }

  // ------------------------------------------------------------------ helpers

  private async prepare(tenant: Tenant, dto: IeltsBandTableScopeDto): Promise<Scope> {
    if (!tenant.memberRole || !MANAGERS.includes(tenant.memberRole) || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only owners and admins can change band tables', code: IELTS_ERRORS.MANAGERS_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
    const scope = SCOPES.find((s) => s.module === dto.module && s.test_type === (dto.module === IeltsModuleEnum.READING ? (dto.test_type ?? null) : null));
    if (!scope || (dto.module === IeltsModuleEnum.LISTENING && dto.test_type)) {
      throw new BadRequestException({ message: 'Reading needs Academic or General Training; Listening has one table', code: IELTS_ERRORS.BAND_TABLE_INVALID });
    }
    return scope;
  }

  private async save(tenant: Tenant, userId: string, scope: Scope, rows: BandRow[]): Promise<IeltsBandTableView> {
    const existing = await this.tables.findOne({ where: { organization_id: tenant.organizationId, ...this.where(scope) } });
    const saved = await this.tables.save(
      this.tables.create({
        ...(existing ?? { organization_id: tenant.organizationId, module: scope.module, test_type: scope.test_type }),
        rows,
        updated_by: userId,
        updated_at: new Date(),
      }),
    );
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_BAND_TABLE_UPDATE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_band_table',
      entityId: saved.id,
      before: existing ? { rows: existing.rows } : null,
      after: { module: scope.module, test_type: scope.test_type, rows },
    });
    const platform = await this.tables.find({ where: { organization_id: IsNull(), ...this.where(scope) } });
    return this.view(scope, [saved, ...platform]);
  }

  private where(scope: Scope) {
    return { module: scope.module, test_type: scope.test_type ?? IsNull() };
  }

  private view(scope: Scope, rows: IeltsBandTableEntity[]): IeltsBandTableView {
    const matches = rows.filter((r) => r.module === scope.module && (r.test_type ?? null) === scope.test_type);
    const own = matches.find((r) => r.organization_id !== null);
    const platform = matches.find((r) => r.organization_id === null);
    const table = own ?? platform;
    return {
      ...scope,
      rows: table?.rows ?? [],
      customised: !!own && JSON.stringify(own.rows) !== JSON.stringify(platform?.rows),
      updated_at: own?.updated_at ?? null,
    };
  }
}
