import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from 'src/common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current account password',
    example: 'StrongPass123!',
  })
  @IsNotEmpty({ message: 'Current password must be non empty' })
  @IsString({ message: 'Current password must be a string' })
  current_password: string;

  @ApiProperty({
    description: 'New password (min 8 chars, upper, lower, number, special)',
    example: 'NewStrongPass123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'New password must be non empty' })
  @IsString({ message: 'New password must be a string' })
  @IsStrongPassword('New password')
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  new_password: string;

  @ApiProperty({
    description: 'Confirm new password (must match new password)',
    example: 'NewStrongPass123!',
  })
  @IsNotEmpty({ message: 'Confirm password must be non empty' })
  @IsString({ message: 'Confirm password must be a string' })
  confirm_password: string;
}
