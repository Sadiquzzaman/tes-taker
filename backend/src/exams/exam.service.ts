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
import {
  CreateExamWizardDto,
  WizardChildQuestionDto,
  WizardGradedQuestionDto,
  WizardPassageQuestionDto,
  WizardUngradedQuestionDto,
} from './dto/create-exam-wizard.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from 'src/classes/entities/class-student.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { SmsService } from 'src/sms/sms.service';
import { SubjectService } from 'src/subjects/subject.service';
import { ExamLifecycleStatusEnum, TestAudienceEnum } from './enums/exam-wizard.enums';
import { QuestionCategoryEnum } from './enums/question.enums';
import {
  mapAnswerForStorage,
  mapMatchingForStorage,
  mapOptionsForStorage,
  normalizePoints,
  parseWizardQuestion,
  resolveQuestionId,
  syncLegacyOptionColumns,
  validateSubjectQuestions,
} from './utils/exam-question.util';
import {
  ExamSubmissionStatusEnum,
} from './entities/student-exam-answer.entity';

type ExamListMetrics = {
  participant_count: number | 'N/A';
  submitted_count: number;
};

type ExamQuestionResponse = Record<string, unknown>;
type ExamSubjectResponse = {
  id: string | null;
  name: string | null;
  code: string | null;
  questions: ExamQuestionResponse[];
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
   * Unified wizard create (graded / ungraded / passage questions)
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

    for (const subj of subjects) {
      validateSubjectQuestions(subj.questions);
    }

    const { hasAutoScored, hasManual } = this.countQuestionCategories(subjects);
    if (!hasAutoScored && !hasManual) {
      throw new BadRequestException('Exam must include at least one question');
    }

    const primarySubjectId = subjects.length === 1 ? subjects[0].id : null;

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

    let excludedStudents: UserEntity[] = [];
    const excludedIds = publishState.excluded_students ?? [];
    if (excludedIds.length > 0) {
      excludedStudents = await this.userRepo.find({
        where: { id: In(excludedIds), role: RolesEnum.STUDENT },
      });
      if (excludedStudents.length !== excludedIds.length) {
        throw new BadRequestException('One or more excluded student ids are invalid');
      }
    }

    const examType =
      hasAutoScored && !hasManual
        ? ExamTypeEnum.OBJECTIVE
        : hasManual && !hasAutoScored
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
        exam_kind: null,
        test_name: formState.testName.trim(),
        primary_subject_id: primarySubjectId,
        duration_minutes: formState.duration,
        passing_score: formState.passingScore ?? null,
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
        excluded_students: excludedStudents,
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
        const sectionPayload: DeepPartial<ExamQuestionSectionEntity> = {
          exam_id: savedExam.id,
          subject_id: subj.id,
          section_type: 'mixed',
          header_text: null,
          instruction: null,
          sort_order: sectionOrder++,
          created_by: jwtPayload.id,
          created_user_name: jwtPayload.full_name,
          created_at: new Date(),
        };
        const section = sectionRepo.create(sectionPayload);
        const savedSec = await sectionRepo.save(section);

        let qOrder = 0;
        for (const raw of subj.questions) {
          const parsed = parseWizardQuestion(raw);
          if (parsed.kind === 'passage') {
            qOrder = await this.persistPassageQuestion(
              questionRepo,
              savedExam.id,
              savedSec.id,
              parsed.data,
              qOrder,
              jwtPayload,
            );
          } else if (parsed.kind === 'graded') {
            await this.persistAutoScoredQuestion(
              questionRepo,
              savedExam.id,
              savedSec.id,
              parsed.data,
              qOrder++,
              jwtPayload,
              QuestionCategoryEnum.GRADED,
              null,
            );
          } else {
            await this.persistUngradedQuestion(
              questionRepo,
              savedExam.id,
              savedSec.id,
              parsed.data,
              qOrder++,
              jwtPayload,
            );
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

  private countQuestionCategories(subjects: CreateExamWizardDto['subjects']): {
    hasAutoScored: boolean;
    hasManual: boolean;
  } {
    let hasAutoScored = false;
    let hasManual = false;

    for (const subj of subjects) {
      for (const raw of subj.questions) {
        const parsed = parseWizardQuestion(raw);
        if (parsed.kind === 'passage' || parsed.kind === 'graded') {
          hasAutoScored = true;
        } else {
          hasManual = true;
        }
      }
    }

    return { hasAutoScored, hasManual };
  }

  private async persistPassageQuestion(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    passage: WizardPassageQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
  ): Promise<number> {
    const parentPayload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(passage.id),
      section_id: sectionId,
      exam: { id: examId } as ExamEntity,
      sort_order: sortOrder,
      question_type: QuestionTypeEnum.SUBJECTIVE,
      category: QuestionCategoryEnum.PASSAGE,
      sub_type: null,
      parent_id: null,
      passage_text: passage.passageText.trim(),
      question: passage.passageText.trim().slice(0, 500),
      image_url: null,
      points: null,
      instruction: null,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    };
    const parentRow = questionRepo.create(parentPayload);
    const savedParent = await questionRepo.save(parentRow);

    let childOrder = 0;
    for (const child of passage.childQuestions) {
      await this.persistAutoScoredQuestion(
        questionRepo,
        examId,
        sectionId,
        child,
        childOrder++,
        jwtPayload,
        QuestionCategoryEnum.PASSAGE,
        savedParent.id,
      );
    }

    return sortOrder + 1;
  }

  private async persistAutoScoredQuestion(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    q: WizardGradedQuestionDto | WizardChildQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
    category: QuestionCategoryEnum.GRADED | QuestionCategoryEnum.PASSAGE,
    parentId: string | null,
  ): Promise<void> {
    const points = normalizePoints(q.points);
    const options = mapOptionsForStorage(q.options);
    const matchingOptions = mapMatchingForStorage(q.matchingOptions);
    const answerJson = mapAnswerForStorage(q.answer);
    const legacyOpts = syncLegacyOptionColumns(options, q.answer?.value ?? []);

    const payload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(q.id),
      section_id: sectionId,
      exam: { id: examId } as ExamEntity,
      sort_order: sortOrder,
      question_type: QuestionTypeEnum.OBJECTIVE,
      category,
      sub_type: q.subType,
      parent_id: parentId,
      passage_text: null,
      question: q.text.trim(),
      image_url: null,
      points,
      instruction: q.instruction?.trim() ? q.instruction.trim().slice(0, 500) : null,
      options_json: options.length ? options : null,
      matching_options_json: matchingOptions,
      answer_json: answerJson,
      option1: legacyOpts.option1,
      option2: legacyOpts.option2,
      option3: legacyOpts.option3,
      option4: legacyOpts.option4,
      option5: legacyOpts.option5 ?? null,
      correct_option_index: legacyOpts.correct_option_index,
      correct_answer:
        legacyOpts.correct_option_index !== null && legacyOpts.correct_option_index >= 0
          ? CORRECT_ANSWER_ENUM_BY_OPTION_INDEX[legacyOpts.correct_option_index]
          : undefined,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    };

    const row = questionRepo.create(payload);
    await questionRepo.save(row);
  }

  private async persistUngradedQuestion(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    q: WizardUngradedQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    const points = normalizePoints(q.points);
    const answerJson = mapAnswerForStorage(q.answer);

    const payload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(q.id),
      section_id: sectionId,
      exam: { id: examId } as ExamEntity,
      sort_order: sortOrder,
      question_type: QuestionTypeEnum.SUBJECTIVE,
      category: QuestionCategoryEnum.UNGRADED,
      sub_type: q.subType,
      parent_id: null,
      passage_text: null,
      question: q.text.trim(),
      image_url: null,
      points,
      marks_per_question: points,
      instruction: q.instruction?.trim() ? q.instruction.trim().slice(0, 500) : null,
      answer_json: answerJson,
      sample_answer: answerJson?.value?.join('\n'),
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    };

    const row = questionRepo.create(payload);
    await questionRepo.save(row);
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
    const metrics = await this.loadExamListMetrics(exams);
    return exams.map((exam) => ({
      ...this.formatExamResponse(exam, { includeCorrectAnswers: true }),
      ...metrics.get(exam.id)!,
    }));
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
    const metrics = await this.loadExamListMetrics(exams);
    return exams.map((exam) => ({
      ...this.formatExamResponse(exam, { includeCorrectAnswers: true }),
      ...metrics.get(exam.id)!,
    }));
  }

  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<any> {
    const exam = await this.findOneEntity(id);

    if (
      jwtPayload.role === RolesEnum.TEACHER &&
      exam.created_by !== jwtPayload.id
    ) {
      throw new ForbiddenException('You do not have permission to view this exam');
    }

    return this.formatAuthorizedExamResponse(exam, {
      audience: 'teacher',
      includeCorrectAnswers: true,
      includeQuestions: true,
    });
  }

  /**
   * Full exam for a student (no correct answers), when audience rules allow.
   * Questions are included only after exam_start_time.
   */
  async findOneForStudent(id: string, jwtPayload: JwtPayloadInterface): Promise<any> {
    if (jwtPayload.role !== RolesEnum.STUDENT) {
      throw new ForbiddenException('Only students can use this access path');
    }

    const exam = await this.findOneEntity(id);
    const studentId = jwtPayload.id;
    await this.assertStudentCanViewExam(exam, studentId, jwtPayload);

    const examStarted = Date.now() >= new Date(exam.exam_start_time).getTime();

    return this.formatAuthorizedExamResponse(exam, {
      audience: 'student',
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

  async assertExamExists(examId: string): Promise<void> {
    const exam = await this.examRepo.findOne({ where: { id: examId }, select: ['id'] });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
  }

  async assertTeacherCanMonitorExam(
    examId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    const exam = await this.examRepo.findOne({
      where: { id: examId },
      select: ['id', 'created_by'],
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }
    if (
      jwtPayload.role === RolesEnum.TEACHER &&
      exam.created_by !== jwtPayload.id
    ) {
      throw new ForbiddenException('You do not have permission to monitor this exam');
    }
  }

  async assertStudentCanTakeExam(
    examId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    const exam = await this.findOneEntity(examId);
    await this.assertStudentCanViewExam(exam, jwtPayload.id, jwtPayload);
  }

  /**
   * Tests assigned to the student (class membership, specific_students list; not open "anyone" exams).
   */
  async findAllAssignedForStudent(studentId: string): Promise<
    Array<{
      id: string;
      test_name: string | null;
      subject: string | null;
      test_audience: string | null;
      duration_minutes: number | null;
      exam_start_time: Date;
      exam_end_time: Date;
      class_id: string | null;
      class_name: string | null;
      created_user_name: string | null;
      status: ExamLifecycleStatusEnum;
      participant_count: number | 'N/A';
      submitted_count: number;
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

    const exams = Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.exam_start_time).getTime() - new Date(a.exam_start_time).getTime(),
    );

    const metrics = await this.loadExamListMetrics(exams);

    return exams.map((exam) => ({
      id: exam.id,
      test_name: exam.test_name,
      subject: exam.test_name || exam.subject,
      test_audience: exam.test_audience,
      duration_minutes: exam.duration_minutes,
      exam_start_time: exam.exam_start_time,
      exam_end_time: exam.exam_end_time,
      class_id: exam.class_id,
      class_name: exam.class?.class_name ?? null,
      created_user_name: exam.created_user_name ?? null,
      status: this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time),
      participant_count: metrics.get(exam.id)!.participant_count,
      submitted_count: metrics.get(exam.id)!.submitted_count,
    }));
  }

  /**
   * Batch participant/submission counts for exam list endpoints (avoids N+1).
   * - anyone: participant_count = "N/A"
   * - selected_class: joined students in class minus excluded for that exam
   * - specific_students: count of target_students rows
   */
  private async loadExamListMetrics(exams: ExamEntity[]): Promise<Map<string, ExamListMetrics>> {
    const out = new Map<string, ExamListMetrics>();
    if (exams.length === 0) {
      return out;
    }

    const examIds = exams.map((e) => e.id);

    const submittedRows = await this.dataSource
      .createQueryBuilder()
      .select('submission.exam_id', 'exam_id')
      .addSelect('COUNT(DISTINCT submission.student_id)', 'cnt')
      .from('student_exam_submissions', 'submission')
      .where('submission.exam_id IN (:...examIds)', { examIds })
      .andWhere('submission.status IN (:...statuses)', {
        statuses: [ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED],
      })
      .groupBy('submission.exam_id')
      .getRawMany<{ exam_id: string; cnt: string }>();

    const submittedByExam = new Map(
      submittedRows.map((r) => [r.exam_id, Number(r.cnt) || 0]),
    );

    const classIds = [
      ...new Set(
        exams
          .filter(
            (e) =>
              e.test_audience === TestAudienceEnum.SELECTED_CLASS && e.class_id != null,
          )
          .map((e) => e.class_id as string),
      ),
    ];

    const joinedByClass = new Map<string, number>();
    if (classIds.length > 0) {
      const joinedRows = await this.classStudentRepo
        .createQueryBuilder('cs')
        .select('cs.class_id', 'class_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('cs.class_id IN (:...classIds)', { classIds })
        .andWhere('cs.status = :status', { status: ClassStudentStatusEnum.JOINED })
        .andWhere('cs.student_id IS NOT NULL')
        .groupBy('cs.class_id')
        .getRawMany<{ class_id: string; cnt: string }>();
      joinedRows.forEach((r) => joinedByClass.set(r.class_id, Number(r.cnt) || 0));
    }

    const excludedRows = await this.dataSource
      .createQueryBuilder()
      .select('ees.exam_id', 'exam_id')
      .addSelect('COUNT(*)', 'cnt')
      .from('exam_excluded_students', 'ees')
      .where('ees.exam_id IN (:...examIds)', { examIds })
      .groupBy('ees.exam_id')
      .getRawMany<{ exam_id: string; cnt: string }>();

    const excludedByExam = new Map(
      excludedRows.map((r) => [r.exam_id, Number(r.cnt) || 0]),
    );

    const specificExamIds = exams
      .filter((e) => e.test_audience === TestAudienceEnum.SPECIFIC_STUDENTS)
      .map((e) => e.id);

    const targetByExam = new Map<string, number>();
    if (specificExamIds.length > 0) {
      const targetRows = await this.dataSource
        .createQueryBuilder()
        .select('ets.exam_id', 'exam_id')
        .addSelect('COUNT(*)', 'cnt')
        .from('exam_target_students', 'ets')
        .where('ets.exam_id IN (:...examIds)', { examIds: specificExamIds })
        .groupBy('ets.exam_id')
        .getRawMany<{ exam_id: string; cnt: string }>();
      targetRows.forEach((r) => targetByExam.set(r.exam_id, Number(r.cnt) || 0));
    }

    for (const exam of exams) {
      const submitted_count = submittedByExam.get(exam.id) ?? 0;
      let participant_count: number | 'N/A' = 'N/A';

      if (exam.test_audience === TestAudienceEnum.ANYONE) {
        participant_count = 'N/A';
      } else if (
        exam.test_audience === TestAudienceEnum.SELECTED_CLASS &&
        exam.class_id
      ) {
        const joined = joinedByClass.get(exam.class_id) ?? 0;
        const excluded = excludedByExam.get(exam.id) ?? 0;
        participant_count = Math.max(0, joined - excluded);
      } else if (exam.test_audience === TestAudienceEnum.SPECIFIC_STUDENTS) {
        participant_count =
          targetByExam.get(exam.id) ?? exam.target_students?.length ?? 0;
      }

      out.set(exam.id, { participant_count, submitted_count });
    }

    return out;
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
   * Minimal public card for unauthenticated GET /v1/exams/:id.
   * Does not expose schedule, questions, class, or student lists.
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

  /**
   * Wizard-shaped response for authenticated teacher/student callers.
   */
  private formatAuthorizedExamResponse(
    exam: ExamEntity,
    opts: {
      audience: 'teacher' | 'student';
      includeCorrectAnswers: boolean;
      includeQuestions?: boolean;
    },
  ): Record<string, unknown> {
    const includeQuestions = opts.includeQuestions !== false;
    const subjects = includeQuestions
      ? this.buildSubjectResponses(exam, opts.includeCorrectAnswers)
      : [];

    const response: Record<string, unknown> = {
      id: exam.id,
      test_name: exam.test_name,
      status: this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time),
      formState: {
        testName: exam.test_name ?? '',
        duration: exam.duration_minutes ?? 0,
        passingScore: exam.passing_score ?? '',
        allowNegativeMarking: exam.is_negative_marking,
        negativeMarking: exam.negative_mark_value ?? '',
        allowScreenShare: exam.allow_screen_share ?? false,
        screenShareDisqualifySeconds: exam.screen_share_disqualify_seconds ?? 15,
      },
      publishState: {
        publishTiming: exam.publish_timing,
        scheduleAt: exam.exam_start_time,
        endingAt: exam.exam_end_time,
        testAudience: exam.test_audience,
        selectedClassId: exam.class_id ?? '',
        ...(opts.audience === 'teacher'
          ? {
              excluded_students: (exam.excluded_students ?? []).map((s) => s.id),
              specificStudents: (exam.target_students ?? []).map((s) => s.id),
            }
          : {}),
      },
      subjects,
      class_id: exam.class_id,
      class_name: exam.class?.class_name ?? null,
    };

    if (opts.audience === 'teacher') {
      response.created_by = exam.created_by;
      response.created_user_name = exam.created_user_name;
      response.created_at = exam.created_at;
      response.updated_at = exam.updated_at;
    }

    return response;
  }

  /** Used by list endpoints and create responses (teacher view). */
  private formatExamResponse(
    exam: ExamEntity,
    opts: { includeCorrectAnswers: boolean; includeQuestions?: boolean } = {
      includeCorrectAnswers: true,
      includeQuestions: true,
    },
  ) {
    return this.formatAuthorizedExamResponse(exam, {
      audience: 'teacher',
      includeCorrectAnswers: opts.includeCorrectAnswers,
      includeQuestions: opts.includeQuestions,
    });
  }

  private buildSubjectResponses(exam: ExamEntity, includeCorrectAnswers: boolean): ExamSubjectResponse[] {
    const sections = [...(exam.questionSections || [])].sort((a, b) => a.sort_order - b.sort_order);

    if (sections.length === 0) {
      const legacyQuestions = [...(exam.questions || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((q) => this.formatQuestionResponse(q, includeCorrectAnswers));

      if (legacyQuestions.length === 0) {
        return [];
      }

      return [
        {
          id: exam.primary_subject?.id ?? null,
          name: exam.primary_subject?.name ?? exam.subject ?? null,
          code: exam.primary_subject?.code ?? null,
          questions: legacyQuestions,
        },
      ];
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
          questions: [],
        });
      }

      const allQuestions = [...(section.questions || [])].sort((a, b) => a.sort_order - b.sort_order);
      const childrenByParent = new Map<string, ExamQuestionEntity[]>();
      for (const q of allQuestions) {
        if (q.parent_id) {
          const list = childrenByParent.get(q.parent_id) ?? [];
          list.push(q);
          childrenByParent.set(q.parent_id, list);
        }
      }

      for (const q of allQuestions) {
        if (q.parent_id) {
          continue;
        }
        grouped.get(key)!.questions.push(
          this.formatQuestionResponse(q, includeCorrectAnswers, childrenByParent),
        );
      }
    }

    return Array.from(grouped.values());
  }

  private formatQuestionResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
    childrenByParent?: Map<string, ExamQuestionEntity[]>,
  ): ExamQuestionResponse {
    if (question.category === QuestionCategoryEnum.PASSAGE && !question.parent_id) {
      const children = (childrenByParent?.get(question.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((child) => this.formatPassageChildResponse(child, includeCorrectAnswers));

      return {
        id: question.id,
        type: QuestionCategoryEnum.PASSAGE,
        passageText: question.passage_text ?? question.question,
        childQuestions: children,
        showValidation: false,
      };
    }

    if (question.category === QuestionCategoryEnum.UNGRADED) {
      const base: ExamQuestionResponse = {
        id: question.id,
        type: QuestionCategoryEnum.UNGRADED,
        subType: question.sub_type,
        text: question.question,
        instruction: question.instruction ?? null,
        image: null,
        points: question.points ?? question.marks_per_question ?? null,
        showValidation: false,
      };
      if (includeCorrectAnswers && question.answer_json) {
        base.answer = question.answer_json;
      }
      return base;
    }

    if (
      question.category === QuestionCategoryEnum.GRADED ||
      (question.category === QuestionCategoryEnum.PASSAGE && question.parent_id)
    ) {
      return this.formatAutoScoredQuestionResponse(question, includeCorrectAnswers);
    }

    return this.formatLegacyQuestionResponse(question, includeCorrectAnswers);
  }

  private formatPassageChildResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
  ): ExamQuestionResponse {
    const base = this.formatAutoScoredQuestionResponse(question, includeCorrectAnswers);
    return {
      ...base,
      type: QuestionCategoryEnum.PASSAGE,
    };
  }

  private formatAutoScoredQuestionResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
  ): ExamQuestionResponse {
    const options = (question.options_json ?? []).map((o) => ({
      id: o.id,
      text: o.text,
      image: null,
    }));

    const base: ExamQuestionResponse = {
      id: question.id,
      type: question.category === QuestionCategoryEnum.PASSAGE
        ? QuestionCategoryEnum.PASSAGE
        : QuestionCategoryEnum.GRADED,
      subType: question.sub_type,
      text: question.question,
      instruction: question.instruction ?? null,
      image: null,
      points: question.points ?? null,
      showValidation: false,
    };

    if (question.sub_type === 'matching-ordering' && question.matching_options_json) {
      base.matchingOptions = {
        left: question.matching_options_json.left.map((o) => ({ ...o, image: null })),
        right: question.matching_options_json.right.map((o) => ({ ...o, image: null })),
      };
    } else if (options.length) {
      base.options = options;
    }

    if (includeCorrectAnswers && question.answer_json) {
      base.answer = question.answer_json;
    }

    return base;
  }

  private formatLegacyQuestionResponse(
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
