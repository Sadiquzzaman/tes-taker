import { Logger } from '@nestjs/common';
import { AUDIT_ACTIONS } from './audit-actions';
import { AuditRequestContext } from './audit-request-context';
import { AuditService } from './audit.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

describe('AuditService.record', () => {
  let insert: jest.Mock;
  let service: AuditService;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    insert = jest.fn(async () => ({ identifiers: [] }));
    service = new AuditService({ insert } as never);
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("writes one row with the request's IP and the sanitised before/after", async () => {
    AuditRequestContext.run({ ip: '203.0.113.7' }, () =>
      service.record({
        action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGE,
        organizationId: ORG_ID,
        actorId: ACTOR_ID,
        entityType: 'organization_member',
        entityId: MEMBER_ID,
        before: { role: 'TEACHER' },
        after: { role: 'ADMIN', password: 'never' },
        reason: '  promoted  ',
      }),
    );
    await service.flush();

    expect(insert).toHaveBeenCalledWith([
      {
        action: 'member.role_change',
        organization_id: ORG_ID,
        actor_id: ACTOR_ID,
        entity_type: 'organization_member',
        entity_id: MEMBER_ID,
        before: { role: 'TEACHER' },
        after: { role: 'ADMIN' },
        reason: 'promoted',
        ip: '203.0.113.7',
      },
    ]);
  });

  it('does not wait for the insert and never throws when it fails', async () => {
    let finish: (value: unknown) => void = () => undefined;
    insert.mockImplementation(() => new Promise((_resolve, reject) => (finish = reject)));

    expect(() => service.record({ action: AUDIT_ACTIONS.PLAN_CREATE, actorId: ACTOR_ID })).not.toThrow();
    expect(insert).toHaveBeenCalledTimes(1);

    finish(new Error('database is down'));
    await expect(service.flush()).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('plan.create'));
  });

  it('writes several rows in one insert', async () => {
    service.recordMany([
      { action: AUDIT_ACTIONS.MEMBER_ADD, organizationId: ORG_ID, actorId: ACTOR_ID },
      { action: AUDIT_ACTIONS.MEMBER_ADD, organizationId: ORG_ID, actorId: ACTOR_ID },
    ]);
    service.recordMany([]);
    await service.flush();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
  });

  it('stores ids that are not uuids as null instead of failing the insert', async () => {
    service.record({ action: AUDIT_ACTIONS.PLAN_REORDER, organizationId: 'nope', actorId: undefined, entityId: '42' });
    await service.flush();
    expect(insert.mock.calls[0][0][0]).toMatchObject({ organization_id: null, actor_id: null, entity_id: null, ip: null });
  });
});
