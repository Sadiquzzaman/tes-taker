import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

export class ImportOrganizationMembersDto {
  @ApiProperty({
    description: 'Rows of Teacher/Student public ID, phone, or email',
    type: [String],
    example: ['10001', '01734911480', 'teacher@example.com'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      : value,
  )
  identifiers: string[];

  @ApiPropertyOptional({
    enum: [
      OrganizationMemberRoleEnum.ADMIN,
      OrganizationMemberRoleEnum.ASSISTANT,
      OrganizationMemberRoleEnum.TEACHER,
      OrganizationMemberRoleEnum.STUDENT,
    ],
    default: OrganizationMemberRoleEnum.TEACHER,
  })
  @IsOptional()
  @IsEnum(OrganizationMemberRoleEnum)
  role?: OrganizationMemberRoleEnum;
}
