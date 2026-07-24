import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { TeacherRequestService } from './teacher-request.service';
import { ListTeacherRequestsQueryDto } from './dto/list-teacher-requests-query.dto';
import { ReviewTeacherRequestDto } from './dto/review-teacher-request.dto';

@ApiTags('Teacher Requests')
@Controller({ path: 'teacher-requests', version: '1' })
export class TeacherRequestController {
  constructor(private readonly teacherRequestService: TeacherRequestService) {}

  @Get('me')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT, RolesEnum.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current user teacher request status' })
  @ApiResponse({ status: 200, description: 'Teacher request retrieved' })
  async getMyRequest(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.teacherRequestService.getMyRequest(jwtPayload.id);
    return { message: 'Teacher request retrieved successfully', payload };
  }

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request to become a teacher' })
  @ApiResponse({ status: 201, description: 'Teacher request submitted' })
  async createRequest(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.teacherRequestService.createRequest(jwtPayload.id);
    return { message: 'Teacher request submitted successfully', payload };
  }

  @Get('admin')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List teacher requests for admin review' })
  @ApiResponse({ status: 200, description: 'Teacher requests retrieved' })
  async listForAdmin(@Query() query: ListTeacherRequestsQueryDto) {
    const { requests, meta } = await this.teacherRequestService.listForAdmin(query);
    return { message: 'Teacher requests retrieved successfully', payload: requests, meta };
  }

  @Patch('admin/:requestId/approve')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a teacher request and promote the user' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Teacher request approved' })
  async approve(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewTeacherRequestDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.teacherRequestService.approve(
      jwtPayload.id,
      requestId,
      dto.note,
    );
    return { message: 'Teacher request approved successfully', payload };
  }

  @Patch('admin/:requestId/reject')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a teacher request' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Teacher request rejected' })
  async reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewTeacherRequestDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.teacherRequestService.reject(
      jwtPayload.id,
      requestId,
      dto.note,
    );
    return { message: 'Teacher request rejected successfully', payload };
  }
}
