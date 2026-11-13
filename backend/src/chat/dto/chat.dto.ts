import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_ATTACHMENTS = 5;

export class SendChatMessageDto {
  @ApiPropertyOptional({ example: 'Tomorrow we start chapter 4. Bring your geometry box.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content?: string;

  @ApiPropertyOptional({ type: [String], description: 'Uploads of the files module with purpose DISCUSSION (at most 5)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsUUID('all', { each: true })
  file_ids?: string[];

  @ApiPropertyOptional({ description: 'The post this is a comment on; empty for a new post' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ description: 'The message this one replies to (shown quoted)' })
  @IsOptional()
  @IsUUID()
  reply_to_id?: string;
}

export class ListChatMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Older than this time (for "load more")' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateGroupChatDto {
  @ApiProperty({ description: '"Only teachers can post" (students still comment)' })
  @IsBoolean()
  announcement_only: boolean;
}

export class PinChatMessageDto {
  @ApiProperty()
  @IsBoolean()
  pinned: boolean;
}

export class MuteChatDto {
  @ApiProperty()
  @IsBoolean()
  muted: boolean;
}

export class StartDirectChatDto {
  @ApiProperty({ description: 'A teacher who teaches you (students), or one of your students (teachers)' })
  @IsUUID()
  user_id: string;
}
