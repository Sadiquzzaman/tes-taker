import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsIn, IsOptional } from 'class-validator';
import { BandRow } from '../bands';
import { IeltsModuleEnum, IeltsTestTypeEnum } from '../entities/ielts-profile.entity';

export class IeltsBandTableScopeDto {
  @ApiProperty({ enum: [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING] })
  @IsIn([IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING])
  module: IeltsModuleEnum.LISTENING | IeltsModuleEnum.READING;

  @ApiPropertyOptional({ enum: IeltsTestTypeEnum, description: 'Reading only: Academic or General Training' })
  @IsOptional()
  @IsEnum(IeltsTestTypeEnum)
  test_type?: IeltsTestTypeEnum | null;
}

export class UpdateIeltsBandTableDto extends IeltsBandTableScopeDto {
  @ApiProperty({ example: [{ min_raw: 39, band: 9 }, { min_raw: 30, band: 7 }, { min_raw: 0, band: 0 }], description: 'Highest raw score first, ending at 0' })
  @IsArray()
  rows: BandRow[];
}
