import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ChatTypeEnum } from '../entities/chat-access-log.entity';
import { MessageReportResolutionEnum, MessageReportStatusEnum } from '../entities/message-report.entity';

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

export class OpenChatDto {
  @ApiProperty({ example: 'A parent complained about messages on 12 November.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class MuteChatUserDto {
  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'How long, in hours (1 hour to 30 days)', example: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  hours: number;

  @ApiPropertyOptional({ example: 'Rude messages to classmates' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class CloseChatDto {
  @ApiProperty({ description: 'true closes the chat (read-only), false reopens it' })
  @IsBoolean()
  closed: boolean;
}

export class ReportMessageDto {
  @ApiProperty({ enum: ChatTypeEnum })
  @IsEnum(ChatTypeEnum)
  chat_type: ChatTypeEnum;

  @ApiProperty()
  @IsUUID()
  chat_id: string;

  @ApiProperty()
  @IsUUID()
  message_id: string;

  @ApiProperty({ example: 'Calling a classmate names' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class ListReportsQueryDto {
  @ApiPropertyOptional({ enum: MessageReportStatusEnum, default: MessageReportStatusEnum.OPEN })
  @IsOptional()
  @IsEnum(MessageReportStatusEnum)
  status?: MessageReportStatusEnum;
}

export class ResolveReportDto {
  @ApiProperty({ enum: MessageReportResolutionEnum, description: 'KEPT leaves the message; DELETED removes it' })
  @IsEnum(MessageReportResolutionEnum)
  resolution: MessageReportResolutionEnum;
}
