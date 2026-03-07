import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetKeysDto {
  @ApiPropertyOptional({
    description: 'Redis key pattern to search for',
    example: 'sms_*',
    default: '*'
  })
  @IsOptional()
  @IsString()
  pattern?: string;
}

export class DeleteKeysDto {
  @ApiPropertyOptional({
    description: 'Redis key pattern to delete',
    example: 'sms_*',
    default: '*'
  })
  @IsOptional()
  @IsString()
  pattern?: string;
}

export class CacheInfoResponseDto {
  @ApiProperty({ description: 'Total number of keys in Redis' })
  totalKeys: number;

  @ApiProperty({ description: 'Number of SMS-related keys' })
  smsKeys: number;

  @ApiProperty({ description: 'Sample keys for each pattern' })
  sampleKeys: {
    all: string[];
    sms: string[];
  };
}

export class DeleteKeysResponseDto {
  @ApiProperty({ description: 'Number of keys deleted' })
  deletedCount: number;

  @ApiProperty({ description: 'Pattern used for deletion' })
  pattern: string;
}
 