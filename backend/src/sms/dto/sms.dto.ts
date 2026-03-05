import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ 
    description: 'Phone number to send OTP to',
    example: '01734911480'
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ 
    description: 'Phone number',
    example: '01734911480'
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  phone: string;

  @ApiProperty({ 
    description: 'OTP code to verify',
    example: '123456'
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  otp: string;
}

export class ResetSmsCacheDto {
  @ApiProperty({ 
    description: 'Phone number to reset cache for (optional - if not provided, resets all)',
    example: '01712345678',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phone?: string;
} 