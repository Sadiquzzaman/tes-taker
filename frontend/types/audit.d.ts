/** A JSON value stored in an audit row's before/after. */
type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };

/** One row of the audit log (design §8.10). `ip` is sent to platform admins only. */
interface AuditLogItem {
  id: string;
  created_at: string;
  action: string;
  organization: { id: string; name: string } | null;
  actor: { id: string; full_name: string | null } | null;
  entity_type: string | null;
  entity_id: string | null;
  before: Record<string, AuditValue> | null;
  after: Record<string, AuditValue> | null;
  reason: string | null;
  ip?: string | null;
}

interface AuditLogListResponse {
  message: string;
  payload: AuditLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** Filters the audit endpoints accept. `action` is an action or an area ending in a dot (`member.`). */
interface AuditLogFilters {
  organization_id?: string;
  action?: string;
  from?: string;
  to?: string;
}
