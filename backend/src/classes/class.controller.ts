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
import { AddStudentsBulkDto } from './dto/add-students-bulk.dto';

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
    const result = await this.classService.create(dto, jwtPayload);
    return {
      message: 'Class created successfully',
      payload: result.class,
      studentResults: result.studentResults,
    };
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
    description: 'Returns list of all students enrolled in the specified class with their status'
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

  @Post(':id/students/bulk')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Add students to class by phone or email (bulk)',
    description: 'Add multiple students to a class by providing their phone numbers or email addresses. Existing students are added directly. Non-onboarded students receive invitation links via SMS or email.'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Students processed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async addStudentsBulk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStudentsBulkDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.addStudentsByPhoneOrEmail(id, dto.contacts, jwtPayload);
    return { message: 'Students processed successfully', payload };
  }

  @Post(':id/students/:studentId/approve')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Approve a pending student',
    description: 'Approve a student who is waiting for teacher approval to join the class'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({ status: 200, description: 'Student approved successfully' })
  @ApiResponse({ status: 400, description: 'Student is not in pending status' })
  @ApiResponse({ status: 404, description: 'Class or student not found' })
  async approveStudent(
    @Param('id', ParseUUIDPipe) classId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.approveStudent(classId, studentId, jwtPayload);
    return { message: 'Student approved successfully', payload };
  }

  @Post(':id/share')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Generate share link for class',
    description: 'Generate a shareable link that allows onboarded students to join the class. Only verified students can join via this link.'
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  @ApiResponse({ status: 200, description: 'Share link generated successfully' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async generateShareLink(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const shareLink = await this.classService.generateShareLink(id, jwtPayload);
    return { message: 'Share link generated successfully', payload: { shareLink } };
  }

  @Post('join/:shareToken')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({ 
    summary: 'Join class via share link',
    description: 'Join a class using a share token. Student must be authenticated and verified. Status will be PENDING until teacher approves.'
  })
  @ApiParam({ name: 'shareToken', description: 'Share token from class share link' })
  @ApiResponse({ status: 200, description: 'Successfully joined class (pending approval)' })
  @ApiResponse({ status: 400, description: 'Invalid token or student not verified' })
  @ApiResponse({ status: 404, description: 'Invalid share link' })
  async joinClassByShareToken(
    @Param('shareToken') shareToken: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.joinClassByShareToken(shareToken, jwtPayload.id);
    return { message: 'Successfully joined class. Waiting for teacher approval.', payload };
  }
}
