import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: "This device's refresh token" })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
