import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
