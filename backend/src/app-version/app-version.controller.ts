import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AppPlatform, AppVersionInfo, updateNeeded } from './app-version';

const VERSION = /^\d+(\.\d+){0,3}([-+][\w.]+)?$/;

/**
 * Which mobile app versions the API still serves (PM-03). Set per platform with APP_MIN_VERSION_*,
 * APP_LATEST_VERSION_* and APP_UPDATE_URL_* (env.example); unset = every version is fine.
 */
@ApiTags('App')
@Controller({ path: 'app', version: '1' })
export class AppVersionController {
  constructor(private readonly config: ConfigService) {}

  @Get('version')
  @ApiOperation({
    summary: 'The minimum and latest mobile app version (PM-03)',
    description: 'No sign-in needed. With `current`, `update` says NONE, OPTIONAL (below latest) or REQUIRED (below minimum: the app must update first).',
  })
  @ApiQuery({ name: 'platform', enum: ['ANDROID', 'IOS'] })
  @ApiQuery({ name: 'current', required: false, example: '1.0.0' })
  version(@Query('platform') platformRaw: string, @Query('current') current?: string) {
    const platform = String(platformRaw ?? '').toUpperCase() as AppPlatform;
    if (platform !== 'ANDROID' && platform !== 'IOS') {
      throw new BadRequestException('platform must be ANDROID or IOS');
    }
    if (current !== undefined && !VERSION.test(current)) {
      throw new BadRequestException('current must be a version such as 1.0.0');
    }
    const read = (key: string, fallback: string) => {
      const value = this.config.get<string>(`${key}_${platform}`)?.trim();
      return value && VERSION.test(value) ? value : fallback;
    };
    const minimum = read('APP_MIN_VERSION', '0.0.0');
    const latest = read('APP_LATEST_VERSION', minimum);
    const payload: AppVersionInfo = {
      platform,
      minimum,
      latest,
      update_url: this.config.get<string>(`APP_UPDATE_URL_${platform}`)?.trim() || null,
      update: current ? updateNeeded(current, minimum, latest) : null,
    };
    return { message: 'App version', payload };
  }
}
