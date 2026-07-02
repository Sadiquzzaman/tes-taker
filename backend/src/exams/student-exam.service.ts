import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  In,
  MoreThan,
  LessThan,
  Not,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { ExamEntity } from './entities/exam.entity';
import { TestAudienceEnum } from './enums/exam-wizard.enums';
import {
  ExamQuestionEntity,
  QuestionTypeEnum,
  CorrectAnswerEnum,
  CORRECT_ANSWER_ENUM_BY_OPTION_INDEX,
} from './entities/exam-question.entity';
import { 
  StudentExamSubmissionEntity, 
  StudentExamAnswerEntity,
  ExamSubmissionStatusEnum 
} from './entities/student-exam-answer.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from 'src/classes/entities/class-student.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { SmsService } from 'src/sms/sms.service';
import {
  StartExamDto,
  SaveAnswerDto,
  SubmitAnswerSheetDto,
  SubmitExamDto,
  ReportViolationDto,
} from './dto/student-exam.dto';
import {
  findObjectiveOptionIndexBySubmittedId,
  getObjectiveOptionSlotCount,
  buildResponseOptionId,
} from './utils/exam-option-ids.util';
import { isAutoScoredQuestion, scoreStudentAnswer } from './utils/exam-question.util';
import { resolveExamSubjectLabel } from './utils/exam-subject.util';
import {
  computeEffectiveDeadline,
  computeRemainingTimeSeconds,
} from './utils/exam-deadline.util';
import { QuestionCategoryEnum } from './enums/question.enums';
import { RolesEnum } from 'src/common/enums/roles.enum';
import {
  ExamAccessReasonCodeEnum,
  ExamFinalizeReasonEnum,
} from './enums/exam-access-reason.enum';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { SubmissionGradingStatusEnum } from './enums/grading-status.enum';
import { AnswerValueTypeEnum } from './enums/question.enums';
import {
  computePercentage,
  examHasManualQuestions,
  FINALIZED_SUBMISSION_STATUSES,
  getAutoScoredQuestions,
  getManualQuestions,
} from './utils/exam-grading.util';
import {
  buildSubmissionQuestions,
  persistSubmissionScores,
  resolveSubmissionScores,
} from './utils/submission-response.util';

export type ExamAccessValidation = {
  canAccess: boolean;
  reason?: string;
  reason_code: ExamAccessReasonCodeEnum;
  exam?: ExamEntity;
};

@Injectable()
export class StudentExamService {
  constructor(
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,

    @InjectRepository(ExamQuestionEntity)
    private readonly questionRepo: Repository<ExamQuestionEntity>,

    @InjectRepository(StudentExamSubmissionEntity)
    private readonly submissionRepo: Repository<StudentExamSubmissionEntity>,

    @InjectRepository(StudentExamAnswerEntity)
    private readonly answerRepo: Repository<StudentExamAnswerEntity>,

    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,

    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    private readonly smsService: SmsService,

    private readonly dataSource: DataSource,
  ) {}

  private static readonly UUID_V4_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private isUuidV4(value: string): boolean {
    return StudentExamService.UUID_V4_RE.test(value);
  }

