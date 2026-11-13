import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RolesGuard } from '../common/guard/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesEnum } from '../common/enums/roles.enum';
import { UserPayload } from '../common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from '../auth/interfaces/jwt-payload.interface';
import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { ProctoringEventsService } from '../exams/proctoring-events.service';
import { StudentExamService } from '../exams/student-exam.service';
import { ProctoringStoreService } from './proctoring-store.service';
import { ProctoringGateway } from './proctoring.gateway';
import { ExamService } from '../exams/exam.service';

export class WarnStudentDto {
  @ApiProperty({ example: 'Please keep your eyes on your own screen.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  message: string;
}

export class EndStudentExamDto {
  @ApiProperty({ example: 'Talking to someone off camera after two warnings.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

/**
 * The live monitor (P8-03, PRO-03, PRO-07): every student taking an exam with their status, time
 * left and flags; one student's flag timeline; a warning to one student or ending their exam.
 * For the teacher who made the exam, and the organisation's owners and admins.
 */
@ApiTags('Proctoring')
@ApiBearerAuth('jwt')
@Controller({ path: 'exams', version: '1' })
export class ProctoringController {
  constructor(
    private readonly proctoringStore: ProctoringStoreService,
    private readonly examService: ExamService,
    private readonly studentExams: StudentExamService,
    private readonly events: ProctoringEventsService,
    private readonly gateway: ProctoringGateway,
    private readonly audit: AuditService,
  ) {}

  @Get(':examId/proctoring/sessions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Live proctoring sessions for an exam',
    description:
      'Every student who joined: status (WRITING, SUBMITTED, ENDED, DISCONNECTED, or LOST after 60 seconds without a signal), deadline (time left), flags so far and the latest flag. Kept in Redis (P8-02). Also via Socket.IO monitor:state on exam:join.',
  })
  @ApiParam({ name: 'examId', description: 'Exam UUID' })
  @ApiResponse({ status: 200, description: 'Active proctoring sessions' })
  async getSessions(@Param('examId', ParseUUIDPipe) examId: string, @UserPayload() jwtPayload: JwtPayloadInterface) {
    await this.examService.assertTeacherCanMonitorExam(examId, jwtPayload);
    const [sessions, attempts] = await Promise.all([this.proctoringStore.getExamSessions(examId), this.studentExams.liveAttempts(examId)]);
    return {
      message: 'Proctoring sessions retrieved successfully',
      payload: {
        examId,
        sessions: sessions.map((session) => {
          const attempt = attempts.get(session.studentId);
          return { ...session, deadline: attempt?.deadline ?? null, attemptStatus: attempt?.status ?? null };
        }),
      },
    };
  }

  @Get(':examId/proctoring/students/:studentId/timeline')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: "One student's proctoring timeline: every flag and event, oldest first (PRO-03)" })
  async timeline(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.examService.assertTeacherCanMonitorExam(examId, jwtPayload);
    const events = await this.events.timeline(examId, studentId);
    return {
      message: 'Timeline retrieved successfully',
      payload: events.map((e) => ({ id: e.id, type: e.type, check: e.check_key, message: e.message, points: e.points, source: e.source, occurred_at: e.occurred_at })),
    };
  }

  @Post(':examId/proctoring/students/:studentId/warn')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a warning to one student taking the exam (shown on their screen, recorded on their timeline)' })
  async warn(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: WarnStudentDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.examService.assertTeacherCanMonitorExam(examId, jwtPayload);
    const message = dto.message.trim();
    this.gateway.warnStudent(examId, studentId, message, jwtPayload.full_name ?? '');
    await this.events.recordServerEvent(examId, studentId, 'teacher-warning', message);
    return { message: 'Warning sent', payload: null };
  }

  @Post(':examId/proctoring/students/:studentId/end')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: "End one student's exam with a reason: answers so far are kept and marked, the attempt is disqualified (reviewable later)" })
  async end(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: EndStudentExamDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.examService.assertTeacherCanMonitorExam(examId, jwtPayload);
    const reason = dto.reason.trim();
    const result = await this.studentExams.endByTeacher(examId, studentId, reason);
    await this.events.recordServerEvent(examId, studentId, 'teacher-ended', reason);
    await this.gateway.studentEnded(examId, studentId, reason);
    const organizationId = (await this.events.examInfo(examId))?.organization_id ?? null;
    this.audit.record({
      action: AUDIT_ACTIONS.EXAM_STUDENT_ENDED,
      organizationId,
      actorId: jwtPayload.id,
      entityType: 'exam',
      entityId: examId,
      after: { student_id: studentId, reason, status: result.status },
    });
    return { message: 'Exam ended for the student', payload: result };
  }
}
