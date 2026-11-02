import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { AttendanceMethodEnum, AVAILABLE_ATTENDANCE_METHODS } from 'src/organizations/enums/attendance-method.enum';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { AttendanceSettings, OrgSettingsService } from 'src/organizations/org-settings.service';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

/**
 * Attendance settings (ATT-01). The values live in org_settings (organizations module); this service
 * owns the rules: one daily presence method at a time, a confirmation to switch it while a session
 * is running, daily presence only for organisations (a solo teacher takes class attendance only),
 * and at least one working day a week. Saved attendance records are never touched by a change.
 */
@Injectable()
export class AttendanceSettingsService {
  constructor(
    private readonly orgSettings: OrgSettingsService,
    private readonly sessions: AcademicSessionsService,
    private readonly audit: AuditService,
  ) {}

  get(organizationId: string): Promise<AttendanceSettings> {
    return this.orgSettings.getAttendance(organizationId);
  }

  async update(tenant: Tenant, userId: string, dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettings> {
    const organizationId = tenant.organizationId;
    const current = await this.orgSettings.getAttendance(organizationId);
    const { confirm_method_change: confirmed, guardian_sms, ...fields } = dto;
    const changes: Partial<AttendanceSettings> = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (guardian_sms) changes.guardian_sms = { ...current.guardian_sms, ...stripUndefined(guardian_sms) };
    if (changes.weekly_off_days) changes.weekly_off_days = [...changes.weekly_off_days].sort((a, b) => a - b);

    const method = changes.attendance_method ?? current.attendance_method;
    if (changes.attendance_method && !AVAILABLE_ATTENDANCE_METHODS.includes(changes.attendance_method)) {
      throw new BadRequestException({
        message: 'This daily presence method is not available yet',
        code: ATTENDANCE_ERRORS.METHOD_NOT_AVAILABLE,
      });
    }
    if (tenant.kind === OrganizationKindEnum.SOLO && method !== AttendanceMethodEnum.OFF) {
      throw new BadRequestException({
        message: "A solo teacher's workspace takes class attendance only",
        code: ATTENDANCE_ERRORS.PRESENCE_NOT_FOR_SOLO,
      });
    }
    if ((changes.selfie_required ?? current.selfie_required) && method !== AttendanceMethodEnum.APP) {
      throw new BadRequestException({ message: 'A selfie can only be required with app check-in', code: ATTENDANCE_ERRORS.SELFIE_NEEDS_APP });
    }
    if (
      method !== current.attendance_method &&
      current.attendance_method !== AttendanceMethodEnum.OFF &&
      !confirmed &&
      (await this.sessionRunning(organizationId))
    ) {
      throw new ConflictException({
        message: 'An academic session is running. Confirm to switch the daily presence method; records already saved are kept',
        code: ATTENDANCE_ERRORS.METHOD_CHANGE_CONFIRM,
      });
    }

    if (Object.keys(changes).length === 0) return current;
    const { before, after } = await this.orgSettings.saveAttendance(organizationId, userId, changes);
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

  /** An open academic session covers today (in the organisation's time zone). */
  private async sessionRunning(organizationId: string): Promise<boolean> {
    const today = schoolDateIn(await this.orgSettings.timeZone(organizationId));
    const sessions = await this.sessions.list();
    return sessions.some(
      (s) => s.status === AcademicSessionStatusEnum.ACTIVE && String(s.start_date) <= today && String(s.end_date) >= today,
    );
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