  /** Flatten scorable questions; wizard exams use sections; legacy uses exam.questions only */
  private getOrderedQuestions(exam: ExamEntity): ExamQuestionEntity[] {
    let ordered: ExamQuestionEntity[];
    if (exam.questionSections?.length) {
      const sections = [...exam.questionSections].sort((a, b) => a.sort_order - b.sort_order);
      ordered = [];
      for (const s of sections) {
        const qs = [...(s.questions || [])].sort((a, b) => a.sort_order - b.sort_order);
        ordered.push(...qs);
      }
    } else {
      ordered = [...(exam.questions || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    return ordered.filter(
      (q) => !(q.category === QuestionCategoryEnum.PASSAGE && !q.parent_id),
    );
  }

  // ========================
  // NOTIFICATION SERVICE
  // ========================

  /**
   * Send exam notification to all assigned students
   */
  async sendExamNotificationToStudents(examId: string): Promise<{ sent: number; failed: number }> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: ['class', 'class.classStudents', 'class.classStudents.student', 'excluded_students'],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (!exam.class) {
      return { sent: 0, failed: 0 };
    }

    // Get all joined students in the class
    const classStudentEntities = (exam.class.classStudents || []).filter(
      cs => cs.status === ClassStudentStatusEnum.JOINED && cs.student_id !== null
    );
    const classStudents = classStudentEntities.map(cs => cs.student).filter(s => s !== null) as UserEntity[];

    const excludedIds = (exam.excluded_students || []).map((s) => s.id);

    const assignedStudents = classStudents.filter((s) => !excludedIds.includes(s.id));

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

    // Send notification to each student
    for (const student of assignedStudents) {
      if (student.phone) {
        try {
          const title = exam.test_name || exam.subject || 'Your exam';
          const message = `You have an upcoming exam "${title}" scheduled for ${formattedDate}. Please prepare accordingly. - Testaker`;
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
      } else {
        failed++; // No phone number
      }
    }

    return { sent, failed };
  }

  // ========================
  // STUDENT DASHBOARD
  // ========================

  /**
   * Get upcoming exams for a student
   */
  async getUpcomingExams(
    studentId: string,
    sortOrder: 'ASC' | 'DESC' = 'ASC',
    includePast: boolean = false,
  ): Promise<any[]> {
    const now = new Date();
    const byId = new Map<string, ExamEntity>();

    const classes = await this.classRepo
      .createQueryBuilder('class')
      .innerJoin(
        'class.classStudents',
        'classStudent',
        'classStudent.student_id = :studentId AND classStudent.status = :status',
        { studentId, status: ClassStudentStatusEnum.JOINED },
      )
      .select(['class.id'])
      .getMany();

    const classIds = classes.map((c) => c.id);
    if (classIds.length > 0) {
      let examQuery = this.examRepo
        .createQueryBuilder('exam')
        .leftJoinAndSelect('exam.class', 'class')
        .leftJoinAndSelect('exam.primary_subject', 'primary_subject')
        .leftJoinAndSelect('exam.questionSections', 'questionSections')
        .leftJoinAndSelect('questionSections.subject', 'sectionSubject')
        .leftJoin('exam.excluded_students', 'excluded')
        .where('exam.class_id IN (:...classIds)', { classIds })
        .andWhere('exam.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
        .andWhere('(excluded.id IS NULL OR excluded.id != :studentId)', { studentId });

      if (!includePast) {
        examQuery = examQuery.andWhere('exam.exam_end_time > :now', { now });
      }
      examQuery = examQuery.orderBy('exam.exam_start_time', sortOrder);
      const classExams = await examQuery.getMany();
      classExams.forEach((e) => byId.set(e.id, e));
    }

    let targetQuery = this.examRepo
      .createQueryBuilder('exam')
      .innerJoin('exam.target_students', 'st', 'st.id = :studentId', { studentId })
      .leftJoinAndSelect('exam.class', 'class')
      .leftJoinAndSelect('exam.primary_subject', 'primary_subject')
      .leftJoinAndSelect('exam.questionSections', 'questionSections')
      .leftJoinAndSelect('questionSections.subject', 'sectionSubject')
      .where('exam.is_active = :active', { active: ActiveStatusEnum.ACTIVE });
    if (!includePast) {
      targetQuery = targetQuery.andWhere('exam.exam_end_time > :now', { now });
    }
    targetQuery = targetQuery.orderBy('exam.exam_start_time', sortOrder);
    const targetExams = await targetQuery.getMany();
    targetExams.forEach((e) => byId.set(e.id, e));

    const exams = Array.from(byId.values()).sort(
      (a, b) =>
        (sortOrder === 'ASC' ? 1 : -1) *
        (new Date(a.exam_start_time).getTime() - new Date(b.exam_start_time).getTime()),
    );

    const examIds = exams.map((e) => e.id);
    const submissions =
      examIds.length === 0
        ? []
        : await this.submissionRepo.find({
            where: { student_id: studentId, exam_id: In(examIds) },
          });

    const submissionMap = new Map(submissions.map((s) => [s.exam_id, s]));

    return exams.map((exam) => {
      const submission = submissionMap.get(exam.id);
      const examStartTime = new Date(exam.exam_start_time);
      const examEndTime = new Date(exam.exam_end_time);

      let examStatus: string;
      if (
        submission?.status === ExamSubmissionStatusEnum.SUBMITTED ||
        submission?.status === ExamSubmissionStatusEnum.AUTO_SUBMITTED
      ) {
        examStatus = 'COMPLETED';
      } else if (now < examStartTime) {
        examStatus = 'UPCOMING';
      } else if (now >= examStartTime && now <= examEndTime) {
        if (submission?.status === ExamSubmissionStatusEnum.IN_PROGRESS) {
          examStatus = 'IN_PROGRESS';
        } else {
          examStatus = 'AVAILABLE';
        }
      } else {
        examStatus = 'EXPIRED';
      }

      return {
        id: exam.id,
        subject: resolveExamSubjectLabel(exam),
        test_name: exam.test_name,
        exam_type: exam.exam_type,
        exam_kind: exam.exam_kind,
        exam_start_time: exam.exam_start_time,
        exam_end_time: exam.exam_end_time,
        class_name: exam.class?.class_name,
        status: examStatus,
        submission_status: submission?.status || null,
        score: submission?.total_score || null,
        can_start: examStatus === 'AVAILABLE' && !submission,
        can_continue:
          examStatus === 'IN_PROGRESS' ||
          (examStatus === 'AVAILABLE' &&
            submission?.status === ExamSubmissionStatusEnum.IN_PROGRESS),
      };
    });
  }

  /**
   * Get exam history for a student (completed exams)
   */
  async getExamHistory(studentId: string): Promise<any[]> {
    const submissions = await this.submissionRepo.find({
      where: {
        student_id: studentId,
        status: In([ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED]),
      },
      relations: [
        'exam',
        'exam.class',
        'exam.primary_subject',
        'exam.questionSections',
        'exam.questionSections.subject',
      ],
      order: { submitted_at: 'DESC' },
    });

    return submissions.map((sub) => {
      const hasManualQuestions = examHasManualQuestions(sub.exam);
      const resultPublished = Boolean(sub.exam.result_published_at);
      const canShowScores = !hasManualQuestions || resultPublished;

      return {
        id: sub.exam_id,
        subject: resolveExamSubjectLabel(sub.exam),
        test_name: sub.exam.test_name,
        exam_type: sub.exam.exam_type,
        class_name: sub.exam.class?.class_name,
        submitted_at: sub.submitted_at,
        result_published: resultPublished,
        total_score: canShowScores ? sub.total_score : null,
        max_score: canShowScores ? sub.max_score : null,
        correct_answers: canShowScores ? sub.correct_answers : null,
        wrong_answers: canShowScores ? sub.wrong_answers : null,
        total_questions: sub.total_questions,
        percentage: canShowScores
          ? computePercentage(sub.total_score, sub.max_score)
          : null,
      };
    });
  }

  // ========================
  // EXAM ACCESS VALIDATION
  // ========================

  /**
   * Eligibility for taking an exam (audience rules, exclusions, submission state).
   * Schedule window is enforced separately when loading questions, saving answers, and starting the exam.
   * For `anyone` audience, any authenticated student who knows the exam id may take the exam.
   */
  async validateExamAccess(
    examId: string,
    studentId: string,
  ): Promise<ExamAccessValidation> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: [
        'class',
        'class.classStudents',
        'class.classStudents.student',
        'excluded_students',
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'target_students',
        'primary_subject',
      ],
    });

    if (!exam) {
      return {
        canAccess: false,
        reason: 'Exam not found',
        reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
      };
    }

    if (exam.is_active !== ActiveStatusEnum.ACTIVE) {
      return {
        canAccess: false,
        reason: 'This exam is not available',
        reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
        exam,
      };
    }

    const existingSubmission = await this.submissionRepo.findOne({
      where: { exam_id: examId, student_id: studentId },
    });

    if (
      existingSubmission?.status === ExamSubmissionStatusEnum.SUBMITTED ||
      existingSubmission?.status === ExamSubmissionStatusEnum.AUTO_SUBMITTED
    ) {
      return {
        canAccess: false,
        reason: 'You have already submitted this exam',
        reason_code: ExamAccessReasonCodeEnum.ALREADY_SUBMITTED,
        exam,
      };
    }

    if (existingSubmission?.status === ExamSubmissionStatusEnum.DISQUALIFIED) {
      return {
        canAccess: false,
        reason: 'You have been disqualified from this exam',
        reason_code: ExamAccessReasonCodeEnum.DISQUALIFIED,
        exam,
      };
    }

    const now = new Date();
    const examStart = new Date(exam.exam_start_time);
    const examEnd = new Date(exam.exam_end_time);

    if (now < examStart) {
      return {
        canAccess: false,
        reason: 'Exam has not started yet',
        reason_code: ExamAccessReasonCodeEnum.NOT_STARTED,
        exam,
      };
    }

    if (now > examEnd) {
      return {
        canAccess: false,
        reason: 'Exam has ended',
        reason_code: ExamAccessReasonCodeEnum.ENDED,
        exam,
      };
    }

    if (
      existingSubmission?.status === ExamSubmissionStatusEnum.IN_PROGRESS &&
      existingSubmission.started_at
    ) {
      const effectiveDeadline = computeEffectiveDeadline(exam, existingSubmission);
      if (now > effectiveDeadline) {
        return {
          canAccess: false,
          reason: 'Your exam time has expired',
          reason_code: ExamAccessReasonCodeEnum.ENDED,
          exam,
        };
      }
    }

    const audience = exam.test_audience;

    if (audience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      const allowed = exam.target_students?.some((s) => s.id === studentId);
      if (!allowed) {
        return {
          canAccess: false,
          reason: 'You are not on the list for this exam',
          reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
          exam,
        };
      }
    } else if (audience !== TestAudienceEnum.ANYONE) {
      if (!exam.class) {
        return {
          canAccess: false,
          reason: 'Exam is not assigned to any class',
          reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
          exam,
        };
      }
      const isInClass = exam.class.classStudents?.some(
        (cs) => cs.student_id === studentId && cs.status === ClassStudentStatusEnum.JOINED,
      );
      if (!isInClass) {
        return {
          canAccess: false,
          reason: 'You are not enrolled in this class',
          reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
          exam,
        };
      }
      const isExcluded = exam.excluded_students?.some((s) => s.id === studentId);
      if (isExcluded) {
        return {
          canAccess: false,
          reason: 'You have been excluded from this exam',
          reason_code: ExamAccessReasonCodeEnum.NOT_ASSIGNED,
          exam,
        };
      }
    }

    return { canAccess: true, reason_code: ExamAccessReasonCodeEnum.OK, exam };
  }

  /**
   * Get exam details for student (without correct answers)
   */
  async getExamForStudent(
    examId: string,
    studentId: string,
  ): Promise<Record<string, unknown>> {
    const validation = await this.validateExamAccess(examId, studentId);

    if (!validation.canAccess) {
      throw new ForbiddenException(validation.reason);
    }

    const exam = validation.exam!;
    await this.assertExamOpenForTaking(exam, studentId);

    const submission = await this.submissionRepo.findOne({
      where: { exam_id: examId, student_id: studentId },
    });

    let savedAnswers: { question_id: string; selected_answer?: CorrectAnswerEnum; text_answer?: string }[] = [];
    if (submission) {
      const answers = await this.answerRepo.find({
        where: { submission_id: submission.id },
      });
      savedAnswers = answers.map((a) => ({
        question_id: a.question_id,
        selected_answer: a.selected_answer,
        text_answer: a.text_answer,
      }));
    }

    const ordered = this.getOrderedQuestions(exam);
    const questions = ordered.map((q) => {
      if (q.question_type === QuestionTypeEnum.OBJECTIVE) {
        return {
          id: q.id,
          question_type: q.question_type,
          question: q.question,
          image_url: q.image_url,
          points: q.points ?? 1,
          instruction: q.instruction ?? null,
          option1: q.option1,
          option2: q.option2,
          option3: q.option3,
          option4: q.option4,
          option5: q.option5,
        };
      }
      return {
        id: q.id,
        question_type: q.question_type,
        question: q.question,
        image_url: q.image_url,
        points: q.points ?? q.marks_per_question,
        instruction: q.instruction ?? null,
        expected_word_limit: q.expected_word_limit,
        marks_per_question: q.marks_per_question,
      };
    });

    const effectiveDeadline = computeEffectiveDeadline(exam, submission);

    return {
      id: exam.id,
      test_name: exam.test_name,
      subject: resolveExamSubjectLabel(exam),
      exam_type: exam.exam_type,
      exam_kind: exam.exam_kind,
      exam_start_time: exam.exam_start_time,
      exam_end_time: exam.exam_end_time,
      duration_minutes: exam.duration_minutes,
      is_negative_marking: exam.is_negative_marking,
      negative_mark_value: exam.negative_mark_value,
      total_questions: questions.length,
      remaining_time_seconds: computeRemainingTimeSeconds(exam, submission),
      effective_deadline: effectiveDeadline.toISOString(),
      questions,
      submission_status: submission?.status || null,
      saved_answers: savedAnswers,
    };
  }

  // ========================
  // EXAM TAKING
  // ========================

  /**
   * Start an exam
   */
  async startExam(
    examId: string,
    studentId: string,
    dto: StartExamDto,
    ipAddress?: string,
  ): Promise<StudentExamSubmissionEntity> {
    const validation = await this.validateExamAccess(examId, studentId);
    
    if (!validation.canAccess) {
      throw new ForbiddenException(validation.reason);
    }

    const exam = validation.exam!;

    const now = new Date();
    if (now < new Date(exam.exam_start_time)) {
      throw new BadRequestException('Exam has not started yet');
    }
    if (now > new Date(exam.exam_end_time)) {
      throw new BadRequestException('Exam has ended');
    }

    let submission = await this.submissionRepo.findOne({
      where: { exam_id: examId, student_id: studentId },
    });

    if (submission) {
      if (submission.status === ExamSubmissionStatusEnum.IN_PROGRESS) {
        return submission;
      }
      throw new BadRequestException('You have already started or completed this exam');
    }

    const totalQs = this.getOrderedQuestions(exam).length;

    submission = this.submissionRepo.create({
      student_id: studentId,
      exam_id: examId,
      status: ExamSubmissionStatusEnum.IN_PROGRESS,
      started_at: new Date(),
      total_questions: totalQs,
      ip_address: ipAddress,
      user_agent: dto.user_agent,
      created_by: studentId,
      created_at: new Date(),
    });

    return this.submissionRepo.save(submission);
  }

  /**
   * Save an answer (auto-save)
   */
  async saveAnswer(
    examId: string,
    studentId: string,
    dto: SaveAnswerDto,
  ): Promise<StudentExamAnswerEntity> {
    const validation = await this.validateExamAccess(examId, studentId);
    if (!validation.canAccess) {
      throw new ForbiddenException(validation.reason);
    }

    await this.assertExamOpenForTaking(validation.exam!, studentId);

    // Get submission
    const submission = await this.submissionRepo.findOne({
      where: { 
        exam_id: examId, 
        student_id: studentId,
        // status: ExamSubmissionStatusEnum.IN_PROGRESS,
      },
    });

    if (!submission) {
      throw new BadRequestException('Please start the exam first');
    }

    // Validate question belongs to this exam
    const question = await this.questionRepo.findOne({
      where: { id: dto.question_id, exam: { id: examId } },
    });

    if (!question) {
      throw new BadRequestException('Invalid question');
    }

    // Check if answer already exists
    let answer = await this.answerRepo.findOne({
      where: { submission_id: submission.id, question_id: dto.question_id },
    });

    const wordCount = dto.text_answer 
      ? dto.text_answer.trim().split(/\s+/).filter(w => w.length > 0).length 
      : undefined;

    if (answer) {
      // Update existing answer
      answer.selected_answer = dto.selected_answer;
      answer.text_answer = dto.text_answer;
      answer.word_count = wordCount;
      answer.answered_at = new Date();
      answer.updated_at = new Date();
    } else {
      // Create new answer
      const answerData: Partial<StudentExamAnswerEntity> = {
        submission_id: submission.id,
        question_id: dto.question_id,
        selected_answer: dto.selected_answer,
        text_answer: dto.text_answer,
        answered_at: new Date(),
        created_by: studentId,
        created_at: new Date(),
      };

      if (wordCount !== undefined) {
        answerData.word_count = wordCount;
      }

      answer = this.answerRepo.create(answerData);
    }

    return this.answerRepo.save(answer);
  }

  /**
   * Finalize a student's answersheet (manual submit, timeout auto-submit, or disqualification).
   */
  async finalizeAnswerSheet(
    examId: string,
    studentId: string,
    dto: SubmitAnswerSheetDto,
  ): Promise<{
    submission_id: string;
    status: ExamSubmissionStatusEnum;
    saved_count: number;
    total_score: number | null;
    max_score: number | null;
    already_finalized?: boolean;
  }> {
    if (dto.studentId && dto.studentId !== studentId) {
      throw new BadRequestException('studentId does not match the authenticated user');
    }

    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: [
        'class',
        'class.classStudents',
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'target_students',
        'excluded_students',
        'primary_subject',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const submission = await this.submissionRepo.findOne({
      where: { exam_id: examId, student_id: studentId },
    });

    if (!submission) {
      throw new BadRequestException('Please start the exam first');
    }

    const finalizedStatuses = [
      ExamSubmissionStatusEnum.SUBMITTED,
      ExamSubmissionStatusEnum.AUTO_SUBMITTED,
      ExamSubmissionStatusEnum.DISQUALIFIED,
    ];

    if (finalizedStatuses.includes(submission.status)) {
      return {
        submission_id: submission.id,
        status: submission.status,
        saved_count: 0,
        total_score: submission.total_score ?? null,
        max_score: submission.max_score ?? null,
        already_finalized: true,
      };
    }

    if (submission.status !== ExamSubmissionStatusEnum.IN_PROGRESS) {
      throw new BadRequestException('No active exam session for this submission');
    }

    const answersheet = dto.answersheet ?? {};
    const savedCount = await this.syncAnswersheetToSubmission(
      exam,
      submission,
      answersheet,
      studentId,
      { strict: false },
    );

    const ordered = this.getOrderedQuestions(exam);
    const hasObjective = ordered.some(
      (q) =>
        q.question_type === QuestionTypeEnum.OBJECTIVE ||
        isAutoScoredQuestion(q.category, q.sub_type),
    );
    const hasSubjective = ordered.some(
      (q) =>
        q.question_type === QuestionTypeEnum.SUBJECTIVE &&
        !isAutoScoredQuestion(q.category, q.sub_type),
    );

    if (hasObjective) {
      await this.calculateObjectiveScore(submission.id, exam);
    }
    if (hasSubjective) {
      await this.calculateSubjectiveMaxScore(submission.id, exam);
    }
    await this.syncSubmissionScoresFromExam(submission.id, exam);

    const reason = dto.reason ?? ExamFinalizeReasonEnum.MANUAL;
    let status = ExamSubmissionStatusEnum.SUBMITTED;
    if (reason === ExamFinalizeReasonEnum.TIMEOUT) {
      status = ExamSubmissionStatusEnum.AUTO_SUBMITTED;
    } else if (reason === ExamFinalizeReasonEnum.DISQUALIFIED) {
      status = ExamSubmissionStatusEnum.DISQUALIFIED;
    }

    submission.status = status;
    submission.submitted_at = new Date();
    submission.updated_at = new Date();
    this.applySubmissionGradingState(submission, exam);
    await this.submissionRepo.save(submission);

    const result = await this.submissionRepo.findOne({ where: { id: submission.id } });

    return {
      submission_id: submission.id,
      status,
      saved_count: savedCount,
      total_score: result?.total_score ?? null,
      max_score: result?.max_score ?? null,
    };
  }

  /**
   * Save a full answersheet object (stringified JSON on submission + normalized answer rows).
   * Keys are question UUIDs; MCQ values are option UUIDs; essay values are text (max 10000 chars).
   */
  async saveAnswerSheet(
    examId: string,
    studentId: string,
    dto: SubmitAnswerSheetDto,
  ): Promise<{ submission_id: string; saved_count: number }> {
    if (dto.studentId && dto.studentId !== studentId) {
      throw new BadRequestException('studentId does not match the authenticated user');
    }

    const validation = await this.validateExamAccess(examId, studentId);
    if (!validation.canAccess) {
      throw new ForbiddenException(validation.reason);
    }

    const exam = validation.exam!;
    await this.assertExamOpenForTaking(exam, studentId);

    const answersheet = dto.answersheet;
    if (!answersheet || typeof answersheet !== 'object' || Array.isArray(answersheet)) {
      throw new BadRequestException('answersheet must be a non-array object');
    }

    const submission = await this.submissionRepo.findOne({
      where: {
        exam_id: examId,
        student_id: studentId,
      },
    });

    if (!submission) {
      throw new BadRequestException('Please start the exam first');
    }

    const savedCount = await this.syncAnswersheetToSubmission(
      exam,
      submission,
      answersheet,
      studentId,
      { strict: true },
    );

    return {
      submission_id: submission.id,
      saved_count: savedCount,
    };
  }

  private async syncAnswersheetToSubmission(
    exam: ExamEntity,
    submission: StudentExamSubmissionEntity,
    answersheet: Record<string, string>,
    studentId: string,
    options: { strict: boolean },
  ): Promise<number> {
    const ordered = this.getOrderedQuestions(exam);
    const questionById = new Map(ordered.map((q) => [q.id, q]));

    for (const questionId of Object.keys(answersheet)) {
      if (!this.isUuidV4(questionId)) {
        throw new BadRequestException(`Invalid question id: ${questionId}`);
      }
      if (!questionById.has(questionId)) {
        throw new BadRequestException(`Unknown question id: ${questionId}`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const submissionRepo = manager.getRepository(StudentExamSubmissionEntity);
      const answerRepo = manager.getRepository(StudentExamAnswerEntity);

      const subRow = await submissionRepo.findOne({ where: { id: submission.id } });
      if (!subRow || subRow.status !== ExamSubmissionStatusEnum.IN_PROGRESS) {
        throw new BadRequestException('No active exam session for this submission');
      }

      subRow.answersheet_json = JSON.stringify(answersheet);
      subRow.updated_at = new Date();
      await submissionRepo.save(subRow);

      for (const [questionId, rawValue] of Object.entries(answersheet)) {
        const question = questionById.get(questionId)!;
        const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
        const trimmed = value.trim();

        if (!trimmed) {
          if (options.strict) {
            throw new BadRequestException(`Answer required for question ${questionId}`);
          }
          continue;
        }

        if (isAutoScoredQuestion(question.category, question.sub_type)) {
          if (question.sub_type === 'multiple-response' || question.sub_type === 'matching-ordering') {
            await this.upsertTextAnswer(answerRepo, subRow.id, questionId, trimmed, studentId);
            continue;
          }

          if (question.options_json?.length) {
            const validIds = new Set(question.options_json.map((o) => o.id));
            if (!validIds.has(trimmed)) {
              throw new BadRequestException(`Invalid option selection for question ${questionId}`);
            }
            const idx = question.options_json.findIndex((o) => o.id === trimmed);
            const selected = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX[idx];
            await this.upsertSelectedAnswer(answerRepo, subRow.id, questionId, selected, studentId);
            continue;
          }
        }

        if (question.question_type === QuestionTypeEnum.OBJECTIVE) {
          const slotCount = getObjectiveOptionSlotCount(question);
          const idx = findObjectiveOptionIndexBySubmittedId(questionId, trimmed, slotCount);
          if (idx === null) {
            throw new BadRequestException(`Invalid MCQ option selection for question ${questionId}`);
          }
          const selected = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX[idx];
          if (!selected) {
            throw new BadRequestException(`Invalid MCQ option index for question ${questionId}`);
          }

          const existing = await answerRepo.findOne({
            where: { submission_id: subRow.id, question_id: questionId },
          });
          if (existing) {
            await answerRepo.update(
              { id: existing.id },
              {
                selected_answer: selected,
                text_answer: null,
                word_count: null,
                answered_at: new Date(),
                updated_at: new Date(),
              } as object,
            );
          } else {
            const row = answerRepo.create({
              submission_id: subRow.id,
              question_id: questionId,
              selected_answer: selected,
              answered_at: new Date(),
              created_by: studentId,
              created_at: new Date(),
            });
            await answerRepo.save(row);
          }
        } else {
          if (value.length > 10000) {
            throw new BadRequestException(
              `Essay answer for question ${questionId} exceeds 10000 characters`,
            );
          }
          const wordCount = trimmed.length
            ? trimmed.split(/\s+/).filter((w) => w.length > 0).length
            : 0;

          const existing = await answerRepo.findOne({
            where: { submission_id: subRow.id, question_id: questionId },
          });
          if (existing) {
            await answerRepo.update(
              { id: existing.id },
              {
                text_answer: value,
                selected_answer: null,
                word_count: wordCount,
                answered_at: new Date(),
                updated_at: new Date(),
              } as object,
            );
          } else {
            const row = answerRepo.create({
              submission_id: subRow.id,
              question_id: questionId,
              text_answer: value,
              word_count: wordCount,
              answered_at: new Date(),
              created_by: studentId,
              created_at: new Date(),
            });
            await answerRepo.save(row);
          }
        }
      }
    });

    return Object.keys(answersheet).length;
  }

  /**
   * Submit exam
   */
  async submitExam(
    examId: string,
    studentId: string,
    dto: SubmitExamDto,
    autoSubmit: boolean = false,
  ): Promise<Record<string, unknown>> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    // Get submission
    const submission = await this.submissionRepo.findOne({
      where: { 
        exam_id: examId, 
        student_id: studentId,
      },
    });

    if (!submission) {
      throw new BadRequestException('No active exam session found');
    }

    if (submission.status === ExamSubmissionStatusEnum.SUBMITTED || 
        submission.status === ExamSubmissionStatusEnum.AUTO_SUBMITTED) {
      throw new BadRequestException('Exam already submitted');
    }

    if (submission.status === ExamSubmissionStatusEnum.DISQUALIFIED) {
      throw new BadRequestException('You have been disqualified from this exam');
    }

    if (submission.status === ExamSubmissionStatusEnum.IN_PROGRESS) {
      await this.assertExamOpenForTaking(exam, studentId);
    }

    for (const answerDto of dto.answers) {
      await this.saveAnswer(examId, studentId, answerDto);
    }

    if (dto.browser_switch_count !== undefined) {
      submission.browser_switch_count = dto.browser_switch_count;
    }
    if (dto.tab_switch_count !== undefined) {
      submission.tab_switch_count = dto.tab_switch_count;
    }

    const ordered = this.getOrderedQuestions(exam);
    const hasObjective = ordered.some(
      (q) =>
        q.question_type === QuestionTypeEnum.OBJECTIVE ||
        isAutoScoredQuestion(q.category, q.sub_type),
    );
    const hasSubjective = ordered.some(
      (q) =>
        q.question_type === QuestionTypeEnum.SUBJECTIVE &&
        !isAutoScoredQuestion(q.category, q.sub_type),
    );
    if (hasObjective) {
      await this.calculateObjectiveScore(submission.id, exam);
    }
    if (hasSubjective) {
      await this.calculateSubjectiveMaxScore(submission.id, exam);
    }
    await this.syncSubmissionScoresFromExam(submission.id, exam);

    // Update submission status
    submission.status = autoSubmit 
      ? ExamSubmissionStatusEnum.AUTO_SUBMITTED 
      : ExamSubmissionStatusEnum.SUBMITTED;
    submission.submitted_at = new Date();
    submission.updated_at = new Date();
    this.applySubmissionGradingState(submission, exam);

    await this.submissionRepo.save(submission);

    // Reload with calculated values
    const result = await this.submissionRepo.findOne({
      where: { id: submission.id },
      relations: ['exam'],
    });

    return {
      message: autoSubmit ? 'Exam auto-submitted due to time expiry' : 'Exam submitted successfully',
      submission_id: result!.id,
      exam_id: result!.exam_id,
      status: result!.status,
      submitted_at: result!.submitted_at,
      total_questions: result!.total_questions,
      correct_answers: result!.correct_answers,
      wrong_answers: result!.wrong_answers,
      unanswered: result!.unanswered,
      total_score: result!.total_score,
      max_score: result!.max_score,
    };
  }

  private resolveSubmittedAnswerValue(
    answer: StudentExamAnswerEntity,
    question: ExamQuestionEntity,
  ): string {
    if (answer.text_answer?.trim()) {
      return answer.text_answer.trim();
    }
    if (answer.selected_answer && question.options_json?.length) {
      const idx = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(answer.selected_answer);
      if (idx >= 0 && question.options_json[idx]) {
        return question.options_json[idx].id;
      }
    }
    if (answer.selected_answer) {
      const idx = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(answer.selected_answer);
      if (idx >= 0) {
        return buildResponseOptionId(question.id, idx);
      }
    }
    return '';
  }

  private async upsertSelectedAnswer(
    answerRepo: Repository<StudentExamAnswerEntity>,
    submissionId: string,
    questionId: string,
    selected: CorrectAnswerEnum,
    studentId: string,
  ): Promise<void> {
    const existing = await answerRepo.findOne({
      where: { submission_id: submissionId, question_id: questionId },
    });
    if (existing) {
      await answerRepo.update(
        { id: existing.id },
        {
          selected_answer: selected,
          text_answer: null,
          word_count: null,
          answered_at: new Date(),
          updated_at: new Date(),
        } as object,
      );
      return;
    }
    const row = answerRepo.create({
      submission_id: submissionId,
      question_id: questionId,
      selected_answer: selected,
      answered_at: new Date(),
      created_by: studentId,
      created_at: new Date(),
    });
    await answerRepo.save(row);
  }

  private async upsertTextAnswer(
    answerRepo: Repository<StudentExamAnswerEntity>,
    submissionId: string,
    questionId: string,
    value: string,
    studentId: string,
  ): Promise<void> {
    const existing = await answerRepo.findOne({
      where: { submission_id: submissionId, question_id: questionId },
    });
    if (existing) {
      await answerRepo.update(
        { id: existing.id },
        {
          text_answer: value,
          selected_answer: null,
          word_count: null,
          answered_at: new Date(),
          updated_at: new Date(),
        } as object,
      );
      return;
    }
    const row = answerRepo.create({
      submission_id: submissionId,
      question_id: questionId,
      text_answer: value,
      answered_at: new Date(),
      created_by: studentId,
      created_at: new Date(),
    });
    await answerRepo.save(row);
  }

  /**
   * Calculate score for objective exam
   */
  private expectedCorrectAnswer(q: ExamQuestionEntity): CorrectAnswerEnum | undefined {
    if (q.correct_answer) {
      return q.correct_answer;
    }
    const idx = q.correct_option_index;
    if (idx === null || idx === undefined) {
      return undefined;
    }
    if (idx < 0 || idx >= CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.length) {
      return undefined;
    }
    return CORRECT_ANSWER_ENUM_BY_OPTION_INDEX[idx];
  }

  private async calculateObjectiveScore(submissionId: string, exam: ExamEntity): Promise<void> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });

