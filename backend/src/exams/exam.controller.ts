import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CreateObjectiveExamDto, CreateSubjectiveExamDto } from "./dto/create-exam.dto";
import { UpdateExcludedStudentsDto } from "./dto/update-exam.dto";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { OptionalJwtAuthGuard } from "src/auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "src/common/guard/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesEnum } from "src/common/enums/roles.enum";
import { JwtPayloadInterface } from "src/auth/interfaces/jwt-payload.interface";
import { UserPayload } from "src/common/decorators/user-payload.decorator";
import { ExamService } from "./exam.service";
import { CreateExamWizardDto } from "./dto/create-exam-wizard.dto";

@ApiTags("Exams")
@Controller({
  path: "exams",
  version: "1",
})
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post()
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: "Create exam (unified wizard)",
    description:
      "Single endpoint for mcq, essay, hybrid, and model tests. Subject blocks must use real subject UUIDs from GET /v1/subjects. `questions` may contain MCQ items, essay items, or a mix for hybrid/model exams. When testAudience is `specific_students`, each specificStudents item may contain one UUID or a comma-separated list. When testAudience is `anyone`, students access the exam by id after signing in (no invite token).",
  })
  @ApiBody({ type: CreateExamWizardDto })
  @ApiResponse({ status: 201, description: "Exam created with sections and questions" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Subject or class not found" })
  async createExam(
    @Body() dto: CreateExamWizardDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.createFromWizard(dto, jwtPayload);
    return { message: "Exam created successfully", payload };
  }

  @Post("objective")
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    deprecated: true,
    summary: "Create an objective exam (deprecated)",
    description:
      "Deprecated: use POST /v1/exams. Create an objective exam with multiple choice questions. Supports negative marking, class assignment, and excluded students.",
  })
  @ApiResponse({ status: 201, description: "Exam created successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Only teachers can create exams" })
  async createObjectiveExam(
    @Body() dto: CreateObjectiveExamDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.createObjectiveExam(dto, jwtPayload);
    return { message: "Objective exam created successfully", payload };
  }

  @Post("subjective")
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    deprecated: true,
    summary: "Create a subjective exam (deprecated)",
    description:
      "Deprecated: use POST /v1/exams. Create a subjective exam with written-answer questions. Supports word limits, marks per question, and sample answers.",
  })
  @ApiResponse({ status: 201, description: "Exam created successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Only teachers can create exams" })
  async createSubjectiveExam(
    @Body() dto: CreateSubjectiveExamDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.createSubjectiveExam(dto, jwtPayload);
    return { message: "Subjective exam created successfully", payload };
  }

  @Get()
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get all exams",
    description: "Get all exams created by the logged-in teacher",
  })
  @ApiResponse({ status: 200, description: "List of exams" })
  async findAll(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.examService.findAll(jwtPayload);
    return { message: "Exams retrieved successfully", payload };
  }

  @Get("class/:classId")
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: "Get exams by class",
    description: "Get all exams assigned to a specific class",
  })
  @ApiParam({ name: "classId", description: "Class UUID" })
  @ApiResponse({ status: 200, description: "List of exams for the class" })
  async findByClass(
    @Param("classId", ParseUUIDPipe) classId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.findByClass(classId, jwtPayload);
    return { message: "Exams retrieved successfully", payload };
  }

  @Get(":id")
  @ApiBearerAuth("jwt")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Get exam by ID",
    description:
      "Without a token, or as a student: returns id, test_name, and created_user_name. With a teacher/admin token: full exam details when permitted.",
  })
  @ApiParam({ name: "id", description: "Exam UUID" })
  @ApiResponse({ status: 200, description: "Exam details" })
  @ApiResponse({ status: 404, description: "Exam not found" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload?: JwtPayloadInterface,
  ) {
    if (!jwtPayload || jwtPayload.role === RolesEnum.STUDENT) {
      const payload = await this.examService.findOnePublicSummary(id);
      return { message: "Exam summary retrieved successfully", payload };
    }
    const payload = await this.examService.findOne(id, jwtPayload);
    return { message: "Exam details retrieved successfully", payload };
  }

  @Patch(":id/excluded-students")
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: "Update excluded students",
    description: "Update the list of students excluded from an exam",
  })
  @ApiParam({ name: "id", description: "Exam UUID" })
  @ApiResponse({ status: 200, description: "Excluded students updated" })
  @ApiResponse({ status: 404, description: "Exam not found" })
  async updateExcludedStudents(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExcludedStudentsDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.examService.updateExcludedStudents(id, dto.student_ids, jwtPayload);
    return { message: "Excluded students updated successfully", payload };
  }

  @Delete(":id")
  @ApiBearerAuth("jwt")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: "Delete an exam",
    description: "Permanently delete an exam and all its questions",
  })
  @ApiParam({ name: "id", description: "Exam UUID" })
  @ApiResponse({ status: 200, description: "Exam deleted successfully" })
  @ApiResponse({ status: 404, description: "Exam not found" })
  @ApiResponse({ status: 403, description: "Permission denied" })
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.examService.delete(id, jwtPayload);
    return { message: "Exam deleted successfully" };
  }
}
