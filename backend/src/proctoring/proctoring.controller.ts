import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { RolesGuard } from '../common/guard/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesEnum } from '../common/enums/roles.enum';
import { UserPayload } from '../common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from '../auth/interfaces/jwt-payload.interface';
import { ProctoringStoreService } from './proctoring-store.service';
import { ExamService } from '../exams/exam.service';

@ApiTags('Proctoring')
@ApiBearerAuth('jwt')
@Controller({ path: 'exams', version: '1' })
export class ProctoringController {
  constructor(
    private readonly proctoringStore: ProctoringStoreService,
    private readonly examService: ExamService,
  ) {}

  @Get(':examId/proctoring/sessions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Live proctoring sessions for an exam',
    description:
      'Returns the live student sessions (kept in Redis): status, when last heard from, flags so far; LOST after 60 seconds without a signal (P8-02). Also available via Socket.IO monitor:state on exam:join.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiResponse({ status: 200, description: 'Active proctoring sessions' })
  async getSessions(
    @Param('examId', ParseUUIDPipe) examId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.examService.assertTeacherCanMonitorExam(examId, jwtPayload);
    const sessions = await this.proctoringStore.getExamSessions(examId);
    return {
      message: 'Proctoring sessions retrieved successfully',
      payload: { examId, sessions },
    };
  }
}
