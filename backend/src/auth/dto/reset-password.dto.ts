import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Phone number or email address used to request the reset OTP',
    example: '01734911480',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Phone number or email is required' })
  @IsString({ message: 'Identifier must be a string' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  identifier: string;

  @ApiProperty({
    description: 'OTP code received via SMS and email',
    example: '123456',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  otp: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Password must be non empty' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  password: string;

  @ApiProperty({
    description: 'Confirm password (must match password)',
    example: 'StrongPass123',
  })
  @IsNotEmpty({ message: 'Confirm password must be non empty' })
  @IsString({ message: 'Confirm password must be a string' })
  confirm_password: string;
}
