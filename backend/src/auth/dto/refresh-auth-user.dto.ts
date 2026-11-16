import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class RefreshAuthUserDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Must be non empty' })
  @IsString({ message: 'Must be string' })
  refreshToken: string;

  @ApiPropertyOptional({
    description: 'Preserve organization session on refresh (org login only)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({ type: DeviceInfoDto, description: 'The mobile app describes the phone (PM-01); the web leaves it out' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}
