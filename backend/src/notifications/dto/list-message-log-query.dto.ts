import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { NotificationChannelEnum, OutboxStatusEnum } from '../notification.constants';

/** Filters for the message log (FND-14): date, student (recipient) and type. */
export class ListMessageLogQueryDto {
  @ApiPropertyOptional({ description: 'From this time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Before this time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'The student (or other user) the message was for' })
  @IsOptional()
  @IsUUID()
  recipient_id?: string;

  @ApiPropertyOptional({ description: 'An event (`exam.scheduled`) or an area ending in a dot (`exam.`)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z_]+(\.[a-z_]*)?$/, { message: 'event_type must look like area.event or area.' })
  event_type?: string;

  @ApiPropertyOptional({ enum: NotificationChannelEnum })
  @IsOptional()
  @IsEnum(NotificationChannelEnum)
  channel?: NotificationChannelEnum;

  @ApiPropertyOptional({ enum: OutboxStatusEnum })
  @IsOptional()
  @IsEnum(OutboxStatusEnum)
  status?: OutboxStatusEnum;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
