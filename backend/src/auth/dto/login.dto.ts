import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, Matches, ValidateIf, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({
    description: 'User email address for login. Either email or phone must be provided.',
    example: 'sadikuzzaman1996@gmail.com',
    maxLength: 100
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: 'Email is required when phone is not provided' })
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
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

  @ApiProperty({
    description: 'User password',
    example: 'StrongPass123'
  })
  @Exclude({ toPlainOnly: true })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  password: string;
}
