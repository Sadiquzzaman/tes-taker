import {
  Body,
  Controller,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { ExamService } from './exam.service';
import { StudentExamService } from './student-exam.service';
import {
  GradeSubmissionDto,
  GradingListQueryDto,
  GradingSummaryQueryDto,
} from './dto/grade-submission.dto';

@ApiTags('Exam Grading')
@Controller({
  path: 'exams/grading',
  version: '1',
})
export class ExamGradingController {
  constructor(
    private readonly examService: ExamService,
    private readonly studentExamService: StudentExamService,
  ) {}

  @Get('list')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List ended exams for grading dashboard',
    description:
      'Returns exams created by the teacher whose end time has passed, with grading status and submission metrics.',
  })
  @ApiResponse({ status: 200, description: 'Grading list retrieved successfully' })
  async getGradingList(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query() query: GradingListQueryDto,
  ) {
    const { items, meta } = await this.examService.getGradingList(jwtPayload, query);
    return {
      message: 'Grading list retrieved successfully',
      payload: items,
      meta,
    };
  }

  @Get(':examId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get grading summary for an exam',
    description:
      'Returns exam stats and paginated student submissions with grading status for the grading detail page.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiResponse({ status: 200, description: 'Grading summary retrieved successfully' })
  async getGradingSummary(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Query() query: GradingSummaryQueryDto,
  ) {
    const payload = await this.examService.getGradingSummary(examId, jwtPayload, query);
    return {
      message: 'Grading summary retrieved successfully',
      payload: {
        exam: payload.exam,
        stats: payload.stats,
        submissions: payload.submissions,
      },
      meta: payload.meta,
    };
  }

  @Get(':examId/submissions/:submissionId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get a submission for grading or review',
    description:
      'Returns manual and auto-scored questions with student answers and current marks for the grading modal.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  async getSubmissionForGrading(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.studentExamService.getSubmissionForGrading(
      examId,
      submissionId,
      jwtPayload,
    );
    return {
      message: 'Submission retrieved successfully',
      payload,
    };
  }

  @Patch(':examId/submissions/:submissionId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Save manual grades for a submission',
    description:
      'Updates marks for manual questions, recomputes total score, and marks submission graded when all manual questions are scored.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiParam({ name: 'submissionId', description: 'Submission UUID' })
  @ApiResponse({ status: 200, description: 'Grades saved successfully' })
  async saveSubmissionGrades(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.studentExamService.saveSubmissionGrades(
      examId,
      submissionId,
      dto,
      jwtPayload,
    );
    return {
      message: 'Grades saved successfully',
      payload,
    };
  }

  @Post(':examId/publish')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Publish exam results to students',
    description:
      'Requires all submitted exams to be fully graded. Sets result_published_at so students can view manual exam results.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiResponse({ status: 201, description: 'Results published successfully' })
  async publishResult(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.publishResult(examId, jwtPayload);
    return {
      message: 'Results published successfully',
      payload,
    };
  }
}
