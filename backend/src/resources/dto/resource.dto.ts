import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ResourceTypeEnum } from '../entities/resource.entity';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateResourceDto {
  @ApiProperty({ enum: [ResourceTypeEnum.FILE, ResourceTypeEnum.LINK] })
  @IsIn([ResourceTypeEnum.FILE, ResourceTypeEnum.LINK])
  type: ResourceTypeEnum;

  @ApiProperty({ example: 'Chapter 4 notes' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'FILE: an upload of the files module with purpose RESOURCE' })
  @IsOptional()
  @IsUUID()
  file_id?: string;

  @ApiPropertyOptional({ description: 'LINK: http(s) address (YouTube, Google Drive, any page)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  folder_id?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true, description: 'false: students can only view it (RES-05)' })
  @IsOptional()
  @IsBoolean()
  download_allowed?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Subject classes to share it with' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  offering_ids?: string[];
}

export class UpdateResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  subject_id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null moves it out of any folder' })
  @IsOptional()
  @IsUUID()
  folder_id?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  download_allowed?: boolean;

  @ApiPropertyOptional({ description: 'Archived resources are hidden from students but kept' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the subject classes it is shared with' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  offering_ids?: string[];
}

export class ListResourcesQueryDto {
  @ApiPropertyOptional({ description: 'Title or description contains' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @ApiPropertyOptional({ description: 'Staff: a folder, or "none" for resources outside folders' })
  @IsOptional()
  @IsString()
  folder_id?: string;

  @ApiPropertyOptional({ enum: ResourceTypeEnum })
  @IsOptional()
  @IsEnum(ResourceTypeEnum)
  type?: ResourceTypeEnum;

  @ApiPropertyOptional({ description: 'Staff: show archived ones instead' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived?: boolean;
}

export class FolderDto {
  @ApiProperty({ example: 'Chapter 4' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
