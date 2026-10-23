import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { SmsController } from './sms.controller';

const guardsOf = (handler: object): unknown[] => Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
// 'roles' is the metadata key set by @Roles().
const rolesOf = (handler: object): unknown => Reflect.getMetadata('roles', handler);

describe('SmsController access', () => {
  const { getSmsStatus, resetSmsCache, sendOtp } = SmsController.prototype;

  it('requires an admin login to read SMS status for a phone number', () => {
    const guards = guardsOf(getSmsStatus);

    expect(guards).toHaveLength(2); // jwt AuthGuard + RolesGuard
    expect(guards).toContain(RolesGuard);
    expect(rolesOf(getSmsStatus)).toEqual([RolesEnum.ADMIN]);
  });

  it('protects status the same way as reset-cache', () => {
    expect(guardsOf(getSmsStatus)).toEqual(guardsOf(resetSmsCache));
    expect(rolesOf(getSmsStatus)).toEqual(rolesOf(resetSmsCache));
  });

  it('keeps send-otp public (it is the sign-up flow)', () => {
    expect(guardsOf(sendOtp)).toHaveLength(0);
  });
});