    if (!submission) return;

    const answers = await this.answerRepo.find({
      where: { submission_id: submissionId },
      relations: ['question'],
    });

    const ordered = this.getOrderedQuestions(exam);
    const questionMap = new Map(ordered.map((q) => [q.id, q]));

    let correctCount = 0;
    let wrongCount = 0;
    let totalScore = 0;

    const objectiveQs = ordered.filter(
      (q) =>
        q.question_type === QuestionTypeEnum.OBJECTIVE ||
        isAutoScoredQuestion(q.category, q.sub_type),
    );
    const maxObjective = objectiveQs.reduce((sum, q) => sum + (q.points ?? 1), 0);

    for (const answer of answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;

      const autoScored =
        isAutoScoredQuestion(question.category, question.sub_type) ||
        question.question_type === QuestionTypeEnum.OBJECTIVE;
      if (!autoScored) continue;

      const pts = question.points ?? 1;

      let isCorrect = false;
      if (isAutoScoredQuestion(question.category, question.sub_type) && question.answer_json) {
        const rawAnswer = this.resolveSubmittedAnswerValue(answer, question);
        isCorrect = scoreStudentAnswer(question, rawAnswer);
      } else {
        const expected = this.expectedCorrectAnswer(question);
        isCorrect = !!(expected && answer.selected_answer === expected);
      }

      if (isCorrect) {
        answer.is_correct = true;
        answer.marks_obtained = pts;
        correctCount++;
        totalScore += pts;
      } else if (answer.selected_answer || answer.text_answer) {
        answer.is_correct = false;
        const nm = exam.negative_mark_value ?? 0;
        const usePercentPenalty = nm > 0 && nm <= 100;
        const penalty = exam.is_negative_marking
          ? usePercentPenalty
            ? (nm / 100) * pts
            : nm
          : 0;
        answer.marks_obtained = exam.is_negative_marking ? -penalty : 0;
        wrongCount++;
        if (exam.is_negative_marking && penalty > 0) {
          totalScore -= Math.min(penalty, pts);
        }
      }

      await this.answerRepo.save(answer);
    }

