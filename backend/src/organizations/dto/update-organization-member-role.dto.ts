import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({
    enum: [
      OrganizationMemberRoleEnum.ADMIN,
      OrganizationMemberRoleEnum.ASSISTANT,
      OrganizationMemberRoleEnum.TEACHER,
      OrganizationMemberRoleEnum.STUDENT,
      OrganizationMemberRoleEnum.BRANCH_MANAGER,
    ],
    description: 'New member role (cannot set OWNER)',
  })
  @IsEnum(OrganizationMemberRoleEnum)
  role: OrganizationMemberRoleEnum;

  @ApiPropertyOptional({ format: 'uuid', description: 'The branch a BRANCH_MANAGER runs (required for that role, P12-01)' })
  @ValidateIf((o) => o.role === OrganizationMemberRoleEnum.BRANCH_MANAGER || o.branch_id !== undefined)
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
