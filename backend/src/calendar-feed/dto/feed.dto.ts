import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/** `GET /calendar/feed`: school dates in the organisation's time zone, at most 62 days. */
export class CalendarFeedQueryDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(YYYY_MM_DD, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @ApiProperty({ example: '2026-11-30' })
  @Matches(YYYY_MM_DD, { message: 'to must be YYYY-MM-DD' })
  to: string;
}
