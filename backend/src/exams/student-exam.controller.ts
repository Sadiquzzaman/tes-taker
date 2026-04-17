import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
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
import { StudentExamService } from './student-exam.service';
import {
  StartExamDto,
  SaveAnswerDto,
  SubmitExamDto,
  ReportViolationDto,
} from './dto/student-exam.dto';
import { Request } from 'express';

@ApiTags('Student Exams')
@Controller({
  path: 'student/exams',
  version: '1',
})
export class StudentExamController {
  constructor(private readonly studentExamService: StudentExamService) {}

  // ========================
  // STUDENT DASHBOARD
  // ========================

  @Get('upcoming')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Get upcoming exams',
    description: 'Returns list of upcoming exams for the logged-in student with sorting capability',
  })
  @ApiQuery({ name: 'sort_order', enum: ['ASC', 'DESC'], required: false, description: 'Sort by date' })
  @ApiQuery({ name: 'include_past', type: Boolean, required: false, description: 'Include past exams' })
  @ApiResponse({ status: 200, description: 'List of upcoming exams' })
  async getUpcomingExams(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query('sort_order') sortOrder: 'ASC' | 'DESC' = 'ASC',
    @Query('include_past') includePast: string = 'false',
  ) {
    const payload = await this.studentExamService.getUpcomingExams(
      jwtPayload.id,
      sortOrder,
      includePast === 'true',
    );
    return { message: 'Upcoming exams retrieved successfully', payload };
  }

  @Get('history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Get exam history',
    description: 'Returns list of completed exams with scores',
  })
  @ApiResponse({ status: 200, description: 'Exam history' })
  async getExamHistory(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.studentExamService.getExamHistory(jwtPayload.id);
    return { message: 'Exam history retrieved successfully', payload };
  }

  // ========================
  // EXAM ACCESS
  // ========================

  @Get(':examId/validate')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Validate exam access',
    description:
      'Check if student can access the exam. For audience `anyone`, pass invite_token from the teacher share link.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateAccess(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query('invite_token') inviteToken?: string,
  ) {
    const payload = await this.studentExamService.validateExamAccess(
      examId,
      jwtPayload.id,
      inviteToken,
    );
    return { 
      message: payload.canAccess ? 'Access granted' : 'Access denied', 
      payload: {
        can_access: payload.canAccess,
        reason: payload.reason,
      }
    };
  }

  @Get(':examId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Get exam for taking',
    description:
      'Get exam details with questions. Correct answers are hidden. For audience `anyone`, pass invite_token.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 200, description: 'Exam details with questions' })
  @ApiResponse({ status: 403, description: 'Access denied - not assigned or excluded' })
  async getExam(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query('invite_token') inviteToken?: string,
  ) {
    const payload = await this.studentExamService.getExamForStudent(
      examId,
      jwtPayload.id,
      inviteToken,
    );
    return { message: 'Exam retrieved successfully', payload };
  }

  // ========================
  // EXAM TAKING
  // ========================

  @Post(':examId/start')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Start an exam',
    description:
      'Start the exam session. Creates a submission record and starts the timer. For audience `anyone`, pass invite_token.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 201, description: 'Exam started successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 400, description: 'Already started or submitted' })
  async startExam(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: StartExamDto,
    @Req() request: Request,
    @Query('invite_token') inviteToken?: string,
  ) {
    const ipAddress = request.ip || request.socket.remoteAddress;
    const payload = await this.studentExamService.startExam(
      examId,
      jwtPayload.id,
      dto,
      ipAddress,
      inviteToken,
    );
    return { message: 'Exam started successfully', payload };
  }

  @Post(':examId/save-answer')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Save an answer',
    description: 'Auto-save an answer during the exam. For audience `anyone`, pass invite_token.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 201, description: 'Answer saved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 400, description: 'Invalid question or exam not started' })
  async saveAnswer(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: SaveAnswerDto,
    @Query('invite_token') inviteToken?: string,
  ) {
    const payload = await this.studentExamService.saveAnswer(
      examId,
      jwtPayload.id,
      dto,
      inviteToken,
    );
    return { message: 'Answer saved successfully', payload: { question_id: dto.question_id } };
  }

  @Post(':examId/submit')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Submit exam',
    description: 'Submit the exam with all answers. Scores objective items; sets max score for essays.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 201, description: 'Exam submitted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 400, description: 'Already submitted or no active session' })
  async submitExam(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: SubmitExamDto,
    @Query('invite_token') inviteToken?: string,
  ) {
    const payload = await this.studentExamService.submitExam(
      examId,
      jwtPayload.id,
      dto,
      false,
      inviteToken,
    );
    return payload;
  }

  @Post(':examId/auto-submit')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Auto-submit exam',
    description: 'Auto-submit when time expires. For audience `anyone`, pass invite_token.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 201, description: 'Exam auto-submitted' })
  async autoSubmitExam(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: SubmitExamDto,
    @Query('invite_token') inviteToken?: string,
  ) {
    const payload = await this.studentExamService.submitExam(
      examId,
      jwtPayload.id,
      dto,
      true,
      inviteToken,
    );
    return payload;
  }

  @Post(':examId/report-violation')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Report violation',
    description: 'Report exam violations like tab/browser switch. For audience `anyone`, pass invite_token.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiQuery({
    name: 'invite_token',
    required: false,
    description: 'Required when exam.test_audience is `anyone`',
  })
  @ApiResponse({ status: 201, description: 'Violation recorded' })
  async reportViolation(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() dto: ReportViolationDto,
    @Query('invite_token') inviteToken?: string,
  ) {
    await this.studentExamService.reportViolation(examId, jwtPayload.id, dto, inviteToken);
    return { message: 'Violation recorded' };
  }

  // ========================
  // EXAM RESULTS
  // ========================

  @Get(':examId/result')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Get exam result',
    description: 'Get detailed result after exam submission. Shows correct answers and explanations.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiResponse({ status: 200, description: 'Exam result' })
  @ApiResponse({ status: 404, description: 'No submission found' })
  async getExamResult(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.studentExamService.getExamResult(examId, jwtPayload.id);
    return { message: 'Exam result retrieved successfully', payload };
  }
}
