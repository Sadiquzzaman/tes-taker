import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      'When false, missing users are reported as user_not_found and no invitation is sent. Defaults to true for CSV import.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    if (value === undefined || value === null || value === '') {
      return true;
    }
    return value === true || value === 'true' || value === 1 || value === '1';
  })
  @IsBoolean()
  invite_missing?: boolean;
}
