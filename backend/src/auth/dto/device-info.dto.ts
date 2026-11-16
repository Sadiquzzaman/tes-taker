import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DevicePlatformEnum } from 'src/user/entities/refresh-token.entity';

/** What the mobile app says about the phone it runs on (PM-01). The web sends nothing. */
export class DeviceInfoDto {
  @ApiPropertyOptional({ enum: DevicePlatformEnum, description: 'WEB when left out' })
  @IsOptional()
  @IsEnum(DevicePlatformEnum)
  platform?: DevicePlatformEnum;

  @ApiPropertyOptional({ description: 'Shown in "Signed-in devices", e.g. "Pixel 8"', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '1.0.0', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  app_version?: string;
}
