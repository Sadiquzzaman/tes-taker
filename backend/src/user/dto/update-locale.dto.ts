import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { USER_LOCALES, UserLocale } from '../entities/user.entity';

export class UpdateLocaleDto {
  @ApiProperty({ enum: USER_LOCALES, example: 'bn', description: 'App language for this user' })
  @IsIn(USER_LOCALES)
  locale: UserLocale;
}
