import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NotificationChannelEnum } from '../notification.constants';

export class ListInboxQueryDto {
  @ApiPropertyOptional({ description: 'Only unread messages' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread_only?: boolean;

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

export class UpdateNotificationPrefDto {
  @ApiProperty({ example: 'exam.scheduled' })
  @IsString()
  @MaxLength(60)
  event_type: string;

  @ApiProperty({ enum: NotificationChannelEnum, isArray: true, description: 'In-app is always on' })
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(NotificationChannelEnum, { each: true })
  channels: NotificationChannelEnum[];
}
