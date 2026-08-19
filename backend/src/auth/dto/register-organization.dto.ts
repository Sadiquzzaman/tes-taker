import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Exclude, Transform } from 'class-transformer';
import { IsStrongPassword } from 'src/common/decorators/is-strong-password.decorator';

export class RegisterOrganizationDto {
  @ApiProperty({
    description: 'Organization / school name',
    example: 'ABC School',
    maxLength: 200,
  })
  @IsNotEmpty({ message: 'Organization name must be non empty' })
  @IsString()
  @MaxLength(200)
  organization_name: string;

  @ApiProperty({
    description: 'Owner full name',
    example: 'Sadiquzzaman Shovon',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Full name must be non empty' })
  @IsString()
  @MaxLength(100)
  full_name: string;

  @ApiProperty({
    description: 'Owner phone number (required). OTP will be sent for verification.',
    example: '01734911480',
    maxLength: 15,
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15)
  phone: string;

  @ApiPropertyOptional({
    description: 'Owner email (optional)',
    example: 'owner@school.com',
    maxLength: 100,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({
    description: 'Password (min 8 chars, upper, lower, number, special)',
    example: 'StrongPass123!',
  })
  @Exclude({ toPlainOnly: true })
  @IsNotEmpty()
  @IsString()
  @IsStrongPassword('Password')
  @MaxLength(100)
  password: string;

  @ApiProperty({
    description: 'Confirm password (must match password)',
    example: 'StrongPass123!',
  })
  @IsNotEmpty()
  @IsString()
  confirm_password: string;
}
