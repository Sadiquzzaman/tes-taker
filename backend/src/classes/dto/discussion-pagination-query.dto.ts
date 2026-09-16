import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DiscussionPostCategoryEnum } from './discussion-content.dto';

export class DiscussionPaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: DiscussionPostCategoryEnum,
    description: 'Filter public posts by category. Omit for all.',
  })
  @IsOptional()
  @IsEnum(DiscussionPostCategoryEnum)
  category?: DiscussionPostCategoryEnum;
}
