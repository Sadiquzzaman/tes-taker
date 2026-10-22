import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum DiscussionPostCategoryEnum {
  GENERAL = 'general',
  QUESTION = 'question',
  IDEA = 'idea',
  RESOURCE = 'resource',
}

export class DiscussionAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size: number;

  @ApiProperty({ enum: ['image', 'file'] })
  @IsIn(['image', 'file'])
  kind: 'image' | 'file';
}

export class DiscussionPostContentDto {
  @ApiPropertyOptional({ maxLength: 4000, description: 'Plain text body. Required if no attachments.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ enum: DiscussionPostCategoryEnum, default: DiscussionPostCategoryEnum.GENERAL })
  @IsOptional()
  @IsEnum(DiscussionPostCategoryEnum)
  category?: DiscussionPostCategoryEnum;

  @ApiPropertyOptional({ type: [DiscussionAttachmentDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DiscussionAttachmentDto)
  attachments?: DiscussionAttachmentDto[];
}

export class DiscussionCommentContentDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class PrivateMessageContentDto {
  @ApiPropertyOptional({ maxLength: 4000, description: 'Plain text body. Required if no attachments.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ type: [DiscussionAttachmentDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DiscussionAttachmentDto)
  attachments?: DiscussionAttachmentDto[];
}
