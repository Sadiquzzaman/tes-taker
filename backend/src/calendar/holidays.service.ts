import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { daysBetween, isSchoolDate, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { HOLIDAY_ERRORS, MAX_HOLIDAY_DAYS } from './calendar-errors';
import { ClosedDay, closedDaysBetween } from './closed-days';
import { CreateHolidayDto, ListHolidaysQueryDto, UpdateHolidayDto } from './dto/holiday.dto';
import { HolidayEntity } from './entities/holiday.entity';

/** A holiday as the API returns it. */
export interface HolidayView {
  id: string;
  date_from: string;
  date_to: string;
  name: string | null;
  days: number;
}

type Actor = Pick<JwtPayloadInterface, 'id' | 'full_name'>;

/**
 * Holidays and closures of the request's organisation (CAL-04). Only today and later can be
 * added, changed or removed: a past day may already have absences and absence SMS (ATT-10).
 * Removing keeps the row (is_active '0', removed_at/by).
 */
@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(HolidayEntity)
    private readonly holidayRepo: Repository<HolidayEntity>,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListHolidaysQueryDto): Promise<HolidayView[]> {
    const qb = tenantScoped(this.holidayRepo)
      .createQueryBuilder('h')
      .andWhere('h.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('h.date_from', 'ASC')
      .addOrderBy('h.date_to', 'ASC');
    if (query.from) qb.andWhere('h.date_to >= :from', { from: query.from });
    if (query.to) qb.andWhere('h.date_from <= :to', { to: query.to });
    return (await qb.getMany()).map(view);
  }

  async create(dto: CreateHolidayDto, actor: Actor): Promise<HolidayView> {
    const holidays = tenantScoped(this.holidayRepo);
    const organizationId = holidays.currentOrganizationId;
    const range = this.validRange(dto.date_from, dto.date_to ?? dto.date_from);
    await this.assertNotPast(organizationId, range.date_from);
    const saved = await this.holidayRepo.save(
      this.holidayRepo.create({
        organization_id: organizationId,
        ...range,
        name: dto.name || null,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      }),
    );
    this.audit.record({
      action: AUDIT_ACTIONS.HOLIDAY_CREATE,
      organizationId,
      actorId: actor.id,
      entityType: 'holiday',
      entityId: saved.id,
      after: state(saved),
    });
    return view(saved);
  }

  async update(id: string, dto: UpdateHolidayDto, actor: Actor): Promise<HolidayView> {
    const holiday = await this.findActive(id);
    await this.assertNotPast(holiday.organization_id, holiday.date_from);
    const before = state(holiday);
    const range = this.validRange(dto.date_from ?? holiday.date_from, dto.date_to ?? holiday.date_to);
    await this.assertNotPast(holiday.organization_id, range.date_from);
    Object.assign(holiday, range);
    if (dto.name !== undefined) holiday.name = dto.name || null;
    holiday.updated_by = actor.id;
    holiday.updated_user_name = actor.full_name ?? holiday.updated_user_name;
    holiday.updated_at = new Date();
    const saved = await this.holidayRepo.save(holiday);
    const diff = auditChanges(before, state(saved));
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.HOLIDAY_UPDATE,
        organizationId: saved.organization_id,
        actorId: actor.id,
        entityType: 'holiday',
        entityId: saved.id,
        before: diff.before,
        after: diff.after,
      });
    }
    return view(saved);
  }

  /** Soft delete: the row stays with who removed it and when. */
  async remove(id: string, actor: Actor): Promise<void> {
    const holiday = await this.findActive(id);
    await this.assertNotPast(holiday.organization_id, holiday.date_from);
    await this.holidayRepo.update(
      { id: holiday.id, organization_id: holiday.organization_id },
      { is_active: ActiveStatusEnum.INACTIVE, removed_at: new Date(), removed_by: actor.id, updated_by: actor.id, updated_at: new Date() },
    );
    this.audit.record({
      action: AUDIT_ACTIONS.HOLIDAY_REMOVE,
      organizationId: holiday.organization_id,
      actorId: actor.id,
      entityType: 'holiday',
      entityId: holiday.id,
      before: state(holiday),
    });
  }

  /**
   * Days an organisation is closed from `from` to `to` (both included): its weekly off days and
   * active holidays. For attendance jobs (P3-04), which pass the organisation explicitly.
   */
  async closedDays(organizationId: string, from: string, to: string): Promise<ClosedDay[]> {
    const [settings, holidays] = await Promise.all([
      this.orgSettings.getAttendance(organizationId),
      tenantScoped(this.holidayRepo)
        .forOrganization(organizationId)
        .createQueryBuilder('h')
        .andWhere('h.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
        .andWhere('h.date_to >= :from AND h.date_from <= :to', { from, to })
        .orderBy('h.date_from', 'ASC')
        .getMany(),
    ]);
    return closedDaysBetween(from, to, settings.weekly_off_days, holidays);
  }

  private async findActive(id: string): Promise<HolidayEntity> {
    const holiday = await tenantScoped(this.holidayRepo).findOne({ where: { id, is_active: ActiveStatusEnum.ACTIVE } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    return holiday;
  }

  private validRange(dateFrom: string, dateTo: string): { date_from: string; date_to: string } {
    if (!isSchoolDate(dateFrom) || !isSchoolDate(dateTo)) {
      throw new BadRequestException({ message: 'Enter real dates', code: HOLIDAY_ERRORS.INVALID_DATE });
    }
    if (dateTo < dateFrom) {
      throw new BadRequestException({ message: 'The last day cannot be before the first day', code: HOLIDAY_ERRORS.RANGE_INVALID });
    }
    if (daysBetween(dateFrom, dateTo) > MAX_HOLIDAY_DAYS) {
      throw new BadRequestException({
        message: `A holiday can be at most ${MAX_HOLIDAY_DAYS} days long`,
        code: HOLIDAY_ERRORS.RANGE_TOO_LONG,
      });
    }
    return { date_from: dateFrom, date_to: dateTo };
  }

  /** Only holidays starting today or later can be added, changed or removed. */
  private async assertNotPast(organizationId: string, dateFrom: string): Promise<void> {
    const today = schoolDateIn(await this.orgSettings.timeZone(organizationId));
    if (dateFrom < today) {
      throw new BadRequestException({
        message: 'Past days cannot be changed; attendance for them may already be recorded',
        code: HOLIDAY_ERRORS.PAST_LOCKED,
      });
    }
  }
}

function view(holiday: HolidayEntity): HolidayView {
  return {
    id: holiday.id,
    date_from: holiday.date_from,
    date_to: holiday.date_to,
    name: holiday.name,
    days: daysBetween(holiday.date_from, holiday.date_to),
  };
}

function state(holiday: HolidayEntity) {
  return { date_from: holiday.date_from, date_to: holiday.date_to, name: holiday.name };
}
