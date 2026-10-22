import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { OrganizationsService } from './organization.service';

const ORG = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const SUBJECT = '33333333-3333-4333-8333-333333333333';

function uniqueViolation(constraint: string) {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }));
}

// Only subjectRepo and accessService are used by the subject methods under test.
function build(subjectRepo: Record<string, jest.Mock>) {
  const accessService = { requireAcademicManager: jest.fn().mockResolvedValue(undefined) };
  const deps: unknown[] = new Array(16).fill({});
  deps[4] = subjectRepo;
  deps[11] = accessService;
  return new (OrganizationsService as unknown as new (...args: unknown[]) => OrganizationsService)(...deps);
}

describe('OrganizationsService organization subjects — lost insert race on UQ_subjects_org_name_code', () => {
  it('create with failIfExists returns 409 instead of a database error', async () => {
    const subjectRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockRejectedValue(uniqueViolation('UQ_subjects_org_name_code')),
    };
    const service = build(subjectRepo);
    await expect(
      service.findOrCreateOrganizationSubject(ORG, ACTOR, { name: 'Physics', code: 'PHY' }, 'Admin', true),
    ).rejects.toThrow(ConflictException);
  });

  it('find-or-create returns the subject the parallel request created', async () => {
    const winner = { id: SUBJECT, name: 'physics', code: 'phy', organization_id: ORG };
    const subjectRepo = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
      create: jest.fn((value) => value),
      save: jest.fn().mockRejectedValue(uniqueViolation('UQ_subjects_org_name_code')),
    };
    const service = build(subjectRepo);
    await expect(
      service.findOrCreateOrganizationSubject(ORG, ACTOR, { name: 'Physics', code: 'PHY' }),
    ).resolves.toBe(winner);
  });

  it('update returns 409 instead of a database error', async () => {
    const subjectRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: SUBJECT, name: 'Physics', code: 'PHY', organization_id: ORG })
        .mockResolvedValueOnce(null),
      save: jest.fn().mockRejectedValue(uniqueViolation('UQ_subjects_org_name_code')),
    };
    const service = build(subjectRepo);
    await expect(
      service.updateOrganizationSubject(ORG, SUBJECT, ACTOR, { name: 'Chemistry' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rethrows other database errors unchanged', async () => {
    const other = uniqueViolation('UQ_something_else');
    const subjectRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockRejectedValue(other),
    };
    const service = build(subjectRepo);
    await expect(
      service.findOrCreateOrganizationSubject(ORG, ACTOR, { name: 'Physics', code: 'PHY' }),
    ).rejects.toBe(other);
  });
});
