import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    description:
      'Email or phone of the account to recover. OTP is sent via email when an email is provided, or via SMS when a phone is provided.',
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
}
