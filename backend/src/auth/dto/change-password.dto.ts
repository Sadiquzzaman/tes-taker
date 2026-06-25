import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current account password',
    example: 'StrongPass123',
  })
  @IsNotEmpty({ message: 'Current password must be non empty' })
  @IsString({ message: 'Current password must be a string' })
  current_password: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'NewStrongPass123',
    minLength: 8,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'New password must be non empty' })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  new_password: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'NewStrongPass123',
  })
  @IsNotEmpty({ message: 'Confirm password must be non empty' })
  @IsString({ message: 'Confirm password must be a string' })
  confirm_password: string;
}
