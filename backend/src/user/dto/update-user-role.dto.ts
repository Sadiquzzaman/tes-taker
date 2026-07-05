import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RolesEnum } from 'src/common/enums/roles.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: [RolesEnum.STUDENT, RolesEnum.TEACHER] })
  @IsEnum([RolesEnum.STUDENT, RolesEnum.TEACHER], {
    message: 'Role must be either STUDENT or TEACHER',
  })
  role: RolesEnum.STUDENT | RolesEnum.TEACHER;
}
