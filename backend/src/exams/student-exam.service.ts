import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan, Not, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { ExamEntity } from './entities/exam.entity';
import { TestAudienceEnum } from './enums/exam-wizard.enums';
import {
  ExamQuestionEntity,
  QuestionTypeEnum,
  CorrectAnswerEnum,
} from './entities/exam-question.entity';
import { 
  StudentExamSubmissionEntity, 
  StudentExamAnswerEntity,
  ExamSubmissionStatusEnum 
} from './entities/student-exam-answer.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from 'src/classes/entities/class-student.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { SmsService } from 'src/sms/sms.service';
import { 
  StartExamDto, 
  SaveAnswerDto, 
  SubmitExamDto, 
  ReportViolationDto 
} from './dto/student-exam.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

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
  ) {}

  /** Flatten questions: wizard exams use sections; legacy uses exam.questions only */
  private getOrderedQuestions(exam: ExamEntity): ExamQuestionEntity[] {
    if (exam.questionSections?.length) {
      const sections = [...exam.questionSections].sort((a, b) => a.sort_order - b.sort_order);
      const out: ExamQuestionEntity[] = [];
      for (const s of sections) {
        const qs = [...(s.questions || [])].sort((a, b) => a.sort_order - b.sort_order);
        out.push(...qs);
      }
      return out;
    }
    return [...(exam.questions || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
        .leftJoin('exam.excluded_students', 'excluded')
        .where('exam.class_id IN (:...classIds)', { classIds })
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
      .leftJoinAndSelect('exam.class', 'class');
    if (!includePast) {
      targetQuery = targetQuery.where('exam.exam_end_time > :now', { now });
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
        subject: exam.test_name || exam.subject,
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
      relations: ['exam', 'exam.class'],
      order: { submitted_at: 'DESC' },
    });

    return submissions.map((sub) => ({
      id: sub.exam_id,
      subject: sub.exam.test_name || sub.exam.subject,
      exam_type: sub.exam.exam_type,
      class_name: sub.exam.class?.class_name,
      submitted_at: sub.submitted_at,
      total_score: sub.total_score,
      max_score: sub.max_score,
      correct_answers: sub.correct_answers,
      wrong_answers: sub.wrong_answers,
      total_questions: sub.total_questions,
      percentage: sub.max_score ? ((sub.total_score || 0) / sub.max_score * 100).toFixed(2) : null,
    }));
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
  ): Promise<{ canAccess: boolean; reason?: string; exam?: ExamEntity }> {
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
      ],
    });

    if (!exam) {
      return { canAccess: false, reason: 'Exam not found' };
    }

    const audience = exam.test_audience;

    if (audience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      const allowed = exam.target_students?.some((s) => s.id === studentId);
      if (!allowed) {
        return { canAccess: false, reason: 'You are not on the list for this exam' };
      }
    } else if (audience !== TestAudienceEnum.ANYONE) {
      if (!exam.class) {
        return { canAccess: false, reason: 'Exam is not assigned to any class' };
      }
      const isInClass = exam.class.classStudents?.some(
        (cs) => cs.student_id === studentId && cs.status === ClassStudentStatusEnum.JOINED,
      );
      if (!isInClass) {
        return { canAccess: false, reason: 'You are not enrolled in this class' };
      }
      const isExcluded = exam.excluded_students?.some((s) => s.id === studentId);
      if (isExcluded) {
        return { canAccess: false, reason: 'You have been excluded from this exam' };
      }
    }

    const existingSubmission = await this.submissionRepo.findOne({
      where: {
        exam_id: examId,
        student_id: studentId,
        status: In([ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED]),
      },
    });

    if (existingSubmission) {
      return { canAccess: false, reason: 'You have already submitted this exam' };
    }

    const disqualifiedSubmission = await this.submissionRepo.findOne({
      where: {
        exam_id: examId,
        student_id: studentId,
        status: ExamSubmissionStatusEnum.DISQUALIFIED,
      },
    });

    if (disqualifiedSubmission) {
      return { canAccess: false, reason: 'You have been disqualified from this exam' };
    }

    return { canAccess: true, exam };
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
          option1: q.option1,
          option2: q.option2,
          option3: q.option3,
          option4: q.option4,
        };
      }
      return {
        id: q.id,
        question_type: q.question_type,
        question: q.question,
        image_url: q.image_url,
        points: q.points ?? q.marks_per_question,
        expected_word_limit: q.expected_word_limit,
        marks_per_question: q.marks_per_question,
      };
    });

    const now = new Date();
    const endTime = new Date(exam.exam_end_time);
    const remainingTimeMs = endTime.getTime() - now.getTime();

    return {
      id: exam.id,
      test_name: exam.test_name,
      subject: exam.test_name || exam.subject,
      exam_type: exam.exam_type,
      exam_kind: exam.exam_kind,
      exam_start_time: exam.exam_start_time,
      exam_end_time: exam.exam_end_time,
      is_negative_marking: exam.is_negative_marking,
      negative_mark_value: exam.negative_mark_value,
      total_questions: questions.length,
      remaining_time_seconds: Math.max(0, Math.floor(remainingTimeMs / 1000)),
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
        status: ExamSubmissionStatusEnum.IN_PROGRESS,
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
    const hasObjective = ordered.some((q) => q.question_type === QuestionTypeEnum.OBJECTIVE);
    const hasSubjective = ordered.some((q) => q.question_type === QuestionTypeEnum.SUBJECTIVE);
    if (hasObjective) {
      await this.calculateObjectiveScore(submission.id, exam);
    }
    if (hasSubjective) {
      await this.calculateSubjectiveMaxScore(submission.id, exam);
    }

    // Update submission status
    submission.status = autoSubmit 
      ? ExamSubmissionStatusEnum.AUTO_SUBMITTED 
      : ExamSubmissionStatusEnum.SUBMITTED;
    submission.submitted_at = new Date();
    submission.updated_at = new Date();

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

  /**
   * Calculate score for objective exam
   */
  private expectedCorrectAnswer(q: ExamQuestionEntity): CorrectAnswerEnum | undefined {
    if (q.correct_answer) {
      return q.correct_answer;
    }
    if (q.correct_option_index === null || q.correct_option_index === undefined) {
      return undefined;
    }
    const arr = [
      CorrectAnswerEnum.OPTION_1,
      CorrectAnswerEnum.OPTION_2,
      CorrectAnswerEnum.OPTION_3,
      CorrectAnswerEnum.OPTION_4,
    ];
    return arr[q.correct_option_index];
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
    let maxObjective = 0;

    for (const answer of answers) {
      const question = questionMap.get(answer.question_id);
      if (!question || question.question_type !== QuestionTypeEnum.OBJECTIVE) continue;

      const pts = question.points ?? 1;
      maxObjective += pts;
      const expected = this.expectedCorrectAnswer(question);

      if (expected && answer.selected_answer === expected) {
        answer.is_correct = true;
        answer.marks_obtained = pts;
        correctCount++;
        totalScore += pts;
      } else if (answer.selected_answer) {
        answer.is_correct = false;
        const nm = exam.negative_mark_value ?? 0;
        const usePercentPenalty = exam.exam_kind != null;
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

    const objectiveQs = ordered.filter((q) => q.question_type === QuestionTypeEnum.OBJECTIVE);
    const answeredObjectiveIds = new Set(
      answers
        .filter(
          (a) =>
            !!a.selected_answer &&
            questionMap.get(a.question_id)?.question_type === QuestionTypeEnum.OBJECTIVE,
        )
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
    const subjectiveQs = ordered.filter((q) => q.question_type === QuestionTypeEnum.SUBJECTIVE);
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
      relations: ['exam', 'exam.questions'],
    });

    if (!submission) {
      throw new NotFoundException('No submission found for this exam');
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
      subject: submission.exam.subject,
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
}
