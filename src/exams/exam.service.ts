import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { ExamEntity, ExamTypeEnum } from "./entities/exam.entity";
import { ExamQuestionEntity, QuestionTypeEnum } from "./entities/exam-question.entity";
import { CreateObjectiveExamDto, CreateSubjectiveExamDto } from "./dto/create-exam.dto";
import { JwtPayloadInterface } from "src/auth/interfaces/jwt-payload.interface";
import { UserEntity } from "src/user/entities/user.entity";
import { ClassEntity } from "src/classes/entities/class.entity";
import { RolesEnum } from "src/common/enums/roles.enum";
import { SmsService } from "src/sms/sms.service";

@Injectable()
export class ExamService {
  constructor(
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,

    @InjectRepository(ExamQuestionEntity)
    private readonly questionRepo: Repository<ExamQuestionEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,

    private readonly smsService: SmsService,
  ) {}

  /**
   * Create an objective exam
   */
  async createObjectiveExam(
    dto: CreateObjectiveExamDto,
    jwtPayload: JwtPayloadInterface
  ): Promise<ExamEntity | null> {
    // Validate negative marking
    if (dto.is_negative_marking && (!dto.negative_mark_value || dto.negative_mark_value <= 0)) {
      throw new BadRequestException(
        "Negative mark value is required if negative marking is enabled and must be greater than 0"
      );
    }

    // Validate time
    if (dto.exam_start_time >= dto.exam_end_time) {
      throw new BadRequestException("Exam start time must be before end time");
    }

    // Validate class if provided
    if (dto.class_id) {
      const classEntity = await this.classRepo.findOne({ where: { id: dto.class_id } });
      if (!classEntity) {
        throw new BadRequestException("Class not found");
      }
    }

    // Get excluded students if provided
    let excludedStudents: UserEntity[] = [];
    if (dto.excluded_student_ids && dto.excluded_student_ids.length > 0) {
      excludedStudents = await this.userRepo.find({
        where: { id: In(dto.excluded_student_ids), role: RolesEnum.STUDENT },
      });
    }

    // Create exam
    const exam = this.examRepo.create({
      exam_type: ExamTypeEnum.OBJECTIVE,
      exam_start_time: dto.exam_start_time,
      exam_end_time: dto.exam_end_time,
      is_negative_marking: dto.is_negative_marking,
      negative_mark_value: dto.negative_mark_value,
      subject: dto.subject,
      class_id: dto.class_id,
      excluded_students: excludedStudents,
      created_by: jwtPayload.id,
      created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
      created_at: new Date(),
    });

    const savedExam = await this.examRepo.save(exam);

    // Create questions
    const questions = dto.questions.map((q) =>
      this.questionRepo.create({
        question_type: QuestionTypeEnum.OBJECTIVE,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        exam: savedExam,
        created_by: jwtPayload.id,
        created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
        created_at: new Date(),
      })
    );

    await this.questionRepo.save(questions);

    // Send notifications to students if class is assigned
    if (dto.class_id) {
      this.sendExamNotifications(savedExam.id).catch(err => {
        console.error('Failed to send exam notifications:', err);
      });
    }

    return this.findOne(savedExam.id, jwtPayload);
  }

  /**
   * Create a subjective exam
   */
  async createSubjectiveExam(
    dto: CreateSubjectiveExamDto,
    jwtPayload: JwtPayloadInterface
  ): Promise<ExamEntity | null> {
    // Validate time
    if (dto.exam_start_time >= dto.exam_end_time) {
      throw new BadRequestException("Exam start time must be before end time");
    }

    // Validate class if provided
    if (dto.class_id) {
      const classEntity = await this.classRepo.findOne({ where: { id: dto.class_id } });
      if (!classEntity) {
        throw new BadRequestException("Class not found");
      }
    }

    // Get excluded students if provided
    let excludedStudents: UserEntity[] = [];
    if (dto.excluded_student_ids && dto.excluded_student_ids.length > 0) {
      excludedStudents = await this.userRepo.find({
        where: { id: In(dto.excluded_student_ids), role: RolesEnum.STUDENT },
      });
    }

    // Create exam
    const exam = this.examRepo.create({
      exam_type: ExamTypeEnum.SUBJECTIVE,
      exam_start_time: dto.exam_start_time,
      exam_end_time: dto.exam_end_time,
      is_negative_marking: false,
      subject: dto.subject,
      class_id: dto.class_id,
      excluded_students: excludedStudents,
      created_by: jwtPayload.id,
      created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
      created_at: new Date(),
    });

    const savedExam = await this.examRepo.save(exam);

    // Create questions
    const questions = dto.questions.map((q) =>
      this.questionRepo.create({
        question_type: QuestionTypeEnum.SUBJECTIVE,
        question: q.question,
        expected_word_limit: q.expected_word_limit,
        marks_per_question: q.marks_per_question,
        sample_answer: q.sample_answer,
        exam: savedExam,
        created_by: jwtPayload.id,
        created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
        created_at: new Date(),
      })
    );

    await this.questionRepo.save(questions);

    // Send notifications to students if class is assigned
    if (dto.class_id) {
      this.sendExamNotifications(savedExam.id).catch(err => {
        console.error('Failed to send exam notifications:', err);
      });
    }

    return this.findOne(savedExam.id, jwtPayload);
  }

