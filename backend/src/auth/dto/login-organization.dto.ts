import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Exclude } from 'class-transformer';

export class LoginOrganizationDto {
  @ApiProperty({
    description: 'Public organization number',
    example: '100001',
  })
  @IsNotEmpty({ message: 'Organization number is required' })
  @IsString({ message: 'Organization number must be a string' })
  @Matches(/^\d{6,}$/, { message: 'Organization number must be a numeric code' })
  organization_number: string;

  @ApiProperty({
    description: 'Member phone number',
    example: '01734911480',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^01\d{9}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15)
  phone: string;

  @ApiProperty({
    description: 'Account password',
    example: 'StrongPass123!',
  })
  @Exclude({ toPlainOnly: true })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MaxLength(100)
  password: string;
}
