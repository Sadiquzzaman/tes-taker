import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/user/entities/user.entity';

@Injectable()
export class UserFilterUtil {
  filterSensitiveFields(user: UserEntity): any {
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
