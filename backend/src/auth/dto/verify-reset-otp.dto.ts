import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyResetOtpDto {
  @ApiProperty({
    description:
      'Email or phone used to request the reset OTP (must match the identifier from forgot-password)',
    example: '01734911480',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Phone number or email is required' })
  @IsString({ message: 'Identifier must be a string' })
  @Matches(/^([^\s@]+@[^\s@]+\.[^\s@]+|01\d{9})$/, {
    message: 'Identifier must be a valid email address or Bangladeshi mobile number',
  })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
  })
  identifier: string;

  @ApiProperty({
    description: 'OTP code received via the channel matching the identifier (email or SMS)',
    example: '123456',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  otp: string;
}
