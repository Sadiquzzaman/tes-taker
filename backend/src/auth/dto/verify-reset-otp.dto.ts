import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyResetOtpDto {
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
}
