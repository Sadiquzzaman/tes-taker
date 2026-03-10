import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guard/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesEnum } from '../common/enums/roles.enum';
import { RedisService } from './redis.service';

@ApiTags('Redis Admin')
@Controller({
  path: 'admin/redis',
  version: '1',
})
export class RedisAdminController {
  constructor(private readonly redisService: RedisService) {}

  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN)
  @Post('flush')
  @ApiResponse({ status: 200, description: 'Flush all Redis cache' })
  async flushAll() {
    try {
      // Get all keys first
      const keys = await this.redisService.keys('*');
      const deletedCount = await this.redisService.delMultiple(keys);
      
      return {
        success: true,
        message: `Successfully flushed all cache. Deleted ${deletedCount} keys.`,
        data: { deletedCount },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error flushing cache: ${error.message}`,
      };
    }
  }
} 