import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TenantRepository, tenantScoped } from 'src/common/tenancy/tenant-repository';
import { AuditAction } from './audit-actions';
import { AuditRequestContext } from './audit-request-context';
import { AuditState, sanitizeAuditState } from './audit-sanitize';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditLogEntity } from './entities/audit-log.entity';

/** What a feature passes to `AuditService.record`. */
export interface AuditEntry {
  action: AuditAction;
  /** The organisation the record belongs to; null for platform-wide actions (e.g. a plan). */
  organizationId?: string | null;
  /** Who did it (the signed-in user's id); null for system actions. */
  actorId?: string | null;
  /** The record's kind (`organization_member`, `exam`, …) and id (a uuid). */
  entityType?: string | null;
  entityId?: string | null;
  /** Only the fields that changed. Secret-looking keys are removed (audit-sanitize.ts). */
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** One row as the API returns it. `ip` is present only in the platform admin's list. */
export interface AuditLogView {
  id: string;
  created_at: Date;
  action: string;
  organization: { id: string; name: string } | null;
  actor: { id: string; full_name: string | null } | null;
  entity_type: string | null;
  entity_id: string | null;
  before: AuditState | null;
  after: AuditState | null;
  reason: string | null;
  ip?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON = 2000;

const uuidOrNull = (value: string | null | undefined): string | null => (value && UUID_RE.test(value) ? value : null);

/**
 * The audit log (design §8.10). Features call `record` after a change has been saved:
 *
 *   this.audit.record({
 *     action: AUDIT_ACTIONS.MEMBER_REMOVE,
 *     organizationId, actorId: jwtPayload.id,
 *     entityType: 'organization_member', entityId: member.id,
 *     before: { role: member.role }, reason,
 *   });
 *
 * Writing never blocks or fails the request: the insert runs in the background and a failure is
 * only logged. The caller's IP is taken from the request automatically.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  record(entry: AuditEntry): void {
    this.recordMany([entry]);
  }

  /** Several rows in one insert (e.g. one per member added by a CSV import). */
  recordMany(entries: AuditEntry[]): void {
    if (entries.length === 0) return;
    let rows: Array<Partial<AuditLogEntity>>;
    try {
      const ip = AuditRequestContext.ip();
      rows = entries.map((entry) => this.toRow(entry, ip));
    } catch (error) {
      this.logger.error(`Audit rows not built (${entries[0].action}): ${(error as Error).message}`);
      return;
    }
    const write = this.auditRepo.insert(rows).then(
      () => undefined,
      (error: Error) => this.logger.error(`Audit rows not written (${entries.map((e) => e.action).join(', ')}): ${error.message}`),
    );
    this.pending.add(write);
    void write.finally(() => this.pending.delete(write));
  }

  /** Waits for the background writes started so far (tests, graceful shutdown). */
  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  /** Platform admin: every organisation, with IPs. */
  async listForPlatform(query: ListAuditLogsQueryDto) {
    const qb = this.auditRepo.createQueryBuilder('log');
    if (query.organization_id) qb.andWhere('log.organization_id = :organizationId', { organizationId: query.organization_id });
    return this.list(qb, query, true);
  }

  /** An organisation's owner and admins: their organisation only, without IPs. */
  async listForOrganization(query: ListAuditLogsQueryDto) {
    const logs: TenantRepository<AuditLogEntity> = tenantScoped(this.auditRepo);
    return this.list(logs.createQueryBuilder('log'), query, false);
  }

  private async list(qb: SelectQueryBuilder<AuditLogEntity>, query: ListAuditLogsQueryDto, withIp: boolean) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    qb.leftJoin('log.actor', 'actor')
      .addSelect(['actor.id', 'actor.full_name'])
      .leftJoin('log.organization', 'organization')
      .addSelect(['organization.id', 'organization.name']);
    if (query.actor_id) qb.andWhere('log.actor_id = :actorId', { actorId: query.actor_id });
    if (query.action?.endsWith('.')) qb.andWhere('log.action LIKE :actionPrefix', { actionPrefix: `${query.action}%` });
    else if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.entity_type) qb.andWhere('log.entity_type = :entityType', { entityType: query.entity_type });
    if (query.entity_id) qb.andWhere('log.entity_id = :entityId', { entityId: query.entity_id });
    if (query.from) qb.andWhere('log.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('log.created_at < :to', { to: new Date(query.to) });

    const [rows, total] = await qb
      .orderBy('log.created_at', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      logs: rows.map((row) => this.toView(row, withIp)),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    };
  }

  private toRow(entry: AuditEntry, ip: string | null): Partial<AuditLogEntity> {
    const reason = entry.reason?.trim();
    return {
      action: entry.action,
      organization_id: uuidOrNull(entry.organizationId),
      actor_id: uuidOrNull(entry.actorId),
      entity_type: entry.entityType ?? null,
      entity_id: uuidOrNull(entry.entityId),
      before: sanitizeAuditState(entry.before),
      after: sanitizeAuditState(entry.after),
      reason: reason ? reason.slice(0, MAX_REASON) : null,
      ip,
    };
  }

  private toView(row: AuditLogEntity, withIp: boolean): AuditLogView {
    return {
      id: String(row.id),
      created_at: row.created_at,
      action: row.action,
      organization: row.organization ? { id: row.organization.id, name: row.organization.name } : null,
      actor: row.actor ? { id: row.actor.id, full_name: row.actor.full_name ?? null } : null,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      before: row.before as AuditState | null,
      after: row.after as AuditState | null,
      reason: row.reason,
      ...(withIp ? { ip: row.ip } : {}),
    };
  }
}
