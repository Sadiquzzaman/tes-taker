import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

export class AddOrganizationMemberDto {
  @ApiPropertyOptional({
    description: 'Single search value: Teacher/Student public ID, phone, or email',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  query?: string;

  @ApiPropertyOptional({
    description: 'Phone number (required if query and email are omitted)',
    example: '01734911480',
  })
  @ValidateIf((o: AddOrganizationMemberDto) => !o.query && !o.email)
  @IsString()
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email (required if query and phone are omitted)',
    example: 'teacher@example.com',
  })
  @ValidateIf((o: AddOrganizationMemberDto) => !o.query && !o.phone)
  @IsEmail()
  @MaxLength(100)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    enum: [
      OrganizationMemberRoleEnum.ADMIN,
      OrganizationMemberRoleEnum.ASSISTANT,
      OrganizationMemberRoleEnum.TEACHER,
      OrganizationMemberRoleEnum.STUDENT,
    ],
    default: OrganizationMemberRoleEnum.TEACHER,
    description: 'Member role to assign (OWNER cannot be assigned via invite)',
  })
  @IsOptional()
  @IsEnum(OrganizationMemberRoleEnum)
  role?: OrganizationMemberRoleEnum;
}
