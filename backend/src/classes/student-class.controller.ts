import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ClassService } from './class.service';

@ApiTags('Student Classes')
@Controller({
  path: 'student/classes',
  version: '1',
})
export class StudentClassController {
  constructor(private readonly classService: ClassService) {}

  @Get()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'List classes for the logged-in student',
    description: 'Returns all classes where the student has JOINED status.',
  })
  @ApiResponse({ status: 200, description: 'List of classes' })
  async findAll(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.classService.findAllForStudent(jwtPayload.id);
    return { message: 'Classes retrieved successfully', payload };
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Get class details for student',
    description:
      'Basic class info plus classmates (full name and joined_at only) for JOINED students in the same class.',
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Class details' })
  @ApiResponse({ status: 403, description: 'Not enrolled in this class' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.findOneForStudent(id, jwtPayload.id);
    return { message: 'Class retrieved successfully', payload };
  }
}
