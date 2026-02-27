import { ApiProperty } from '@nestjs/swagger';
import { RolesEnum } from 'src/common/enums/roles.enum';

export class UserReponseDto {
  @ApiProperty({ description: 'User unique identifier', example: 'uuid-string' })
  id: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  full_name: string;

  @ApiProperty({ description: 'User email address', example: 'user@example.com', required: false, nullable: true })
  email: string | null;

  @ApiProperty({ description: 'User phone number', example: '01734911480' })
  phone: string;

  @ApiProperty({ description: 'User verification status', example: true })
  is_verified: boolean;

  @ApiProperty({ description: 'User role', enum: RolesEnum, example: RolesEnum.STUDENT })
  role: RolesEnum;

  @ApiProperty({ description: 'JWT access token for authenticated requests', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens', example: 'refresh-token-string', required: false, nullable: true })
  refresh_token: string | null;
}
