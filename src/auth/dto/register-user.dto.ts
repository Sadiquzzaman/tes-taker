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
    description: 'User first name',
    example: 'Sadiquzzaman',
    maxLength: 65
  })
  @IsNotEmpty({ message: 'First name must be non empty' })
  @IsString({ message: 'First name must be a string' })
  @MaxLength(65, { message: 'First name is maximum 65 characters supported' })
  first_name: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Shovon',
    maxLength: 65
  })
  @IsNotEmpty({ message: 'Last name must be non empty' })
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(65, { message: 'Last name is maximum 65 characters supported' })
  last_name: string;

  @ApiPropertyOptional({ 
    description: 'User email address (required if phone is not provided)',
    example: 'sadikuzzaman1996@gmail.com',
    maxLength: 100
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: 'Email must be provided if phone is empty' })
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(100, { message: 'Maximum 100 characters supported' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({ 
    description: 'User phone number (required if email is not provided). Must be valid Bangladeshi number',
    example: '01734911480',
    maxLength: 15
  })
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'Phone number must be provided if email is empty' })
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^01[3-9]\d{8}$/, { message: 'Phone number must be a valid Bangladeshi mobile number' })
  @MaxLength(15, { message: 'Maximum 15 characters supported' })
  phone?: string;

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
