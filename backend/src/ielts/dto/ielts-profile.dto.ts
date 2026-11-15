import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { IeltsModuleEnum, IeltsTestTypeEnum } from '../entities/ielts-profile.entity';

export class UpdateIeltsProfileDto {
  @ApiPropertyOptional({ enum: IeltsTestTypeEnum, nullable: true })
  @IsOptional()
  @IsEnum(IeltsTestTypeEnum)
  test_type?: IeltsTestTypeEnum | null;

  @ApiPropertyOptional({ example: 7, nullable: true, description: '0–9 in half bands' })
  @IsOptional()
  target_overall?: number | null;

  @ApiPropertyOptional({ example: { LISTENING: 7, READING: 7, WRITING: 6.5, SPEAKING: 6.5 }, description: 'Per module, 0–9 in half bands' })
  @IsOptional()
  @IsObject()
  target_bands?: Partial<Record<IeltsModuleEnum, number | null>>;

  @ApiPropertyOptional({ example: '2027-01-20', nullable: true })
  @IsOptional()
  @IsDateString()
  test_date?: string | null;
}

export class ListIeltsProfilesQueryDto {
  @ApiPropertyOptional({ description: 'A batch (section); without it, every student of the centre' })
  @IsOptional()
  @IsUUID()
  section_id?: string;
}
