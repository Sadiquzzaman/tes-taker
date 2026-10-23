import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/user/entities/user.entity';

/** The user fields that are safe to return to clients. */
export type PublicUserFields = Pick<UserEntity, 'id' | 'is_active' | 'full_name' | 'email' | 'phone' | 'is_verified' | 'role'>;

@Injectable()
export class UserFilterUtil {
  filterSensitiveFields(user: UserEntity): PublicUserFields {
    const filteredUser = {
      id: user.id,
      is_active: user.is_active,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      is_verified: user.is_verified,
      role: user.role
    };

    return filteredUser;
  }
}