    const answeredObjectiveIds = new Set(
      answers
        .filter((a) => {
          const q = questionMap.get(a.question_id);
          if (!q) return false;
          const auto =
            isAutoScoredQuestion(q.category, q.sub_type) ||
            q.question_type === QuestionTypeEnum.OBJECTIVE;
          return auto && (!!a.selected_answer || !!a.text_answer?.trim());
        })
        .map((a) => a.question_id),
    );
    const unanswered = objectiveQs.length - answeredObjectiveIds.size;

    submission.correct_answers = correctCount;
    submission.wrong_answers = wrongCount;
    submission.unanswered = Math.max(0, unanswered);
    submission.total_score = Math.max(0, totalScore);
    const prevMax = Number(submission.max_score || 0);
    submission.max_score = prevMax + maxObjective;

    await this.submissionRepo.save(submission);
  }

  /**
   * Calculate max score for subjective questions (per-question points)
   */
  private async calculateSubjectiveMaxScore(submissionId: string, exam: ExamEntity): Promise<void> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });

    if (!submission) return;

    const answers = await this.answerRepo.find({
      where: { submission_id: submissionId },
    });

    const ordered = this.getOrderedQuestions(exam);
    const subjectiveQs = ordered.filter(
      (q) =>
        q.question_type === QuestionTypeEnum.SUBJECTIVE &&
        !isAutoScoredQuestion(q.category, q.sub_type),
    );
    const maxScore = subjectiveQs.reduce(
      (sum, q) => sum + (q.points ?? q.marks_per_question ?? 0),
      0,
    );

    const answeredCount = answers.filter((a) => a.text_answer && a.text_answer.trim().length > 0).length;
    const unanswered = subjectiveQs.length - answeredCount;

    const prevMax = Number(submission.max_score || 0);
    submission.max_score = prevMax + maxScore;
    submission.unanswered = (submission.unanswered || 0) + Math.max(0, unanswered);
    submission.total_questions = ordered.length;

    await this.submissionRepo.save(submission);
  }

  /**
   * Report a violation (browser switch, tab switch, etc.)
   */
  async reportViolation(
    examId: string,
    studentId: string,
    dto: ReportViolationDto,
  ): Promise<void> {
    const validation = await this.validateExamAccess(examId, studentId);
    if (!validation.canAccess) {
      throw new ForbiddenException(validation.reason);
    }

    await this.assertExamOpenForTaking(validation.exam!, studentId);

    const submission = await this.submissionRepo.findOne({
      where: { 
        exam_id: examId, 
        student_id: studentId,
        status: ExamSubmissionStatusEnum.IN_PROGRESS,
      },
    });

    if (!submission) {
      throw new BadRequestException('No active exam session');
    }

    switch (dto.violation_type) {
      case 'BROWSER_SWITCH':
        submission.browser_switch_count += 1;
        break;
      case 'TAB_SWITCH':
        submission.tab_switch_count += 1;
        break;
    }

    await this.submissionRepo.save(submission);
  }

  private async assertExamOpenForTaking(exam: ExamEntity, studentId: string): Promise<void> {
    const now = new Date();
    const start = new Date(exam.exam_start_time);
    const end = new Date(exam.exam_end_time);

    if (now < start) {
      throw new ForbiddenException('Exam has not started yet');
    }

    if (now > end) {
      const inProgress = await this.submissionRepo.findOne({
        where: {
          exam_id: exam.id,
          student_id: studentId,
          status: ExamSubmissionStatusEnum.IN_PROGRESS,
        },
      });
      if (!inProgress) {
        throw new ForbiddenException('Exam has ended');
      }
    }
  }

  /**
   * Get exam result for student
   */
  async getExamResult(
    examId: string,
    studentId: string,
  ): Promise<any> {
    const submission = await this.submissionRepo.findOne({
      where: { 
        exam_id: examId, 
        student_id: studentId,
        status: In([ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED]),
      },
      relations: [
        'exam',
        'exam.questions',
        'exam.primary_subject',
        'exam.questionSections',
        'exam.questionSections.subject',
      ],
    });

    if (!submission) {
      throw new NotFoundException('No submission found for this exam');
    }

    if (
      examHasManualQuestions(submission.exam) &&
      !submission.exam.result_published_at
    ) {
      throw new ForbiddenException('Result has not been published yet');
    }

    const answers = await this.answerRepo.find({
      where: { submission_id: submission.id },
      relations: ['question'],
    });

    // Format answers with correct answers and explanations
    const formattedAnswers = answers.map(a => ({
      question: a.question.question,
      question_type: a.question.question_type,
      selected_answer: a.selected_answer,
      correct_answer: a.question.correct_answer,
      is_correct: a.is_correct,
      marks_obtained: a.marks_obtained,
      explanation: a.question.explanation,
      text_answer: a.text_answer,
      word_count: a.word_count,
    }));

    return {
      exam_id: submission.exam_id,
      subject: resolveExamSubjectLabel(submission.exam),
      exam_type: submission.exam.exam_type,
      submitted_at: submission.submitted_at,
      status: submission.status,
      total_questions: submission.total_questions,
      correct_answers: submission.correct_answers,
      wrong_answers: submission.wrong_answers,
      unanswered: submission.unanswered,
      total_score: submission.total_score,
      max_score: submission.max_score,
      percentage: submission.max_score 
        ? ((submission.total_score || 0) / submission.max_score * 100).toFixed(2) 
        : null,
      answers: formattedAnswers,
    };
  }

  // ========================
  // TEACHER GRADING
  // ========================

  async getSubmissionForGrading(
    examId: string,
    submissionId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<Record<string, unknown>> {
    const exam = await this.assertTeacherOwnsExam(examId, jwtPayload);
    const submission = await this.loadGradableSubmission(examId, submissionId);
    const answers = await this.answerRepo.find({
      where: { submission_id: submission.id },
    });
    const answerByQuestionId = new Map(answers.map((answer) => [answer.question_id, answer]));
    const scores = resolveSubmissionScores(exam, answers);
    persistSubmissionScores(submission, scores);
    submission.updated_at = new Date();
    await this.submissionRepo.save(submission);

    const questions = buildSubmissionQuestions(exam, answerByQuestionId);
    const manualQuestions = getManualQuestions(exam);
    const autoQuestions = getAutoScoredQuestions(exam);
    const manualGradedCount = manualQuestions.filter((question) => {
      const answer = answerByQuestionId.get(question.id);
      return answer?.marks_obtained !== undefined && answer?.marks_obtained !== null;
    }).length;

    return {
      submission: {
        submission_id: submission.id,
        exam_id: submission.exam_id,
        student_id: submission.student_id,
        student_name: submission.student?.full_name ?? null,
        email: submission.student?.email ?? null,
        phone: submission.student?.phone ?? null,
        submitted_at: submission.submitted_at ?? null,
        status: submission.status,
        total_score: scores.total_score,
        max_score: scores.max_score,
        percentage: scores.percentage,
        is_graded: submission.is_graded,
        grading_status: submission.is_graded
          ? SubmissionGradingStatusEnum.GRADED
          : SubmissionGradingStatusEnum.PENDING,
      },
      questions,
      totals: {
        manual_total_count: manualQuestions.length,
        manual_graded_count: manualGradedCount,
        auto_total_count: autoQuestions.length,
        auto_graded_count: autoQuestions.filter((question) => {
          const answer = answerByQuestionId.get(question.id);
          return answer?.marks_obtained !== undefined && answer?.marks_obtained !== null;
        }).length,
      },
    };
  }

  async saveSubmissionGrades(
    examId: string,
    submissionId: string,
    dto: GradeSubmissionDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<Record<string, unknown>> {
    const exam = await this.assertTeacherOwnsExam(examId, jwtPayload);
    const submission = await this.loadGradableSubmission(examId, submissionId);
    const manualQuestionMap = new Map(
      getManualQuestions(exam).map((question) => [question.id, question]),
    );

    for (const grade of dto.grades) {
      const question = manualQuestionMap.get(grade.question_id);
      if (!question) {
        throw new BadRequestException(`Question ${grade.question_id} is not a manual grading question`);
      }

      const maxPoints = question.points ?? question.marks_per_question ?? 0;
      if (grade.marks_obtained > maxPoints) {
        throw new BadRequestException(
          `Marks for question ${grade.question_id} cannot exceed ${maxPoints}`,
        );
      }

      let answer = await this.answerRepo.findOne({
        where: {
          submission_id: submission.id,
          question_id: grade.question_id,
        },
      });

      if (answer) {
        answer.marks_obtained = grade.marks_obtained;
        if (grade.explanation !== undefined) {
          answer.grader_explanation = grade.explanation.trim() || null;
        }
        answer.updated_at = new Date();
        answer.updated_by = jwtPayload.id;
        await this.answerRepo.save(answer);
      } else {
        answer = this.answerRepo.create({
          submission_id: submission.id,
          question_id: grade.question_id,
          marks_obtained: grade.marks_obtained,
          grader_explanation: grade.explanation?.trim() || null,
          created_by: jwtPayload.id,
          created_at: new Date(),
        });
        await this.answerRepo.save(answer);
      }
    }

    await this.recomputeSubmissionTotalScore(submission.id, exam);

    const answers = await this.answerRepo.find({
      where: { submission_id: submission.id },
    });
    const answerByQuestionId = new Map(answers.map((answer) => [answer.question_id, answer]));
    const allManualGraded = [...manualQuestionMap.values()].every((question) => {
      const answer = answerByQuestionId.get(question.id);
      return answer?.marks_obtained !== undefined && answer?.marks_obtained !== null;
    });

    submission.is_graded = allManualGraded || manualQuestionMap.size === 0;
    submission.graded_at = submission.is_graded ? new Date() : null;
    submission.graded_by = submission.is_graded ? jwtPayload.id : null;
    submission.updated_at = new Date();
    submission.updated_by = jwtPayload.id;
    const scores = resolveSubmissionScores(exam, answers);
    persistSubmissionScores(submission, scores);
    await this.submissionRepo.save(submission);

    const manualGradedCount = [...manualQuestionMap.values()].filter((question) => {
      const answer = answerByQuestionId.get(question.id);
      return answer?.marks_obtained !== undefined && answer?.marks_obtained !== null;
    }).length;

    return {
      submission_id: submission.id,
      total_score: scores.total_score,
      max_score: scores.max_score,
      percentage: scores.percentage,
      is_graded: submission.is_graded,
      grading_status: submission.is_graded
        ? SubmissionGradingStatusEnum.GRADED
        : SubmissionGradingStatusEnum.PENDING,
      manual_graded_count: manualGradedCount,
      manual_total_count: manualQuestionMap.size,
    };
  }

  private applySubmissionGradingState(
    submission: StudentExamSubmissionEntity,
    exam: ExamEntity,
  ): void {
    const hasManualQuestions = examHasManualQuestions(exam);
    submission.is_graded = !hasManualQuestions;
    submission.graded_at = hasManualQuestions ? null : new Date();
    submission.graded_by = null;
  }

  private async assertTeacherOwnsExam(
    examId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<ExamEntity> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'primary_subject',
        'class',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (
      jwtPayload.role === RolesEnum.TEACHER &&
      exam.created_by !== jwtPayload.id
    ) {
      throw new ForbiddenException('You do not have permission to grade this exam');
    }

    return exam;
  }

  private async loadGradableSubmission(
    examId: string,
    submissionId: string,
  ): Promise<StudentExamSubmissionEntity> {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, exam_id: examId },
      relations: ['student'],
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (!FINALIZED_SUBMISSION_STATUSES.includes(submission.status)) {
      throw new BadRequestException('Only submitted exams can be graded');
    }

    return submission;
  }

  private async syncSubmissionScoresFromExam(
    submissionId: string,
    exam: ExamEntity,
  ): Promise<void> {
    const answers = await this.answerRepo.find({
      where: { submission_id: submissionId },
    });
    const scores = resolveSubmissionScores(exam, answers);
    await this.submissionRepo.update(
      { id: submissionId },
      {
        total_score: scores.total_score,
        max_score: scores.max_score,
        updated_at: new Date(),
      },
    );
  }

  private async recomputeSubmissionTotalScore(
    submissionId: string,
    exam?: ExamEntity,
  ): Promise<void> {
    if (exam) {
      await this.syncSubmissionScoresFromExam(submissionId, exam);
      return;
    }

    const answers = await this.answerRepo.find({
      where: { submission_id: submissionId },
    });

    const totalScore = answers.reduce((sum, answer) => {
      if (answer.marks_obtained === undefined || answer.marks_obtained === null) {
        return sum;
      }
      return sum + Number(answer.marks_obtained);
    }, 0);

    await this.submissionRepo.update(
      { id: submissionId },
      {
        total_score: Math.max(0, totalScore),
        updated_at: new Date(),
      },
    );
  }

  private extractSampleAnswer(question: ExamQuestionEntity): string | null {
    if (question.sample_answer) {
      return question.sample_answer;
    }

    if (question.answer_json?.type === AnswerValueTypeEnum.TEXT) {
      return question.answer_json.value?.[0] ?? null;
    }

    return null;
  }
}
