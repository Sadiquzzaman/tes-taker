import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, Matches, ValidateIf, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestLoginOtpDto {
  @ApiPropertyOptional({
    description: 'User email address for login. Either email or phone must be provided.',
    example: 'sadikuzzaman1996@gmail.com',
    maxLength: 100
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: 'Email is required when phone is not provided' })
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: 'User phone number for login. Either email or phone must be provided. Must be a valid Bangladeshi mobile number.',
    example: '01734911480',
    maxLength: 15
  })
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'Phone number is required when email is not provided' })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15, { message: 'Maximum 15 characters supported' })
  phone?: string;
}

export class VerifyLoginOtpDto {
  @ApiPropertyOptional({
    description: 'User email address used for login. Either email or phone must be provided.',
    example: 'sadikuzzaman1996@gmail.com',
    maxLength: 100
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: 'Email is required when phone is not provided' })
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: 'User phone number used for login. Either email or phone must be provided. Must be a valid Bangladeshi mobile number.',
    example: '01734911480',
    maxLength: 15
  })
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'Phone number is required when email is not provided' })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15, { message: 'Maximum 15 characters supported' })
  phone?: string;

  @ApiProperty({
    description: 'OTP code received via SMS. Must be 6 digits.',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
