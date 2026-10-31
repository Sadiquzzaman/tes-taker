import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { GuardianRelationEnum } from '../entities/guardian.entity';

export const GUARDIAN_SMS_LOCALES = ['bn', 'en'] as const;
export type GuardianSmsLocale = (typeof GUARDIAN_SMS_LOCALES)[number];

/** One guardian: with `id` to keep (and change) an existing one, without to add one. */
export class GuardianInputDto {
  @ApiPropertyOptional({ description: 'An existing guardian of this student' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Guardian name' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: GuardianRelationEnum })
  @IsEnum(GuardianRelationEnum)
  relation: GuardianRelationEnum;

  @ApiProperty({ example: '01XXXXXXXXX', description: 'Bangladeshi mobile number' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ description: 'Exactly one guardian is primary; the first one when none is marked' })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

/** A student's guardians as a whole (FND-09) and their SMS language (FND-10). */
export class SaveGuardiansDto {
  @ApiProperty({ type: [GuardianInputDto], description: 'At most 2. Guardians left out are removed (kept in history).' })
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => GuardianInputDto)
  guardians: GuardianInputDto[];

  @ApiPropertyOptional({ enum: GUARDIAN_SMS_LOCALES, nullable: true, description: "bn | en for this student; null = the organisation's" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(GUARDIAN_SMS_LOCALES)
  sms_locale?: GuardianSmsLocale | null;
}
