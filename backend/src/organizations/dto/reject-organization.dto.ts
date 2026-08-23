import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectOrganizationDto {
  @ApiPropertyOptional({ description: 'Reason for rejecting the organization' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
