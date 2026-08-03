import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewTeacherRequestDto {
  @ApiPropertyOptional({ description: 'Optional note stored with the decision' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
