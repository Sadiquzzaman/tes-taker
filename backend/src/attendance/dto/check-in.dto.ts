import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * A self check-in (ATT-04): the class session's slot (today's date and time come from the server)
 * and, for an in-person class, the browser's position and its accuracy.
 */
export class CheckInDto {
  @ApiProperty({ description: "The routine slot of today's class" })
  @IsUUID()
  slot_id: string;

  @ApiPropertyOptional({ example: 23.7577, description: 'In-person classes: latitude from the browser' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 90.3897, description: 'In-person classes: longitude from the browser' })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 25, description: 'In-person classes: accuracy the browser reports, in metres' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracy_m?: number;
}
