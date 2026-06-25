import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Phone number or email address of the account to recover',
    example: '01734911480',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Phone number or email is required' })
  @IsString({ message: 'Identifier must be a string' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  identifier: string;
}
