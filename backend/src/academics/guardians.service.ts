import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditEntry, AuditService } from 'src/audit/audit.service';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { normalizePhone } from 'src/common/utils/contact.util';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { GuardianInputDto, GuardianSmsLocale, SaveGuardiansDto } from './dto/guardian.dto';
import { EnrolmentEntity } from './entities/enrolment.entity';
import { GuardianEntity, GuardianRelationEnum } from './entities/guardian.entity';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;

/** A Bangladeshi mobile number, 01XXXXXXXXX (FND-09). */
const BD_MOBILE = /^01[3-9]\d{8}$/;
export const MAX_GUARDIANS = 2;

interface Actor {
  id: string;
  full_name?: string | null;
}

export interface GuardianView {
  id: string;
  name: string;
  relation: GuardianRelationEnum;
  phone: string;
  is_primary: boolean;
}

export interface StudentGuardiansView {
  guardians: GuardianView[];
  /** The student's own SMS language, or null when they follow the organisation's. */
  sms_locale: GuardianSmsLocale | null;
  /** The organisation's guardian SMS language (FND-10). */
  organization_sms_locale: GuardianSmsLocale;
}

/** A guardian to message, with the language the SMS must use (for the senders, e.g. attendance alerts). */
export interface GuardianContact extends GuardianView {
  locale: GuardianSmsLocale;
}

/** Fields written for one guardian; the audit log records only what changed. */
type GuardianFields = Pick<GuardianEntity, 'name' | 'relation' | 'phone' | 'is_primary' | 'sms_locale'>;

const toView = (row: GuardianEntity): GuardianView => ({
  id: row.id,
  name: row.name,
  relation: row.relation,
  phone: row.phone,
  is_primary: row.is_primary,
});

const isLocale = (value: string | null | undefined): value is GuardianSmsLocale => value === 'bn' || value === 'en';

/**
 * Guardians (FND-09) and their SMS language (FND-10): the only writer of `guardians`. A student's
 * guardians are reached through one of their enrolments, so the same screens work for a student
 * who has not signed up yet (invited enrolment, `student_id` null) and for one who has (all
 * guardian rows of the student in the organisation). Owners, admins and assistants may change
 * them, and teachers who teach the enrolment's class; students never reach these routes. Removed
 * guardians are kept (`deleted_at`, `deleted_by`); every change is in the audit log.
 */
