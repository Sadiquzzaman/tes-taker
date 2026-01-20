import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto, AddStudentsToClassDto, RemoveStudentsFromClassDto } from './dto/update-class.dto';

@ApiTags('Classes')
@Controller({
  path: 'classes',
  version: '1',
})
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Create a new class',
    description: 'Teachers can create classes and optionally assign students during creation'
  })
  @ApiResponse({ status: 201, description: 'Class created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only teachers can create classes' })
  async create(
    @Body() dto: CreateClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.create(dto, jwtPayload);
    return { message: 'Class created successfully', payload };
  }

  @Get()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get all classes for the logged-in teacher',
    description: 'Returns all classes created by the authenticated teacher'
  })
  @ApiResponse({ status: 200, description: 'List of classes' })
  async findAll(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.classService.findAll(jwtPayload);
    return { message: 'Classes retrieved successfully', payload };
  }

  @Get('search-students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Search students by name, email, or phone',
    description: 'Search for students to add to a class. Returns matching students with their details.'
  })
  @ApiQuery({ 
    name: 'query', 
    required: true, 
    description: 'Search query (min 2 characters)',
    example: 'John'
  })
  @ApiResponse({ status: 200, description: 'List of matching students' })
  async searchStudents(@Query('query') query: string) {
    const payload = await this.classService.searchStudents(query);
    return { message: 'Students retrieved successfully', payload };
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get a specific class by ID',
    description: 'Returns class details with list of students'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Class details' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.findOne(id, jwtPayload);
    return { message: 'Class retrieved successfully', payload };
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Update a class',
    description: 'Update class name or description'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Class updated successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.update(id, dto, jwtPayload);
    return { message: 'Class updated successfully', payload };
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Delete a class',
    description: 'Permanently delete a class and all its student associations'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Class deleted successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.classService.delete(id, jwtPayload);
    return { message: 'Class deleted successfully' };
  }

  @Post(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Add students to a class',
    description: 'Add multiple students to an existing class. Duplicate students are automatically filtered.'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Students added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or students not found' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async addStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStudentsToClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.addStudentsToClass(id, dto.student_ids, jwtPayload);
    return { message: 'Students added successfully', payload };
  }

  @Delete(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Remove students from a class',
    description: 'Remove multiple students from an existing class'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Students removed successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async removeStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveStudentsFromClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.removeStudentsFromClass(id, dto.student_ids, jwtPayload);
    return { message: 'Students removed successfully', payload };
  }

  @Get(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get all students in a class',
    description: 'Returns list of all students enrolled in the specified class'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'List of students in the class' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.getClassStudents(id, jwtPayload);
    return { message: 'Students retrieved successfully', payload };
  }
}
