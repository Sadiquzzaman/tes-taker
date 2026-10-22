import { ApiProperty } from '@nestjs/swagger';
import { RolesEnum } from 'src/common/enums/roles.enum';

export class OrganizationSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 100001 })
  organization_number: number;

  @ApiProperty()
  role: string;

  @ApiProperty()
  status: string;
}

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

  @ApiProperty({
    description: 'Whether the user has an individual/personal teaching workspace',
    required: false,
  })
  personal_teacher_enabled?: boolean;

  @ApiProperty({ required: false, nullable: true, example: 'USR-4F8KD' })
  public_id?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '10001' })
  teacher_public_id?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '1000001' })
  student_public_id?: string | null;

  @ApiProperty({
    description: 'Active workspace context after login/selection',
    enum: ['personal_teacher', 'organization', 'individual_teacher', 'individual'],
    required: false,
  })
  context_type?: 'personal_teacher' | 'organization' | 'individual_teacher' | 'individual';

  @ApiProperty({
    description: 'Active personal-teacher UUID when context is individual_teacher',
    required: false,
    nullable: true,
  })
  teacher_id?: string | null;

  @ApiProperty({
    description: 'Login session mode',
    enum: ['individual', 'organization'],
    required: false,
  })
  session_mode?: 'individual' | 'organization';

  @ApiProperty({
    description: 'Active organization for organization login sessions',
    type: OrganizationSessionDto,
    required: false,
    nullable: true,
  })
  organization?: OrganizationSessionDto | null;

  @ApiProperty({ description: 'JWT access token for authenticated requests', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens', example: 'refresh-token-string', required: false, nullable: true })
  refresh_token: string | null;
}
