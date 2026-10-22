import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { TeacherRequestService } from './teacher-request.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function uniqueViolation(constraint: string) {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }));
}

describe('TeacherRequestService.createRequest', () => {
  function build(saveError?: Error) {
    const requestRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(saveError ? () => Promise.reject(saveError) : async (value) => ({ id: 'r1', ...value })),
    };
    const userService = {
      findById: jest.fn().mockResolvedValue({ id: USER_ID, role: RolesEnum.STUDENT, full_name: 'Test Student' }),
    };
    const service = new TeacherRequestService(requestRepo as never, userService as never);
    return { service, requestRepo };
  }

  it('returns the "already pending" error when a parallel request wins the race', async () => {
    const { service } = build(uniqueViolation('UQ_teacher_role_requests_pending_user'));
    await expect(service.createRequest(USER_ID)).rejects.toThrow(
      new BadRequestException('You already have a pending teacher request'),
    );
  });

  it('rethrows other database errors unchanged', async () => {
    const other = uniqueViolation('UQ_something_else');
    const { service } = build(other);
    await expect(service.createRequest(USER_ID)).rejects.toBe(other);
  });

  it('still rejects a second request found by the pre-check', async () => {
    const { service, requestRepo } = build();
    requestRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.createRequest(USER_ID)).rejects.toThrow(BadRequestException);
    expect(requestRepo.save).not.toHaveBeenCalled();
  });
});
