import { Injectable } from '@nestjs/common';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { AttendanceSettings, OrgSettingsService } from 'src/organizations/org-settings.service';
import { AttendanceClock } from './attendance-clock';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

/**
 * Organisation attendance settings (ATT-01 as changed on 5 Nov 2026): the grace period, weekly off
 * days, guardian SMS and the repeated-absence alert. The values live in org_settings (organizations
 * module); this service owns the rules. Class times come from section schedules and the pin and
 * radius from branches (ATT-15, ATT-16). Saved attendance records are never touched by a change.
 */
@Injectable()
export class AttendanceSettingsService {
  constructor(
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
    private readonly clock: AttendanceClock,
  ) {}

  get(organizationId: string): Promise<AttendanceSettings> {
    return this.orgSettings.getAttendance(organizationId);
  }

  async update(tenant: Tenant, userId: string, dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettings> {
    const organizationId = tenant.organizationId;
    const current = await this.orgSettings.getAttendance(organizationId);
    const { guardian_sms, ...fields } = dto;
    const changes: Partial<AttendanceSettings> = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (guardian_sms) changes.guardian_sms = { ...current.guardian_sms, ...stripUndefined(guardian_sms) };
    if (changes.weekly_off_days) changes.weekly_off_days = [...changes.weekly_off_days].sort((a, b) => a - b);

    if (Object.keys(changes).length === 0) return current;
    // Opening a weekly off day applies from tomorrow: the date it is changed on keeps its old off days.
    const today = schoolDateIn(await this.orgSettings.timeZone(organizationId), this.clock.now());
    const { before, after } = await this.orgSettings.saveAttendance(organizationId, userId, changes, today);
    const diff = auditChanges(before, after);
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.ATTENDANCE_SETTINGS_UPDATE,
        organizationId,
        actorId: userId,
        entityType: 'org_settings',
        entityId: organizationId,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
