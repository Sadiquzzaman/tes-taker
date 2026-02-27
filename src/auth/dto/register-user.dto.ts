import { 
  ApiPropertyOptional, 
  ApiProperty 
} from '@nestjs/swagger';
import { 
  IsEmail, 
  IsNotEmpty, 
  IsString, 
  MaxLength, 
  Matches, 
  IsEnum, 
  ValidateIf,
  MinLength,
  IsOptional
} from 'class-validator';
import { Exclude, Transform } from 'class-transformer';
import { RolesEnum } from 'src/common/enums/roles.enum';

export class RegisterUserDto {
  @ApiProperty({ 
    description: 'User full name',
    example: 'Sadiquzzaman Shovon',
    maxLength: 100
  })
  @IsNotEmpty({ message: 'Full name must be non empty' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(100, { message: 'Full name is maximum 100 characters supported' })
  full_name: string;

  @ApiPropertyOptional({ 
    description: 'User email address (optional). Phone number is required for registration.',
    example: 'sadikuzzaman1996@gmail.com',
    maxLength: 100
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({ 
    description: 'User phone number (required). Must be a valid Bangladeshi mobile number. OTP will be sent to this number for verification.',
    example: '01734911480',
    maxLength: 15
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15, { message: 'Maximum 15 characters supported' })
  phone: string;

  @ApiProperty({ 
    description: 'User password (minimum 8 characters)',
    example: 'StrongPass123',
    minLength: 8,
    maxLength: 100
  })
  @Exclude({ toPlainOnly: true })
  @IsNotEmpty({ message: 'Password must be non empty' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  password: string;

  @ApiProperty({ 
    description: 'Confirm password (must match password)',
    example: 'StrongPass123'
  })
  @IsNotEmpty({ message: 'Confirm password must be non empty' })
  @IsString({ message: 'Confirm password must be a string' })
  confirm_password: string;

  @ApiPropertyOptional({ 
    description: 'User role (defaults to STUDENT if not provided)',
    enum: RolesEnum,
    default: RolesEnum.STUDENT
  })
  @IsOptional()
  @IsEnum(RolesEnum, { message: 'Role type must be one of: SUPER_ADMIN, ADMIN, TEACHER, STUDENT' })
  role?: RolesEnum;
}
