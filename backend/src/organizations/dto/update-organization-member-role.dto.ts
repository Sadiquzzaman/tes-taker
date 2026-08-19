import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({
    enum: [
      OrganizationMemberRoleEnum.ADMIN,
      OrganizationMemberRoleEnum.ASSISTANT,
      OrganizationMemberRoleEnum.TEACHER,
      OrganizationMemberRoleEnum.STUDENT,
    ],
    description: 'New member role (cannot set OWNER)',
  })
  @IsEnum(OrganizationMemberRoleEnum)
  role: OrganizationMemberRoleEnum;
}
