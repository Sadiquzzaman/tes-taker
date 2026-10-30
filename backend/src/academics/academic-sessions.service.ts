import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from './entities/academic-session.entity';
import { TermEntity } from './entities/term.entity';
import { CreateAcademicSessionDto, CreateTermDto, UpdateAcademicSessionDto, UpdateTermDto } from './dto/session.dto';

interface Actor {
  id: string;
  full_name?: string | null;
}

/** The calendar year "today" in a time zone (sessions are school dates in the organisation's zone). */
export const currentYearIn = (timeZone: string, now = new Date()): number => {
  try {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(now));
  } catch {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric' }).format(now));
  }
};

/**
 * Academic sessions and their terms (FND-01). Every organisation has exactly one default session;
 * it is created on first use ("this year" in the organisation's time zone). A closed session is
 * read-only: nothing new is added to it until the Owner reopens it.
 */
@Injectable()
export class AcademicSessionsService {
  constructor(
    @InjectRepository(AcademicSessionEntity)
    private readonly sessionRepo: Repository<AcademicSessionEntity>,
    @InjectRepository(TermEntity)
    private readonly termRepo: Repository<TermEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<AcademicSessionEntity[]> {
    const sessions = tenantScoped(this.sessionRepo);
    await this.ensureDefault(sessions.currentOrganizationId);
    return sessions.find({ order: { start_date: 'DESC', name: 'ASC' } });
  }

  async findOne(id: string): Promise<AcademicSessionEntity> {
    const session = await tenantScoped(this.sessionRepo).findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async create(dto: CreateAcademicSessionDto, actor: Actor): Promise<AcademicSessionEntity> {
    assertDates(dto.start_date, dto.end_date);
    const organizationId = tenantScoped(this.sessionRepo).currentOrganizationId;
    await this.ensureDefault(organizationId);
    const saved = await this.sessionRepo.save(
      this.sessionRepo.create({
        organization_id: organizationId,
        name: dto.name.trim(),
        start_date: dto.start_date,
        end_date: dto.end_date,
        status: AcademicSessionStatusEnum.ACTIVE,
        is_default: false,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      }),
    );
    return dto.is_default ? this.setDefault(saved.id, actor) : saved;
  }

  async update(id: string, dto: UpdateAcademicSessionDto, actor: Actor): Promise<AcademicSessionEntity> {
    const session = await this.findOne(id);
    this.assertSessionOpen(session);
    const start = dto.start_date ?? session.start_date;
    const end = dto.end_date ?? session.end_date;
    assertDates(start, end);
    Object.assign(session, {
      name: dto.name?.trim() ?? session.name,
      start_date: start,
      end_date: end,
      updated_by: actor.id,
      updated_user_name: actor.full_name ?? undefined,
      updated_at: new Date(),
    });
    return this.sessionRepo.save(session);
  }

  /** Makes a session the organisation's default (new classes and exams go into it). */
  async setDefault(id: string, actor: Actor): Promise<AcademicSessionEntity> {
    const session = await this.findOne(id);
    if (session.status === AcademicSessionStatusEnum.CLOSED) {
      throw new BadRequestException('A closed session cannot be the default; reopen it first');
    }
    if (session.is_default) return session;
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AcademicSessionEntity);
      await repo.update({ organization_id: session.organization_id, is_default: true }, { is_default: false });
      await repo.update({ id }, { is_default: true, updated_by: actor.id, updated_at: new Date() });
    });
    return this.findOne(id);
  }

  async close(id: string, actor: Actor): Promise<AcademicSessionEntity> {
    const session = await this.findOne(id);
    if (session.is_default) {
      throw new BadRequestException('Make another session the default before closing this one');
    }
    return this.setStatus(session, AcademicSessionStatusEnum.CLOSED, actor);
  }

  async reopen(id: string, actor: Actor): Promise<AcademicSessionEntity> {
    return this.setStatus(await this.findOne(id), AcademicSessionStatusEnum.ACTIVE, actor);
  }

  async listTerms(sessionId: string): Promise<TermEntity[]> {
    await this.findOne(sessionId);
    return tenantScoped(this.termRepo).find({ where: { session_id: sessionId }, order: { sort_order: 'ASC', created_at: 'ASC' } });
  }

  async createTerm(sessionId: string, dto: CreateTermDto, actor: Actor): Promise<TermEntity> {
    const session = await this.findOne(sessionId);
    this.assertSessionOpen(session);
    assertDates(dto.start_date, dto.end_date);
    return this.termRepo.save(
      this.termRepo.create({
        organization_id: session.organization_id,
        session_id: session.id,
        name: dto.name.trim(),
        start_date: dto.start_date ?? null,
        end_date: dto.end_date ?? null,
        sort_order: dto.sort_order ?? 0,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      }),
    );
  }

  async updateTerm(id: string, dto: UpdateTermDto, actor: Actor): Promise<TermEntity> {
    const term = await this.findTerm(id);
    this.assertSessionOpen(await this.findOne(term.session_id));
    const start = dto.start_date !== undefined ? dto.start_date : term.start_date;
    const end = dto.end_date !== undefined ? dto.end_date : term.end_date;
    assertDates(start, end);
    Object.assign(term, {
      name: dto.name?.trim() ?? term.name,
      start_date: start,
      end_date: end,
      sort_order: dto.sort_order ?? term.sort_order,
      updated_by: actor.id,
      updated_user_name: actor.full_name ?? undefined,
      updated_at: new Date(),
    });
    return this.termRepo.save(term);
  }

  async removeTerm(id: string): Promise<void> {
    const term = await this.findTerm(id);
    this.assertSessionOpen(await this.findOne(term.session_id));
    await this.termRepo.remove(term);
  }

  /** 400 when the session is closed (FND-01: its records are read-only). Later epics call this too. */
  assertSessionOpen(session: Pick<AcademicSessionEntity, 'status'>): void {
    if (session.status === AcademicSessionStatusEnum.CLOSED) {
      throw new BadRequestException('This session is closed; the owner can reopen it');
    }
  }

  /**
   * The organisation's default session, created on first use as this calendar year in its time
   * zone. Safe under concurrency: a partial unique index allows one default per organisation.
   */
  async ensureDefault(organizationId: string, manager?: EntityManager): Promise<AcademicSessionEntity> {
    const repo = (manager ?? this.sessionRepo.manager).getRepository(AcademicSessionEntity);
    const existing = await repo.findOne({ where: { organization_id: organizationId, is_default: true } });
    if (existing) return existing;

    const organization = await repo.manager.getRepository(OrganizationEntity).findOneOrFail({ where: { id: organizationId } });
    const year = currentYearIn(organization.timezone);
    await repo
      .createQueryBuilder()
      .insert()
      .values({
        organization_id: organizationId,
        name: String(year),
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        status: AcademicSessionStatusEnum.ACTIVE,
        is_default: true,
        created_at: new Date(),
      })
      .orIgnore()
      .execute();
    return repo.findOneOrFail({ where: { organization_id: organizationId, is_default: true } });
  }

  private async setStatus(session: AcademicSessionEntity, status: AcademicSessionStatusEnum, actor: Actor) {
    session.status = status;
    session.updated_by = actor.id;
    session.updated_user_name = actor.full_name ?? session.updated_user_name;
    session.updated_at = new Date();
    return this.sessionRepo.save(session);
  }

  private async findTerm(id: string): Promise<TermEntity> {
    const term = await tenantScoped(this.termRepo).findOne({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');
    return term;
  }
}

function assertDates(start?: string | null, end?: string | null): void {
  if (start && end && end < start) {
    throw new BadRequestException('The end date must be on or after the start date');
  }
}