  /**
   * Send exam notification to all assigned students
   */
  private async sendExamNotifications(examId: string): Promise<{ sent: number; failed: number }> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: ['class', 'class.students', 'excluded_students'],
    });

    if (!exam || !exam.class) {
      return { sent: 0, failed: 0 };
    }

    // Get all students in the class
    const classStudents = exam.class.students || [];
    
    // Get excluded student IDs
    const excludedIds = (exam.excluded_students || []).map(s => s.id);
    
    // Filter out excluded students
    const assignedStudents = classStudents.filter(s => !excludedIds.includes(s.id));

    if (assignedStudents.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Format date for message
    const examDate = new Date(exam.exam_start_time);
    const formattedDate = examDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Send notification to each student (async, don't wait)
    for (const student of assignedStudents) {
      if (student.phone) {
        try {
          const message = `You have an upcoming exam on ${exam.subject} scheduled for ${formattedDate}. Please prepare accordingly. - Testaker`;
          const result = await this.smsService.sendSms(student.phone, message);
          if (result) {
            sent++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Failed to send notification to ${student.phone}:`, error);
          failed++;
        }
      }
    }

    console.log(`Exam notifications sent: ${sent} success, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Get all exams (for teacher)
   */
  async findAll(jwtPayload: JwtPayloadInterface): Promise<ExamEntity[]> {
    return this.examRepo.find({
      where: { created_by: jwtPayload.id },
      relations: ["questions", "class", "excluded_students"],
      order: { created_at: "DESC" },
    });
  }

  /**
   * Get all exams (admin)
   */
  async findAllAdmin(): Promise<ExamEntity[]> {
    return this.examRepo.find({
      relations: ["questions", "class", "excluded_students"],
      order: { created_at: "DESC" },
    });
  }

  /**
   * Get exams by class
   */
  async findByClass(classId: string, jwtPayload: JwtPayloadInterface): Promise<ExamEntity[]> {
    return this.examRepo.find({
      where: { class_id: classId },
      relations: ["questions", "excluded_students"],
      order: { created_at: "DESC" },
    });
  }

  /**
   * Get a single exam by ID
   */
  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<ExamEntity> {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ["questions", "class", "excluded_students"],
    });

    if (!exam) {
      throw new NotFoundException("Exam not found");
    }

    return exam;
  }

  /**
   * Update excluded students
   */
  async updateExcludedStudents(
    examId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface
  ): Promise<ExamEntity> {
    const exam = await this.findOne(examId, jwtPayload);

    // Validate ownership or admin access
    if (
      exam.created_by !== jwtPayload.id &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to update this exam");
    }

    // Get students
    const students = await this.userRepo.find({
      where: { id: In(studentIds), role: RolesEnum.STUDENT },
    });

    exam.excluded_students = students;
    await this.examRepo.save(exam);

    return this.findOne(examId, jwtPayload);
  }

  /**
   * Delete an exam
   */
  async delete(id: string, jwtPayload: JwtPayloadInterface): Promise<void> {
    const exam = await this.findOne(id, jwtPayload);

    // Validate ownership or admin access
    if (
      exam.created_by !== jwtPayload.id &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to delete this exam");
    }

    await this.examRepo.remove(exam);
  }
}
