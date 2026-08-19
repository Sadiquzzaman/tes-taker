import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LookupOrganizationMemberDto {
  @ApiProperty({
    description: 'Teacher/Student public ID, phone, or email',
    example: '10001',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q: string;
}