@Injectable()
export class GuardiansService {
  constructor(
    @InjectRepository(GuardianEntity)
    private readonly guardianRepo: Repository<GuardianEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    private readonly accessService: OrganizationAccessService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------- endpoints

  async listForEnrolment(enrolmentId: string, actor: Actor): Promise<StudentGuardiansView> {
    const enrolment = await this.accessibleEnrolment(enrolmentId, actor);
    return this.view(enrolment);
  }

  /** Saves the student's guardians as a whole: adds, changes and removes to match `dto`, in one transaction. */
  async saveForEnrolment(enrolmentId: string, dto: SaveGuardiansDto, actor: Actor): Promise<StudentGuardiansView> {
    const enrolment = await this.accessibleEnrolment(enrolmentId, actor);
    const entries = await this.enrolmentRepo.manager.transaction((manager) => this.replace(enrolment.id, dto, actor, manager));
    this.audit.recordMany(entries);
    return this.view(enrolment);
  }

  // ------------------------------------------------- for other services

  /**
   * Replaces the guardians of the enrolment's student (no access check: the caller has checked).
   * Returns the audit entries; record them once the transaction has committed.
   */
  async replace(enrolmentId: string, dto: SaveGuardiansDto, actor: Actor, manager: EntityManager): Promise<AuditEntry[]> {
    // One writer at a time per enrolment, so the limit of 2 and the single primary hold.
    const enrolment = await manager.getRepository(EnrolmentEntity).findOne({ where: { id: enrolmentId }, lock: { mode: 'pessimistic_write' } });
    if (!enrolment) throw new NotFoundException('Student enrolment not found');

    const inputs = this.validate(dto.guardians);
    const repo = manager.getRepository(GuardianEntity);
    const current = await repo.find({ where: this.ownerOf(enrolment) });
    const byId = new Map(current.map((row) => [row.id, row]));
    for (const input of inputs) {
      if (input.id && !byId.has(input.id)) throw new BadRequestException('This guardian does not belong to this student');
    }
    const smsLocale = dto.sms_locale === undefined ? this.studentLocale(current) : dto.sms_locale;

    const now = new Date();
    const stamp = { updated_by: actor.id, updated_user_name: actor.full_name ?? undefined, updated_at: now };
    const entries: AuditEntry[] = [];
    const entry = (action: AuditEntry['action'], id: string, before: unknown, after: unknown): AuditEntry => ({
      action,
      organizationId: enrolment.organization_id,
      actorId: actor.id,
      entityType: 'guardian',
      entityId: id,
      before,
      after,
    });

    const kept = new Set(inputs.map((input) => input.id).filter(Boolean));
    const removed = current.filter((row) => !kept.has(row.id));
    if (removed.length > 0) {
      await repo.update({ id: In(removed.map((row) => row.id)) }, { deleted_at: now, deleted_by: actor.id, is_primary: false, ...stamp });
      for (const row of removed) entries.push(entry(AUDIT_ACTIONS.GUARDIAN_DELETE, row.id, this.auditFields(row), null));
    }

    try {
      // Primary flags are cleared before one is set, so the one-primary index never sees two.
      const ordered = [...inputs].sort((a, b) => Number(a.is_primary) - Number(b.is_primary));
      for (const input of ordered) {
        const fields: GuardianFields = { name: input.name, relation: input.relation, phone: input.phone, is_primary: input.is_primary, sms_locale: smsLocale };
        const existing = input.id ? byId.get(input.id) : undefined;
        if (existing) {
          const { before, after } = this.diff(existing, fields);
          if (Object.keys(after).length === 0) continue;
          await repo.update({ id: existing.id }, { ...fields, ...stamp });
          entries.push(entry(AUDIT_ACTIONS.GUARDIAN_UPDATE, existing.id, before, after));
        } else {
          const saved = await repo.save(
            repo.create({
              ...fields,
              organization_id: enrolment.organization_id,
              student_id: enrolment.student_id,
              enrolment_id: enrolment.id,
              deleted_at: null,
              deleted_by: null,
              created_by: actor.id,
              created_user_name: actor.full_name ?? undefined,
              created_at: now,
            }),
          );
          entries.push(entry(AUDIT_ACTIONS.GUARDIAN_CREATE, saved.id, null, this.auditFields(saved)));
        }
      }
    } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505') {
        throw new ConflictException('This phone number is already a guardian of this student');
      }
      throw error;
    }
    return entries;
  }

  /**
   * An invited student has joined (EnrolmentsService.claimInvitation, same transaction): the
   * guardians entered on their invitation become theirs. If the student already has guardians in
   * this organisation, those stay and the invitation's are removed (kept in history).
   */
  async linkInvitedStudent(invitation: Pick<EnrolmentEntity, 'id' | 'organization_id'>, studentId: string, manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(GuardianEntity);
    const invited = await repo.find({ where: { enrolment_id: invitation.id, student_id: IsNull(), deleted_at: IsNull() } });
    if (invited.length === 0) return;

    const own = await repo.count({ where: { organization_id: invitation.organization_id, student_id: studentId, deleted_at: IsNull() } });
    const now = new Date();
    if (own === 0) {
      await repo.update({ id: In(invited.map((row) => row.id)) }, { student_id: studentId, updated_by: studentId, updated_at: now });
      return;
    }
    await repo.update({ id: In(invited.map((row) => row.id)) }, { deleted_at: now, deleted_by: null, is_primary: false, updated_at: now });
    this.audit.recordMany(
      invited.map((row) => ({
        action: AUDIT_ACTIONS.GUARDIAN_DELETE,
        organizationId: invitation.organization_id,
        actorId: null,
        entityType: 'guardian',
        entityId: row.id,
        before: this.auditFields(row),
        reason: 'The student joined and already had guardians in this organisation',
      })),
    );
  }

  /** The student's guardians with the SMS language for each (student's choice, then the organisation's). */
  async contactsForStudent(organizationId: string, studentId: string, manager?: EntityManager): Promise<GuardianContact[]> {
    const repo = (manager ?? this.guardianRepo.manager).getRepository(GuardianEntity);
    const rows = await repo.find({ where: { organization_id: organizationId, student_id: studentId, deleted_at: IsNull() }, order: { is_primary: 'DESC', created_at: 'ASC' } });
    if (rows.length === 0) return [];
    const organizationLocale = (await this.orgSettings.get(organizationId, manager)).sms_locale;
    return rows.map((row) => ({ ...toView(row), locale: isLocale(row.sms_locale) ? row.sms_locale : organizationLocale }));
  }

  // ------------------------------------------------------------------ helpers

  /** The enrolment in the request's organisation, if the user may see and change its student's guardians. */
  private async accessibleEnrolment(enrolmentId: string, actor: Actor): Promise<EnrolmentEntity> {
    const tenant = TenantContext.current();
    if (!tenant) throw new ForbiddenException('Choose a workspace first');
    const enrolment = await tenantScoped(this.enrolmentRepo).findOne({ where: { id: enrolmentId } });
    if (!enrolment) throw new NotFoundException('Student enrolment not found');

    if (!tenant.viaEnrolment && [OWNER, ADMIN, ASSISTANT].includes(tenant.memberRole)) return enrolment;
    if (!tenant.viaEnrolment && tenant.memberRole === TEACHER && (await this.accessService.isAssignedToOrganizationClass(actor.id, enrolment.class_id))) {
      return enrolment;
    }
    throw new ForbiddenException("Only owners, admins and assistants of this workspace, and the student's teachers, can see or change guardians");
  }

  /** Live guardian rows of the enrolment's student: all of the student's, or the invitation's own. */
  private ownerOf(enrolment: EnrolmentEntity) {
    return enrolment.student_id
      ? { organization_id: enrolment.organization_id, student_id: enrolment.student_id, deleted_at: IsNull() }
      : { organization_id: enrolment.organization_id, enrolment_id: enrolment.id, student_id: IsNull(), deleted_at: IsNull() };
  }

  private async view(enrolment: EnrolmentEntity): Promise<StudentGuardiansView> {
    const rows = await this.guardianRepo.find({ where: this.ownerOf(enrolment), order: { is_primary: 'DESC', created_at: 'ASC' } });
    return {
      guardians: rows.map(toView),
      sms_locale: this.studentLocale(rows),
      organization_sms_locale: (await this.orgSettings.get(enrolment.organization_id)).sms_locale,
    };
  }

  private studentLocale(rows: GuardianEntity[]): GuardianSmsLocale | null {
    const locale = rows.find((row) => row.sms_locale)?.sms_locale;
    return isLocale(locale) ? locale : null;
  }

  /** Normalised inputs: valid mobile numbers, no number twice, exactly one primary (the first when none is marked). */
  private validate(guardians: GuardianInputDto[]): Array<GuardianInputDto & { is_primary: boolean }> {
    if (guardians.length > MAX_GUARDIANS) throw new BadRequestException(`A student can have at most ${MAX_GUARDIANS} guardians`);
    const phones = new Set<string>();
    const inputs = guardians.map((input) => {
      const phone = normalizePhone(input.phone);
      if (!phone || !BD_MOBILE.test(phone)) throw new BadRequestException('Enter a Bangladeshi mobile number, 01XXXXXXXXX');
      if (phones.has(phone)) throw new BadRequestException('Two guardians cannot have the same phone number');
      phones.add(phone);
      const name = input.name.trim();
      if (!name) throw new BadRequestException("Enter the guardian's name");
      return { ...input, name, phone, is_primary: Boolean(input.is_primary) };
    });
    const primaries = inputs.filter((input) => input.is_primary).length;
    if (primaries > 1) throw new BadRequestException('Only one guardian can be primary');
    if (primaries === 0 && inputs.length > 0) inputs[0].is_primary = true;
    return inputs;
  }

  private auditFields(row: GuardianFields): GuardianFields {
    return { name: row.name, relation: row.relation, phone: row.phone, is_primary: row.is_primary, sms_locale: row.sms_locale };
  }

  private diff(row: GuardianEntity, fields: GuardianFields): { before: Partial<GuardianFields>; after: Partial<GuardianFields> } {
    const before: Partial<GuardianFields> = {};
    const after: Partial<GuardianFields> = {};
    for (const key of Object.keys(fields) as Array<keyof GuardianFields>) {
      if (row[key] !== fields[key]) {
        (before as Record<string, unknown>)[key] = row[key];
        (after as Record<string, unknown>)[key] = fields[key];
      }
    }
    return { before, after };
  }
}
