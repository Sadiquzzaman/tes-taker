import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository, In } from 'typeorm';
import { buildResponseOptionId } from './utils/exam-option-ids.util';
import { ExamEntity, ExamTypeEnum } from './entities/exam.entity';
import {
  ExamQuestionEntity,
  QuestionTypeEnum,
  CorrectAnswerEnum,
  CORRECT_ANSWER_ENUM_BY_OPTION_INDEX,
} from './entities/exam-question.entity';
import { ExamQuestionSectionEntity } from './entities/exam-question-section.entity';
import { CreateObjectiveExamDto, CreateSubjectiveExamDto } from './dto/create-exam.dto';
import { CreateExamWizardDto, WizardMcqQuestionDto, WizardEssayQuestionDto } from './dto/create-exam-wizard.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from 'src/classes/entities/class-student.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { SmsService } from 'src/sms/sms.service';
import { SubjectService } from 'src/subjects/subject.service';
import { ExamKindEnum, ExamLifecycleStatusEnum, TestAudienceEnum } from './enums/exam-wizard.enums';

type WizardSectionType = 'objective' | 'essay' | 'mixed';
type ExamQuestionResponse = {
  id: string;
  text: string;
  image: null;
  points: number | null;
  instruction?: string | null;
  showValidation: false;
  options?: Array<{ id: string; text: string; image: null }>;
  correctOptionId?: string | null;
};
type ExamSectionResponse = {
  id: string;
  type: string;
  headerText: string | null;
  instruction: string | null;
  questions: ExamQuestionResponse[];
};
type ExamSubjectResponse = {
  id: string | null;
  name: string | null;
  code: string | null;
  questionSections: ExamSectionResponse[];
};

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

    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,

    private readonly smsService: SmsService,
    private readonly subjectService: SubjectService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Unified wizard create (hybrid | model)
   */
  async createFromWizard(
    dto: CreateExamWizardDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<any> {
    const { formState, subjects, publishState } = dto;

    if (publishState.scheduleAt >= publishState.endingAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (formState.allowNegativeMarking) {
      const v = Number(formState.negativeMarking);
      if (
        formState.negativeMarking === undefined ||
        formState.negativeMarking === null ||
        Number.isNaN(v) ||
        v <= 0 ||
        v > 100
      ) {
        throw new BadRequestException(
          'Negative marking must be a percentage between 1 and 100 when enabled',
        );
      }
    }

    const subjectIds = subjects.map((s) => s.id);
    await this.subjectService.assertSubjectsExist(subjectIds);

    if (formState.examType === ExamKindEnum.HYBRID) {
      if (subjects.length !== 1) {
        throw new BadRequestException(`${formState.examType} exams must include exactly one subject block`);
      }
    }

    this.validateSectionsForExamType(formState.examType, subjects);

    let primarySubjectId: string | null = subjects[0].id;
    if (formState.examType === ExamKindEnum.MODEL) {
      primarySubjectId = null;
    }

    if (publishState.testAudience === TestAudienceEnum.SELECTED_CLASS) {
      if (!publishState.selectedClassId) {
        throw new BadRequestException('selectedClassId is required when test audience is selected_class');
      }
      const cls = await this.classRepo.findOne({ where: { id: publishState.selectedClassId } });
      if (!cls) throw new BadRequestException('Class not found');
      if (
        jwtPayload.role === RolesEnum.TEACHER &&
        cls.teacher_id !== jwtPayload.id
      ) {
        throw new ForbiddenException('You do not own this class');
      }
    }

    let targetStudents: UserEntity[] = [];
    if (publishState.testAudience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      const ids = publishState.specificStudents || [];
      if (ids.length === 0) {
        throw new BadRequestException('specificStudents must contain at least one student id');
      }
      targetStudents = await this.userRepo.find({
        where: { id: In(ids), role: RolesEnum.STUDENT },
      });
      if (targetStudents.length !== ids.length) {
        throw new BadRequestException('One or more student ids are invalid');
      }
    }

    const { hasObjective, hasSubjective } = this.countQuestionTypes(subjects);
    const examType =
      hasObjective && !hasSubjective
        ? ExamTypeEnum.OBJECTIVE
        : hasSubjective && !hasObjective
          ? ExamTypeEnum.SUBJECTIVE
          : ExamTypeEnum.OBJECTIVE;

    const negativeVal = formState.allowNegativeMarking
      ? Number(formState.negativeMarking)
      : undefined;

    let examSubjectLabel = formState.testName.trim();
    if (primarySubjectId) {
      try {
        const sub = await this.subjectService.findOne(primarySubjectId);
        examSubjectLabel = sub.name;
      } catch {
        // Subject missing despite assertSubjectsExist — keep test title
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const examRepo = manager.getRepository(ExamEntity);
      const sectionRepo = manager.getRepository(ExamQuestionSectionEntity);
      const questionRepo = manager.getRepository(ExamQuestionEntity);

      const examPayload: DeepPartial<ExamEntity> = {
        exam_type: examType,
        exam_kind: formState.examType,
        test_name: formState.testName.trim(),
        primary_subject_id: primarySubjectId,
        duration_minutes: formState.duration,
        passing_score: formState.passingScore,
        publish_timing: publishState.publishTiming,
        test_audience: publishState.testAudience,
        exam_start_time: publishState.scheduleAt,
        exam_end_time: publishState.endingAt,
        is_negative_marking: formState.allowNegativeMarking,
        negative_mark_value: negativeVal ?? null,
        subject: examSubjectLabel,
        class_id:
          publishState.testAudience === TestAudienceEnum.SELECTED_CLASS
            ? publishState.selectedClassId!
            : null,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      };

      const newExam = examRepo.create(examPayload);
      let savedExam: ExamEntity = await examRepo.save(newExam);
      if (targetStudents.length > 0) {
        savedExam.target_students = targetStudents;
        savedExam = await examRepo.save(savedExam);
      }

      let sectionOrder = 0;
      for (const subj of subjects) {
        for (const sec of subj.questionSections) {
          const sectionType = this.resolveWizardSectionType(sec.questions);
          const sectionPayload: DeepPartial<ExamQuestionSectionEntity> = {
            exam_id: savedExam.id,
            subject_id: subj.id,
            section_type: sectionType,
            header_text: sec.headerText ?? null,
            instruction: sec.instruction?.trim() ? sec.instruction.trim().slice(0, 1000) : null,
            sort_order: sectionOrder++,
            created_by: jwtPayload.id,
            created_user_name: jwtPayload.full_name,
            created_at: new Date(),
          };
          const section = sectionRepo.create(sectionPayload);
          const savedSec = await sectionRepo.save(section);

          let qOrder = 0;
          for (const raw of sec.questions) {
            const questionKind = this.inferWizardQuestionKind(raw);
            if (questionKind === 'objective') {
              const q = raw as unknown as WizardMcqQuestionDto;
              this.assertMcqQuestion(q);
              const points = this.normalizeQuestionPoints(q.points);
              const idx = q.options.findIndex((o) => o.id === q.correctOptionId);
              if (idx < 0 || idx >= q.options.length) {
                throw new BadRequestException('Each MCQ must reference a valid correctOptionId');
              }
              const objectivePayload: DeepPartial<ExamQuestionEntity> = {
                section_id: savedSec.id,
                exam: { id: savedExam.id } as ExamEntity,
                sort_order: qOrder++,
                question_type: QuestionTypeEnum.OBJECTIVE,
                question: q.text,
                image_url: null,
                points,
                instruction: q.instruction?.trim() ? q.instruction.trim().slice(0, 500) : null,
                correct_option_index: idx,
                correct_answer: CORRECT_ANSWER_ENUM_BY_OPTION_INDEX[idx],
                option1: q.options[0]?.text ?? null,
                option2: q.options[1]?.text ?? null,
                option3: q.options[2]?.text ?? null,
                option4: q.options[3]?.text ?? null,
                option5: q.options[4]?.text ?? null,
                created_by: jwtPayload.id,
                created_user_name: jwtPayload.full_name,
                created_at: new Date(),
              };
              const row = questionRepo.create(objectivePayload);
              await questionRepo.save(row);
            } else {
              const q = raw as unknown as WizardEssayQuestionDto;
              this.assertEssayQuestion(q);
              const points = this.normalizeQuestionPoints(q.points);
              const essayPayload: DeepPartial<ExamQuestionEntity> = {
                section_id: savedSec.id,
                exam: { id: savedExam.id } as ExamEntity,
                sort_order: qOrder++,
                question_type: QuestionTypeEnum.SUBJECTIVE,
                question: q.text,
                image_url: null,
                points,
                instruction: q.instruction?.trim() ? q.instruction.trim().slice(0, 500) : null,
                marks_per_question: points,
                created_by: jwtPayload.id,
                created_user_name: jwtPayload.full_name,
                created_at: new Date(),
              };
              const row = questionRepo.create(essayPayload);
              await questionRepo.save(row);
            }
          }
        }
      }

      const reloaded = await examRepo.findOne({
        where: { id: savedExam.id },
        relations: [
          'questions',
          'questionSections',
          'questionSections.questions',
          'questionSections.subject',
          'class',
          'excluded_students',
          'target_students',
          'primary_subject',
        ],
      });
      if (!reloaded) throw new NotFoundException('Exam not found after create');

      if (
        publishState.testAudience === TestAudienceEnum.SELECTED_CLASS &&
        publishState.selectedClassId
      ) {
        this.sendExamNotifications(reloaded.id).catch((err) => {
          console.error('Failed to send exam notifications:', err);
        });
      }
      if (publishState.testAudience === TestAudienceEnum.SPECIFIC_STUDENTS) {
        this.sendExamNotificationsToTargets(reloaded.id).catch((err) => {
          console.error('Failed to send exam notifications:', err);
        });
      }

      return this.formatExamResponse(reloaded, { includeCorrectAnswers: true });
    });
  }

  private validateSectionsForExamType(kind: ExamKindEnum, subjects: CreateExamWizardDto['subjects']): void {
    const { hasObjective, hasSubjective } = this.countQuestionTypes(subjects);

    if (kind === ExamKindEnum.HYBRID) {
      if (!hasObjective && !hasSubjective) {
        throw new BadRequestException('Hybrid exams must include at least one question');
      }
    }
    if (kind === ExamKindEnum.MODEL) {
      if (!hasObjective && !hasSubjective) {
        throw new BadRequestException('Model exams must include at least one question');
      }
    }
  }

  private countQuestionTypes(subjects: CreateExamWizardDto['subjects']): {
    hasObjective: boolean;
    hasSubjective: boolean;
  } {
    let hasObjective = false;
    let hasSubjective = false;
    for (const s of subjects) {
      for (const sec of s.questionSections) {
        for (const raw of sec.questions) {
          if (this.inferWizardQuestionKind(raw) === 'objective') {
            hasObjective = true;
          } else {
            hasSubjective = true;
          }
        }
      }
    }
    return { hasObjective, hasSubjective };
  }

  private inferWizardQuestionKind(raw: unknown): Exclude<WizardSectionType, 'mixed'> {
    const q = (raw ?? {}) as Record<string, unknown>;
    return Array.isArray(q.options) || typeof q.correctOptionId === 'string'
      ? 'objective'
      : 'essay';
  }

  private resolveWizardSectionType(rawQuestions: Record<string, unknown>[]): WizardSectionType {
    let hasObjective = false;
    let hasEssay = false;

    for (const raw of rawQuestions) {
      if (this.inferWizardQuestionKind(raw) === 'objective') {
        hasObjective = true;
      } else {
        hasEssay = true;
      }
    }

    if (hasObjective && hasEssay) {
      return 'mixed';
    }

    return hasObjective ? 'objective' : 'essay';
  }

  private normalizeQuestionPoints(points: unknown): number {
    const normalized = Number(points);
    if (!Number.isFinite(normalized) || normalized < 0) {
      throw new BadRequestException('Each question must include a valid non-negative points value');
    }
    return normalized;
  }

  private assertMcqQuestion(q: WizardMcqQuestionDto): void {
    if (!q.options || q.options.length < 2 || q.options.length > 5) {
      throw new BadRequestException('Each MCQ must have between 2 and 5 options');
    }
    const optionIds = q.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BadRequestException('Each MCQ option id must be unique');
    }
    if (!q.text || q.points === undefined || !q.correctOptionId) {
      throw new BadRequestException('Each MCQ needs text, options, points, and correctOptionId');
    }
    this.normalizeQuestionPoints(q.points);
  }

  private assertEssayQuestion(q: WizardEssayQuestionDto): void {
    if (!q.text || q.points === undefined) {
      throw new BadRequestException('Each essay question needs text and points');
    }
    this.normalizeQuestionPoints(q.points);
  }

  /**
   * Create an objective exam (legacy)
   */
  async createObjectiveExam(
    dto: CreateObjectiveExamDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<any> {
    if (dto.is_negative_marking && (!dto.negative_mark_value || dto.negative_mark_value <= 0)) {
      throw new BadRequestException(
        'Negative mark value is required if negative marking is enabled and must be greater than 0',
      );
    }

    if (dto.exam_start_time >= dto.exam_end_time) {
      throw new BadRequestException('Exam start time must be before end time');
    }

    if (dto.class_id) {
      const classEntity = await this.classRepo.findOne({ where: { id: dto.class_id } });
      if (!classEntity) {
        throw new BadRequestException('Class not found');
      }
    }

    let excludedStudents: UserEntity[] = [];
    if (dto.excluded_student_ids && dto.excluded_student_ids.length > 0) {
      excludedStudents = await this.userRepo.find({
        where: { id: In(dto.excluded_student_ids), role: RolesEnum.STUDENT },
      });
    }

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
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const savedExam = await this.examRepo.save(exam);

    const questions = dto.questions.map((q, i) =>
      this.questionRepo.create({
        question_type: QuestionTypeEnum.OBJECTIVE,
        question: q.question,
        sort_order: i,
        points: 1,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        exam: savedExam,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      }),
    );

    await this.questionRepo.save(questions);

    if (dto.class_id) {
      this.sendExamNotifications(savedExam.id).catch((err) => {
        console.error('Failed to send exam notifications:', err);
      });
    }

    return this.findOne(savedExam.id, jwtPayload);
  }

  /**
   * Create a subjective exam (legacy)
   */
  async createSubjectiveExam(
    dto: CreateSubjectiveExamDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<any> {
    if (dto.exam_start_time >= dto.exam_end_time) {
      throw new BadRequestException('Exam start time must be before end time');
    }

    if (dto.class_id) {
      const classEntity = await this.classRepo.findOne({ where: { id: dto.class_id } });
      if (!classEntity) {
        throw new BadRequestException('Class not found');
      }
    }

    let excludedStudents: UserEntity[] = [];
    if (dto.excluded_student_ids && dto.excluded_student_ids.length > 0) {
      excludedStudents = await this.userRepo.find({
        where: { id: In(dto.excluded_student_ids), role: RolesEnum.STUDENT },
      });
    }

    const exam = this.examRepo.create({
      exam_type: ExamTypeEnum.SUBJECTIVE,
      exam_start_time: dto.exam_start_time,
      exam_end_time: dto.exam_end_time,
      is_negative_marking: false,
      subject: dto.subject,
      class_id: dto.class_id,
      excluded_students: excludedStudents,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const savedExam = await this.examRepo.save(exam);

    const questions = dto.questions.map((q, i) =>
      this.questionRepo.create({
        question_type: QuestionTypeEnum.SUBJECTIVE,
        question: q.question,
        sort_order: i,
        points: q.marks_per_question,
        expected_word_limit: q.expected_word_limit,
        marks_per_question: q.marks_per_question,
        sample_answer: q.sample_answer,
        exam: savedExam,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      }),
    );

    await this.questionRepo.save(questions);

    if (dto.class_id) {
      this.sendExamNotifications(savedExam.id).catch((err) => {
        console.error('Failed to send exam notifications:', err);
      });
    }

    return this.findOne(savedExam.id, jwtPayload);
  }

  private async sendExamNotifications(examId: string): Promise<{ sent: number; failed: number }> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: ['class', 'class.classStudents', 'class.classStudents.student', 'excluded_students'],
    });

    if (!exam || !exam.class) {
      return { sent: 0, failed: 0 };
    }

    const classStudentEntities = (exam.class.classStudents || []).filter(
      (cs) => cs.status === ClassStudentStatusEnum.JOINED && cs.student_id !== null,
    );
    const classStudents = classStudentEntities.map((cs) => cs.student).filter((s) => s !== null) as UserEntity[];

    const excludedIds = (exam.excluded_students || []).map((s) => s.id);

    const assignedStudents = classStudents.filter((s) => !excludedIds.includes(s.id));

    return this.sendSmsToStudents(assignedStudents, exam);
  }

  private async sendExamNotificationsToTargets(examId: string): Promise<{ sent: number; failed: number }> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: ['target_students'],
    });
    if (!exam?.target_students?.length) return { sent: 0, failed: 0 };
    return this.sendSmsToStudents(exam.target_students, exam);
  }

  private async sendSmsToStudents(
    students: UserEntity[],
    exam: ExamEntity,
  ): Promise<{ sent: number; failed: number }> {
    if (students.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    const examDate = new Date(exam.exam_start_time);
    const formattedDate = examDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const title = exam.test_name || exam.subject || 'Your exam';

    for (const student of students) {
      if (student.phone) {
        try {
          const message = `You have an upcoming exam "${title}" scheduled for ${formattedDate}. Please prepare accordingly. - Testaker`;
          const result = await this.smsService.sendSms(student.phone, message);
          if (result) sent++;
          else failed++;
        } catch (error) {
          console.error(`Failed to send notification to ${student.phone}:`, error);
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  async findAll(jwtPayload: JwtPayloadInterface): Promise<any[]> {
    const exams = await this.examRepo.find({
      where: { created_by: jwtPayload.id },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
    return exams.map((exam) => this.formatExamResponse(exam, { includeCorrectAnswers: true }));
  }

  async findAllAdmin(): Promise<any[]> {
    const exams = await this.examRepo.find({
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
    return exams.map((exam) => this.formatExamResponse(exam, { includeCorrectAnswers: true }));
  }

  async findByClass(classId: string, jwtPayload: JwtPayloadInterface): Promise<any[]> {
    const exams = await this.examRepo.find({
      where: { class_id: classId },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
    return exams.map((exam) => this.formatExamResponse(exam, { includeCorrectAnswers: true }));
  }

  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<any> {
    const exam = await this.findOneEntity(id);

    if (
      jwtPayload.role === RolesEnum.TEACHER &&
      exam.created_by !== jwtPayload.id
    ) {
      throw new ForbiddenException('You do not have permission to view this exam');
    }

    return this.formatExamResponse(exam, { includeCorrectAnswers: true });
  }

  /**
   * Full exam for a student (no correct answers / correct option ids), when audience rules allow.
   */
  async findOneForStudent(id: string, jwtPayload: JwtPayloadInterface): Promise<any> {
    if (jwtPayload.role !== RolesEnum.STUDENT) {
      throw new ForbiddenException('Only students can use this access path');
    }

    const exam = await this.examRepo.findOne({
      where: { id },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const studentId = jwtPayload.id;
    await this.assertStudentCanViewExam(exam, studentId, jwtPayload);

    const examStarted = Date.now() >= new Date(exam.exam_start_time).getTime();

    return this.formatExamResponse(exam, {
      includeCorrectAnswers: false,
      includeQuestions: examStarted,
    });
  }

  private async assertStudentCanViewExam(
    exam: ExamEntity,
    studentId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    const excluded = exam.excluded_students?.some((s) => s.id === studentId);
    if (excluded) {
      throw new ForbiddenException('You have been excluded from this exam');
    }

    if (exam.test_audience === TestAudienceEnum.ANYONE) {
      return;
    }

    if (exam.test_audience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      const allowed = exam.target_students?.some((s) => s.id === studentId);
      if (!allowed) {
        throw new ForbiddenException('You are not on the list for this exam');
      }
      return;
    }

    if (exam.test_audience === TestAudienceEnum.SELECTED_CLASS) {
      const ok = await this.isStudentInClassForExam(exam, jwtPayload);
      if (!ok) {
        throw new ForbiddenException('You are not enrolled in this class for this exam');
      }
      return;
    }

    throw new ForbiddenException('You do not have access to this exam');
  }

  /**
   * Tests assigned to the student (class membership, specific_students list; not open "anyone" exams).
   */
  async findAllAssignedForStudent(studentId: string): Promise<
    Array<{
      id: string;
      test_name: string | null;
      subject: string | null;
      exam_type: string;
      exam_kind: string | null;
      test_audience: string | null;
      duration_minutes: number | null;
      exam_start_time: Date;
      exam_end_time: Date;
      class_id: string | null;
      class_name: string | null;
      created_user_name: string | null;
      status: ExamLifecycleStatusEnum;
    }>
  > {
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
      const classExams = await this.examRepo
        .createQueryBuilder('exam')
        .leftJoinAndSelect('exam.class', 'class')
        .leftJoin('exam.excluded_students', 'excluded')
        .where('exam.class_id IN (:...classIds)', { classIds })
        .andWhere('(excluded.id IS NULL OR excluded.id != :studentId)', { studentId })
        .orderBy('exam.exam_start_time', 'DESC')
        .getMany();
      classExams.forEach((e) => byId.set(e.id, e));
    }

    const targetExams = await this.examRepo
      .createQueryBuilder('exam')
      .innerJoin('exam.target_students', 'st', 'st.id = :studentId', { studentId })
      .leftJoinAndSelect('exam.class', 'class')
      .orderBy('exam.exam_start_time', 'DESC')
      .getMany();
    targetExams.forEach((e) => byId.set(e.id, e));

    return Array.from(byId.values())
      .sort(
        (a, b) =>
          new Date(b.exam_start_time).getTime() - new Date(a.exam_start_time).getTime(),
      )
      .map((exam) => ({
        id: exam.id,
        test_name: exam.test_name,
        subject: exam.test_name || exam.subject,
        exam_type: this.resolveResponseExamType(exam),
        exam_kind: exam.exam_kind,
        test_audience: exam.test_audience,
        duration_minutes: exam.duration_minutes,
        exam_start_time: exam.exam_start_time,
        exam_end_time: exam.exam_end_time,
        class_id: exam.class_id,
        class_name: exam.class?.class_name ?? null,
        created_user_name: exam.created_user_name ?? null,
        status: this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time),
      }));
  }

  private async isStudentInClassForExam(
    exam: ExamEntity,
    jwtPayload: JwtPayloadInterface,
  ): Promise<boolean> {
    if (!exam.class_id) {
      return false;
    }

    const emailNorm = jwtPayload.email?.toLowerCase()?.trim() || null;
    const phoneNorm = jwtPayload.phone?.trim() || null;

    const rows = await this.classStudentRepo.find({
      where: { class_id: exam.class_id, status: ClassStudentStatusEnum.JOINED },
    });

    return rows.some((cs) => {
      if (cs.student_id === jwtPayload.id) {
        return true;
      }
      if (emailNorm && cs.invited_email?.toLowerCase().trim() === emailNorm) {
        return true;
      }
      if (phoneNorm && cs.invited_phone?.trim() === phoneNorm) {
        return true;
      }
      return false;
    });
  }

  /**
   * Minimal exam card for unauthenticated clients or students hitting GET /v1/exams/:id.
   */
  async findOnePublicSummary(
    id: string,
  ): Promise<{
    id: string;
    test_name: string | null;
    created_user_name: string | null;
    duration_minutes: number | null;
    test_audience: string | null;
    status: ExamLifecycleStatusEnum;
  }> {
    const exam = await this.examRepo.findOne({
      where: { id },
      select: [
        'id',
        'test_name',
        'created_user_name',
        'test_audience',
        'duration_minutes',
        'exam_start_time',
        'exam_end_time',
      ],
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    return {
      id: exam.id,
      test_name: exam.test_name,
      duration_minutes: exam.duration_minutes,
      test_audience: exam.test_audience,
      created_user_name: exam.created_user_name ?? null,
      status: this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time),
    };
  }

  private computeExamLifecycleStatus(start: Date, end: Date): ExamLifecycleStatusEnum {
    const now = Date.now();
    const t0 = new Date(start).getTime();
    const t1 = new Date(end).getTime();
    if (now < t0) {
      return ExamLifecycleStatusEnum.PENDING;
    }
    if (now > t1) {
      return ExamLifecycleStatusEnum.COMPLETED;
    }
    return ExamLifecycleStatusEnum.ONGOING;
  }

  private async findOneEntity(id: string): Promise<ExamEntity> {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'questionSections.subject',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }

  private formatExamResponse(
    exam: ExamEntity,
    opts: { includeCorrectAnswers: boolean; includeQuestions?: boolean } = {
      includeCorrectAnswers: true,
      includeQuestions: true,
    },
  ) {
    const {
      questions: _questions,
      questionSections: _questionSections,
      exam_kind: _examKind,
      primary_subject_id: _primarySubjectId,
      primary_subject: _primarySubject,
      ...rest
    } = exam;

    return {
      ...rest,
      exam_type: this.resolveResponseExamType(exam),
      status: this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time),
      subjects:
        opts.includeQuestions === false
          ? []
          : this.buildSubjectResponses(exam, opts.includeCorrectAnswers),
    };
  }

  private buildSubjectResponses(exam: ExamEntity, includeCorrectAnswers: boolean): ExamSubjectResponse[] {
    const sections = exam.questionSections || [];
    if (sections.length === 0) {
      return exam.primary_subject || exam.subject
        ? [
            {
              id: exam.primary_subject?.id ?? null,
              name: exam.primary_subject?.name ?? exam.subject ?? null,
              code: exam.primary_subject?.code ?? null,
              questionSections: [],
            },
          ]
        : [];
    }

    const grouped = new Map<string, ExamSubjectResponse>();
    for (const section of sections) {
      const subject = section.subject ?? null;
      const key = subject?.id ?? `legacy:${exam.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: subject?.id ?? exam.primary_subject?.id ?? null,
          name: subject?.name ?? exam.primary_subject?.name ?? exam.subject ?? null,
          code: subject?.code ?? exam.primary_subject?.code ?? null,
          questionSections: [],
        });
      }

      grouped.get(key)!.questionSections.push({
        id: section.id,
        type: section.section_type,
        headerText: section.header_text,
        instruction: section.instruction ?? null,
        questions: (section.questions || []).map((question) =>
          this.formatQuestionResponse(question, includeCorrectAnswers),
        ),
      });
    }

    return Array.from(grouped.values());
  }

  private resolveResponseExamType(exam: ExamEntity): string {
    if (exam.exam_kind) {
      return exam.exam_kind;
    }

    return exam.exam_type === ExamTypeEnum.SUBJECTIVE ? 'essay' : 'mcq';
  }

  private formatQuestionResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
  ): ExamQuestionResponse {
    if (question.question_type === QuestionTypeEnum.OBJECTIVE) {
      const rawTexts = [
        question.option1,
        question.option2,
        question.option3,
        question.option4,
        question.option5,
      ] as (string | null | undefined)[];

      let lastFilled = -1;
      for (let i = 0; i < rawTexts.length; i++) {
        if (rawTexts[i]?.trim()) {
          lastFilled = i;
        }
      }

      const correctIndex =
        question.correct_option_index ?? this.getCorrectOptionIndexFromAnswer(question.correct_answer);
      const optionCount = Math.max(
        lastFilled + 1,
        correctIndex !== null && correctIndex >= 0 ? correctIndex + 1 : 0,
      );

      const options = rawTexts.slice(0, optionCount).map((text, index) => ({
        id: buildResponseOptionId(question.id, index),
        text: (text ?? '').trim(),
        image: null,
      }));

      const base: ExamQuestionResponse = {
        id: question.id,
        text: question.question,
        image: null,
        options,
        points: question.points ?? 1,
        instruction: question.instruction ?? null,
        showValidation: false,
      };

      if (!includeCorrectAnswers) {
        return base;
      }

      return {
        ...base,
        correctOptionId:
          correctIndex !== null && correctIndex >= 0 && correctIndex < options.length
            ? options[correctIndex].id
            : null,
      };
    }

    return {
      id: question.id,
      text: question.question,
      image: null,
      points: question.points ?? question.marks_per_question ?? null,
      instruction: question.instruction ?? null,
      showValidation: false,
    };
  }

  private getCorrectOptionIndexFromAnswer(
    answer?: CorrectAnswerEnum,
  ): number | null {
    if (!answer) {
      return null;
    }

    return CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(answer);
  }

  async updateExcludedStudents(
    examId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<any> {
    const exam = await this.findOneEntity(examId);

    if (
      exam.created_by !== jwtPayload.id &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to update this exam');
    }

    const students = await this.userRepo.find({
      where: { id: In(studentIds), role: RolesEnum.STUDENT },
    });

    exam.excluded_students = students;
    await this.examRepo.save(exam);

    return this.findOne(examId, jwtPayload);
  }

  async delete(id: string, jwtPayload: JwtPayloadInterface): Promise<void> {
    const exam = await this.findOneEntity(id);

    if (
      exam.created_by !== jwtPayload.id &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to delete this exam');
    }

    await this.examRepo.remove(exam);
  }
}
