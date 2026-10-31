import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES, UPLOAD_RULES } from '../file-rules';

/** Step 1 of an upload (design §8.5): what the client is about to upload. */
export class CreateUploadDto {
  @ApiProperty({ enum: Object.keys(UPLOAD_RULES), example: 'DISCUSSION' })
  @IsString()
  @MaxLength(30)
  purpose: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(100)
  mime: string;

  @ApiProperty({ description: 'Bytes the client will upload (at most 20 MB)', example: 482133 })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  size: number;

  @ApiPropertyOptional({ example: 'homework-page-1.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Class id; required for DISCUSSION files' })
  @IsOptional()
  @IsUUID()
  scope_id?: string;
}
