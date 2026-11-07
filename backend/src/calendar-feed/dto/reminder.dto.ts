import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, Max, Min, ValidateNested } from 'class-validator';

/** One reminder: minutes before the start and a channel. */
export class ReminderOffsetDto {
  @ApiProperty({ example: 30, description: '5 to 1440 minutes before' })
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes: number;

  @ApiProperty({ enum: ['IN_APP', 'SMS'] })
  @IsIn(['IN_APP', 'SMS'])
  channel: 'IN_APP' | 'SMS';
}

/** `PUT /reminders/defaults/:target`, `PUT /reminders/mine/:target`: up to 5; an empty list switches them off. */
export class SaveRemindersDto {
  @ApiProperty({ type: [ReminderOffsetDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ReminderOffsetDto)
  offsets: ReminderOffsetDto[];
}
