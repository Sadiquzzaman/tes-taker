import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository, In, IsNull } from 'typeorm';
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
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { generatePublicId } from 'src/common/utils/public-id.util';
import { SmsService } from 'src/sms/sms.service';
import { SubjectService } from 'src/subjects/subject.service';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { SubscriptionService } from 'src/subscriptions/subscription.service';
import { FeatureKey, LimitKey } from 'src/subscriptions/constants/feature-catalog';
import { ExamLifecycleStatusEnum, ExamKindEnum, TestAudienceEnum } from './enums/exam-wizard.enums';
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
import { resolveExamSubjectLabel } from './utils/exam-subject.util';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from './entities/student-exam-answer.entity';
import {
  computeEffectiveDeadline,
  computeRemainingTimeSeconds,
} from './utils/exam-deadline.util';
import { GradingListQueryDto, GradingSummaryQueryDto } from './dto/grade-submission.dto';
import { GradingStatusEnum, SubmissionGradingStatusEnum } from './enums/grading-status.enum';
import {
  computeExamTotalMarks,
  computeGradingStatus,
  computePercentage,
  examHasManualQuestions,
  FINALIZED_SUBMISSION_STATUSES,
  TEACHER_VISIBLE_SUBMISSION_STATUSES,
} from './utils/exam-grading.util';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrgContext } from 'src/organizations/interfaces/org-context.interface';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { ClassService } from 'src/classes/class.service';

type ExamListMetrics = {
  participant_count: number;
  submitted_count: number;
};

type StudentAssignedExamListItem = {
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
  participant_count: number;
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
  private readonly logger = new Logger(ExamService.name);

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

    @InjectRepository(StudentExamSubmissionEntity)
    private readonly submissionRepo: Repository<StudentExamSubmissionEntity>,

    private readonly smsService: SmsService,
    private readonly subjectService: SubjectService,
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionService: SubscriptionService,
    private readonly dataSource: DataSource,
    private readonly organizationAccessService: OrganizationAccessService,
    private readonly classService: ClassService,
  ) {}

  private async assertOrgWizardClassAndSubject(
    jwtPayload: JwtPayloadInterface,
    orgContext: OrgContext,
    publishState: CreateExamWizardDto['publishState'],
    primarySubjectId: string | null,
  ): Promise<void> {
    if (publishState.testAudience !== TestAudienceEnum.SELECTED_CLASS || !publishState.selectedClassId) {
      throw new BadRequestException('Organization tests must be assigned to a selected class');
    }

    const cls = await this.classRepo.findOne({ where: { id: publishState.selectedClassId } });
    if (!cls) {
      throw new BadRequestException('Class not found');
    }
    if (cls.organization_id !== orgContext.organizationId) {
      throw new ForbiddenException('Class does not belong to this organization');
    }

    const canCreateForClass = await this.organizationAccessService.canCreateExam(
      jwtPayload.id,
      orgContext.organizationId,
      cls.id,
    );
    if (!canCreateForClass) {
      throw new ForbiddenException(
        'You can only create exams for organization classes assigned to you',
      );
    }

    if (primarySubjectId) {
      await this.classService.assertTeacherAssignedToClassSubject(
        cls.id,
        jwtPayload.id,
        primarySubjectId,
      );
    }
  }

  /**
   * Unified wizard create (graded / ungraded / passage questions)
   */
  async createFromWizard(
    dto: CreateExamWizardDto,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<any> {
    const { formState, subjects, publishState } = dto;

    if (orgContext?.organizationId) {
      const membership = await this.organizationAccessService.requireApprovedMember(
        orgContext.organizationId,
        jwtPayload.id,
      );
      if (
        membership.role === OrganizationMemberRoleEnum.ASSISTANT ||
        membership.role === OrganizationMemberRoleEnum.STUDENT
      ) {
        throw new ForbiddenException('Your organization role cannot create exams');
      }
    }

    const canCreate = await this.entitlementsService.canCreateExam(jwtPayload.id);
    if (!canCreate.allowed) {
      throw new ForbiddenException(canCreate.reason);
    }

    if (formState.isModelTest) {
      await this.entitlementsService.assertFeature(
        jwtPayload.id,
        FeatureKey.ALLOW_MODEL_TESTS,
        'Model tests are not available on your plan. Please upgrade to Pro.',
      );
    }

    for (const subj of subjects) {
      for (const raw of subj.questions) {
        const parsed = parseWizardQuestion(raw);
        if (parsed.kind === 'ungraded') {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_UNGRADED_QUESTIONS,
            'Ungraded questions are not available on your plan. Please upgrade.',
          );
        }
        if (parsed.kind === 'passage') {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_PASSAGE_QUESTIONS,
            'Passage questions are not available on your plan. Please upgrade.',
          );
        }
        const questionImage = (raw as { image?: unknown }).image;
        if (questionImage) {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_QUESTION_IMAGES,
            'Question images are not available on your plan. Please upgrade.',
          );
        }
      }
    }

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

    this.assertWizardSubjectAndPassingRules(formState, subjects);

    const { hasAutoScored, hasManual } = this.countQuestionCategories(subjects);
    if (!hasAutoScored && !hasManual) {
      throw new BadRequestException('Exam must include at least one question');
    }

    const isModelTest = Boolean(formState.isModelTest);
    const primarySubjectId = isModelTest ? null : subjects[0].id;

    if (orgContext?.organizationId) {
      await this.assertOrgWizardClassAndSubject(
        jwtPayload,
        orgContext,
        publishState,
        primarySubjectId,
      );
    } else if (publishState.testAudience === TestAudienceEnum.SELECTED_CLASS) {
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

    let studentCount = 0;
    if (publishState.testAudience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      studentCount = targetStudents.length;
    } else if (publishState.testAudience === TestAudienceEnum.SELECTED_CLASS && publishState.selectedClassId) {
      const approvedCount = await this.classStudentRepo.count({
        where: {
          class_id: publishState.selectedClassId,
          status: ClassStudentStatusEnum.JOINED,
        },
      });
      studentCount = Math.max(0, approvedCount - excludedStudents.length);
    }

    if (studentCount > 0) {
      const entitlements = await this.entitlementsService.getEntitlements(jwtPayload.id);
      const maxStudents = entitlements.limits[LimitKey.MAX_STUDENTS_PER_EXAM] ?? 0;
      if (maxStudents > 0 && studentCount > maxStudents) {
        throw new ForbiddenException(
          `This exam targets ${studentCount} students, which exceeds your plan limit of ${maxStudents}. Please upgrade.`,
        );
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

      const examPayload: DeepPartial<ExamEntity> = {
        exam_type: examType,
        exam_kind: isModelTest ? ExamKindEnum.MODEL : ExamKindEnum.HYBRID,
        is_model_test: isModelTest,
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
        organization_id: orgContext?.organizationId ?? null,
        public_id: generatePublicId('EXM'),
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

      await this.persistWizardSubjects(
        manager,
        savedExam.id,
        subjects,
        jwtPayload,
        dto.questionOrder,
      );

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
          this.logger.error(`Failed to send exam notifications: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
      if (publishState.testAudience === TestAudienceEnum.SPECIFIC_STUDENTS) {
        this.sendExamNotificationsToTargets(reloaded.id).catch((err) => {
          this.logger.error(`Failed to send exam notifications: ${err instanceof Error ? err.message : String(err)}`);
        });
      }

      await this.subscriptionService.incrementExamCount(jwtPayload.id);

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
        if (parsed.kind === 'graded') {
          hasAutoScored = true;
        } else if (parsed.kind === 'ungraded') {
          hasManual = true;
        } else if (parsed.kind === 'passage') {
          for (const child of parsed.data.childQuestions) {
            if (child.subType === 'essay') {
              hasManual = true;
            } else {
              hasAutoScored = true;
            }
          }
        }
      }
    }

    return { hasAutoScored, hasManual };
  }

  private assertWizardSubjectAndPassingRules(
    formState: CreateExamWizardDto['formState'],
    subjects: CreateExamWizardDto['subjects'],
  ): void {
    const isModelTest = Boolean(formState.isModelTest);

    if (!isModelTest && subjects.length !== 1) {
      throw new BadRequestException('Non-model tests must include exactly one subject');
    }

    if (isModelTest && subjects.length < 1) {
      throw new BadRequestException('Model tests must include at least one subject');
    }

    const totalMarks = subjects.reduce((sum, subject) => {
      return (
        sum +
        subject.questions.reduce((questionSum, raw) => {
          const parsed = parseWizardQuestion(raw);
          if (parsed.kind === 'passage') {
            return (
              questionSum +
              parsed.data.childQuestions.reduce((childSum, child) => childSum + Number(child.points ?? 0), 0)
            );
          }
          return questionSum + Number(parsed.data.points ?? 0);
        }, 0)
      );
    }, 0);

    const passingScore =
      formState.passingScore === undefined || formState.passingScore === null
        ? null
        : Number(formState.passingScore);

    if (passingScore !== null && !Number.isNaN(passingScore) && totalMarks < passingScore) {
      throw new BadRequestException(
        `Total marks (${totalMarks}) cannot be less than the passing score (${passingScore}). Add more questions or reduce the passing score.`,
      );
    }
  }

  private async persistPassageQuestion(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    subjectId: string,
    passage: WizardPassageQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
  ): Promise<number> {
    const parentPayload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(passage.id),
      section_id: sectionId,
      subject_id: subjectId,
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
      if (child.subType === 'essay') {
        await this.persistPassageEssayChild(
          questionRepo,
          examId,
          sectionId,
          subjectId,
          child,
          childOrder++,
          jwtPayload,
          savedParent.id,
        );
      } else {
        await this.persistAutoScoredQuestion(
          questionRepo,
          examId,
          sectionId,
          subjectId,
          child,
          childOrder++,
          jwtPayload,
          QuestionCategoryEnum.PASSAGE,
          savedParent.id,
        );
      }
    }

    return sortOrder + 1;
  }

  private async persistPassageEssayChild(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    subjectId: string,
    q: WizardChildQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
    parentId: string,
  ): Promise<void> {
    const points = normalizePoints(q.points);
    const answerJson = mapAnswerForStorage(q.answer);

    const payload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(q.id),
      section_id: sectionId,
      subject_id: subjectId,
      exam: { id: examId } as ExamEntity,
      sort_order: sortOrder,
      question_type: QuestionTypeEnum.SUBJECTIVE,
      category: QuestionCategoryEnum.PASSAGE,
      sub_type: q.subType,
      parent_id: parentId,
      passage_text: null,
      question: q.text.trim(),
      image_url: null,
      points,
      marks_per_question: points,
      instruction: q.instruction?.trim() ? q.instruction.trim() : null,
      answer_json: answerJson,
      sample_answer: answerJson?.value?.join('\n') ?? undefined,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    };

    const row = questionRepo.create(payload);
    await questionRepo.save(row);
  }

  private async persistAutoScoredQuestion(
    questionRepo: Repository<ExamQuestionEntity>,
    examId: string,
    sectionId: string,
    subjectId: string,
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
      subject_id: subjectId,
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
      instruction: q.instruction?.trim() ? q.instruction.trim() : null,
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
    subjectId: string,
    q: WizardUngradedQuestionDto,
    sortOrder: number,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    const points = normalizePoints(q.points);
    const answerJson = mapAnswerForStorage(q.answer);

    const payload: DeepPartial<ExamQuestionEntity> = {
      id: resolveQuestionId(q.id),
      section_id: sectionId,
      subject_id: subjectId,
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
      instruction: q.instruction?.trim() ? q.instruction.trim() : null,
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
      public_id: generatePublicId('EXM'),
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
        this.logger.error(`Failed to send exam notifications: ${err instanceof Error ? err.message : String(err)}`);
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
      public_id: generatePublicId('EXM'),
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
        this.logger.error(`Failed to send exam notifications: ${err instanceof Error ? err.message : String(err)}`);
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
          this.logger.error(`Failed to send notification to ${student.phone}: ${error instanceof Error ? error.message : String(error)}`);
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  async findAll(
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<any[]> {
    let exams: ExamEntity[];

    if (orgContext?.organizationId) {
      await this.organizationAccessService.requireApprovedMember(
        orgContext.organizationId,
        jwtPayload.id,
      );

      const isOwnerOrAdmin =
        orgContext.memberRole === OrganizationMemberRoleEnum.OWNER ||
        orgContext.memberRole === OrganizationMemberRoleEnum.ADMIN;

      exams = await this.examRepo.find({
        where: isOwnerOrAdmin
          ? { organization_id: orgContext.organizationId }
          : { organization_id: orgContext.organizationId, created_by: jwtPayload.id },
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
    } else {
      exams = await this.examRepo.find({
        where: { created_by: jwtPayload.id, organization_id: IsNull() },
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
    }

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

  async findOne(
    id: string,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<any> {
    const exam = await this.findOneEntity(id);

    if (
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      await this.organizationAccessService.assertCanMonitorExam(
        exam,
        jwtPayload.id,
        orgContext,
      );
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

    const submission = await this.submissionRepo.findOne({
      where: { exam_id: id, student_id: studentId },
    });

    const response = this.formatAuthorizedExamResponse(exam, {
      audience: 'student',
      includeCorrectAnswers: false,
      includeQuestions: examStarted,
    });

    const effectiveDeadline = computeEffectiveDeadline(exam, submission);

    return {
      ...response,
      remaining_time_seconds: computeRemainingTimeSeconds(exam, submission),
      effective_deadline: effectiveDeadline.toISOString(),
      submission_status: submission?.status ?? null,
    };
  }

  private async assertStudentCanViewExam(
    exam: ExamEntity,
    studentId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<void> {
    if (exam.is_active !== ActiveStatusEnum.ACTIVE) {
      throw new ForbiddenException('This exam is not available');
    }

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
  async findAllAssignedForStudent(
    studentId: string,
    jwtPayload?: JwtPayloadInterface,
  ): Promise<StudentAssignedExamListItem[]> {
    const exams = await this.loadAssignedExamsForStudent(studentId, undefined, jwtPayload);
    return await this.mapStudentAssignedExamList(exams);
  }

  /**
   * Tests assigned to the student for a specific class (joined, not excluded).
   */
  async findAssignedForStudentByClass(
    studentId: string,
    classId: string,
    jwtPayload?: JwtPayloadInterface,
  ): Promise<StudentAssignedExamListItem[]> {
    await this.assertStudentJoinedClass(studentId, classId, jwtPayload);
    const exams = await this.loadAssignedExamsForStudent(studentId, classId, jwtPayload);
    return await this.mapStudentAssignedExamList(exams);
  }

  private async assertStudentJoinedClass(
    studentId: string,
    classId: string,
    jwtPayload?: JwtPayloadInterface,
  ): Promise<void> {
    const classEntity = await this.classRepo.findOne({ where: { id: classId } });
    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    this.assertExamMatchesStudentWorkspace(
      {
        organization_id: classEntity.organization_id ?? null,
        class: classEntity,
        created_by: classEntity.teacher_id,
      } as ExamEntity,
      jwtPayload,
    );

    const membership = await this.classStudentRepo.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
        status: ClassStudentStatusEnum.JOINED,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not enrolled in this class');
    }
  }

  private async loadAssignedExamsForStudent(
    studentId: string,
    classId?: string,
    jwtPayload?: JwtPayloadInterface,
  ): Promise<ExamEntity[]> {
    const byId = new Map<string, ExamEntity>();

    const classQuery = this.classRepo
      .createQueryBuilder('class')
      .innerJoin(
        'class.classStudents',
        'classStudent',
        'classStudent.student_id = :studentId AND classStudent.status = :status',
        { studentId, status: ClassStudentStatusEnum.JOINED },
      )
      .select(['class.id']);

    this.applyStudentWorkspaceScopeToClassQuery(classQuery, jwtPayload);

    if (classId) {
      classQuery.andWhere('class.id = :classId', { classId });
    }

    const classes = await classQuery.getMany();
    const classIds = classes.map((c) => c.id);

    if (classIds.length > 0) {
      const classExams = await this.examRepo
        .createQueryBuilder('exam')
        .leftJoinAndSelect('exam.class', 'class')
        .leftJoinAndSelect('exam.primary_subject', 'primary_subject')
        .leftJoinAndSelect('exam.questionSections', 'questionSections')
        .leftJoinAndSelect('questionSections.subject', 'sectionSubject')
        .leftJoin('exam.excluded_students', 'excluded')
        .where('exam.class_id IN (:...classIds)', { classIds })
        .andWhere('exam.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
        .andWhere('(excluded.id IS NULL OR excluded.id != :studentId)', { studentId })
        .orderBy('exam.exam_start_time', 'DESC')
        .getMany();
      classExams.forEach((e) => byId.set(e.id, e));
    }

    if (!classId) {
      let targetQuery = this.examRepo
        .createQueryBuilder('exam')
        .innerJoin('exam.target_students', 'st', 'st.id = :studentId', { studentId })
        .leftJoinAndSelect('exam.class', 'class')
        .leftJoinAndSelect('exam.primary_subject', 'primary_subject')
        .leftJoinAndSelect('exam.questionSections', 'questionSections')
        .leftJoinAndSelect('questionSections.subject', 'sectionSubject')
        .where('exam.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
        .orderBy('exam.exam_start_time', 'DESC');
      this.applyStudentWorkspaceScopeToExamQuery(targetQuery, jwtPayload);
      const targetExams = await targetQuery.getMany();
      targetExams.forEach((e) => byId.set(e.id, e));
    }

    return Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.exam_start_time).getTime() - new Date(a.exam_start_time).getTime(),
    );
  }

  private applyStudentWorkspaceScopeToClassQuery(
    qb: any,
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (jwtPayload?.session_mode === 'organization' && jwtPayload.organization_id) {
      qb.andWhere('class.organization_id = :studentScopeOrgId', {
        studentScopeOrgId: jwtPayload.organization_id,
      });
      return;
    }

    if (jwtPayload?.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      qb.andWhere('class.organization_id IS NULL').andWhere('class.teacher_id = :studentScopeTeacherId', {
        studentScopeTeacherId: jwtPayload.teacher_id,
      });
    }
  }

  private applyStudentWorkspaceScopeToExamQuery(
    qb: any,
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (jwtPayload?.session_mode === 'organization' && jwtPayload.organization_id) {
      qb.andWhere('exam.organization_id = :studentScopeOrgId', {
        studentScopeOrgId: jwtPayload.organization_id,
      });
      return;
    }

    if (jwtPayload?.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      qb.andWhere('exam.organization_id IS NULL').andWhere(
        '(class.teacher_id = :studentScopeTeacherId OR exam.created_by = :studentScopeTeacherId)',
        {
          studentScopeTeacherId: jwtPayload.teacher_id,
        },
      );
    }
  }

  private assertExamMatchesStudentWorkspace(
    exam: Pick<ExamEntity, 'organization_id' | 'created_by'> & { class?: Pick<ClassEntity, 'teacher_id'> | null },
    jwtPayload?: JwtPayloadInterface,
  ): void {
    if (!jwtPayload) {
      return;
    }

    if (jwtPayload.session_mode === 'organization' && jwtPayload.organization_id) {
      if (exam.organization_id !== jwtPayload.organization_id) {
        throw new ForbiddenException('This exam is outside your selected workspace');
      }
      return;
    }

    if (jwtPayload.context_type === 'individual_teacher' && jwtPayload.teacher_id) {
      const teacherId = exam.class?.teacher_id ?? exam.created_by ?? null;
      if (exam.organization_id || teacherId !== jwtPayload.teacher_id) {
        throw new ForbiddenException('This exam is outside your selected workspace');
      }
    }
  }

  private async mapStudentAssignedExamList(
    exams: ExamEntity[],
  ): Promise<StudentAssignedExamListItem[]> {
    const metrics = await this.loadExamListMetrics(exams);

    return exams.map((exam) => ({
      id: exam.id,
      test_name: exam.test_name,
      subject: resolveExamSubjectLabel(exam),
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
   * - anyone: participant_count = 0
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
      let participant_count = 0;

      if (exam.test_audience === TestAudienceEnum.ANYONE) {
        participant_count = 0;
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
      is_active: exam.is_active,
      formState: {
        testName: exam.test_name ?? '',
        duration: exam.duration_minutes ?? 0,
        passingScore: exam.passing_score ?? '',
        allowNegativeMarking: exam.is_negative_marking,
        negativeMarking: exam.negative_mark_value ?? '',
        isModelTest: Boolean(exam.is_model_test),
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

    const allRootQuestions: ExamQuestionEntity[] = [];
    const childrenByParent = new Map<string, ExamQuestionEntity[]>();
    const subjectMetaById = new Map<string, { id: string | null; name: string | null; code: string | null }>();

    for (const section of sections) {
      const sectionSubject = section.subject ?? null;
      if (sectionSubject?.id && !subjectMetaById.has(sectionSubject.id)) {
        subjectMetaById.set(sectionSubject.id, {
          id: sectionSubject.id,
          name: sectionSubject.name ?? null,
          code: sectionSubject.code ?? null,
        });
      }

      for (const q of section.questions || []) {
        if (q.subject_id && q.subject && !subjectMetaById.has(q.subject_id)) {
          subjectMetaById.set(q.subject_id, {
            id: q.subject.id,
            name: q.subject.name ?? null,
            code: q.subject.code ?? null,
          });
        }
        if (q.parent_id) {
          const list = childrenByParent.get(q.parent_id) ?? [];
          list.push(q);
          childrenByParent.set(q.parent_id, list);
        } else {
          allRootQuestions.push(q);
        }
      }
    }

    allRootQuestions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const grouped = new Map<string, ExamSubjectResponse>();
    for (const q of allRootQuestions) {
      const subjectId = q.subject_id ?? q.section?.subject_id ?? exam.primary_subject?.id ?? `legacy:${exam.id}`;
      const meta =
        subjectMetaById.get(subjectId) ??
        (q.section?.subject
          ? {
              id: q.section.subject.id,
              name: q.section.subject.name ?? null,
              code: q.section.subject.code ?? null,
            }
          : {
              id: exam.primary_subject?.id ?? null,
              name: exam.primary_subject?.name ?? exam.subject ?? null,
              code: exam.primary_subject?.code ?? null,
            });

      if (!grouped.has(subjectId)) {
        grouped.set(subjectId, {
          id: meta.id,
          name: meta.name,
          code: meta.code,
          questions: [],
        });
      }

      grouped.get(subjectId)!.questions.push(
        this.formatQuestionResponse(q, includeCorrectAnswers, childrenByParent),
      );
    }

    // Preserve exam-wide order: subjects ordered by first question's sort_order
    return Array.from(grouped.values());
  }

  private formatQuestionResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
    childrenByParent?: Map<string, ExamQuestionEntity[]>,
  ): ExamQuestionResponse {
    const withMeta = (response: ExamQuestionResponse): ExamQuestionResponse => ({
      ...response,
      subjectId: question.subject_id ?? null,
      sortOrder: question.sort_order ?? 0,
    });

    if (question.category === QuestionCategoryEnum.PASSAGE && !question.parent_id) {
      const children = (childrenByParent?.get(question.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((child) => this.formatPassageChildResponse(child, includeCorrectAnswers));

      return withMeta({
        id: question.id,
        type: QuestionCategoryEnum.PASSAGE,
        passageText: question.passage_text ?? question.question,
        childQuestions: children,
        showValidation: false,
      });
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
      return withMeta(base);
    }

    if (
      question.category === QuestionCategoryEnum.GRADED ||
      (question.category === QuestionCategoryEnum.PASSAGE && question.parent_id)
    ) {
      return withMeta(this.formatAutoScoredQuestionResponse(question, includeCorrectAnswers));
    }

    return withMeta(this.formatLegacyQuestionResponse(question, includeCorrectAnswers));
  }

  private formatPassageChildResponse(
    question: ExamQuestionEntity,
    includeCorrectAnswers: boolean,
  ): ExamQuestionResponse {
    if (question.sub_type === 'essay' || question.question_type === QuestionTypeEnum.SUBJECTIVE) {
      const base: ExamQuestionResponse = {
        id: question.id,
        type: QuestionCategoryEnum.PASSAGE,
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

  /**
   * Editing/disabling is only allowed while the exam has not started yet.
   */
  private assertExamEditableBeforeStart(exam: ExamEntity): void {
    if (Date.now() >= new Date(exam.exam_start_time).getTime()) {
      throw new ForbiddenException(
        'This exam has already started; it can no longer be edited or disabled.',
      );
    }
  }

  /**
   * Enable/disable an exam. Disabled exams are hidden from students and cannot be taken.
   * Owner (or admin) only, and only before the exam start time.
   */
  async setExamActive(
    id: string,
    active: boolean,
    jwtPayload: JwtPayloadInterface,
  ): Promise<any> {
    const exam = await this.findOneEntity(id);

    if (
      jwtPayload.role === RolesEnum.TEACHER &&
      exam.created_by !== jwtPayload.id
    ) {
      throw new ForbiddenException('You do not have permission to update this exam');
    }

    this.assertExamEditableBeforeStart(exam);

    exam.is_active = active ? ActiveStatusEnum.ACTIVE : ActiveStatusEnum.INACTIVE;
    exam.updated_by = jwtPayload.id;
    exam.updated_user_name = jwtPayload.full_name;
    exam.updated_at = new Date();
    await this.examRepo.save(exam);

    return this.formatExamResponse(exam, { includeCorrectAnswers: true });
  }

  /**
   * Replace an exam's details and questions via the wizard payload.
   * Owner (or admin) only, and only before the exam start time.
   */
  async updateFromWizard(
    id: string,
    dto: CreateExamWizardDto,
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<any> {
    const { formState, subjects, publishState } = dto;

    const existing = await this.findOneEntity(id);

    if (
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      await this.organizationAccessService.assertCanEditExam(existing, jwtPayload.id);
    }

    if (orgContext?.organizationId) {
      if (existing.organization_id !== orgContext.organizationId) {
        throw new ForbiddenException('Exam does not belong to the current organization context');
      }
    } else if (existing.organization_id) {
      throw new ForbiddenException(
        'This exam belongs to an organization. Provide X-Organization-Id.',
      );
    }

    this.assertExamEditableBeforeStart(existing);

    if (formState.isModelTest) {
      await this.entitlementsService.assertFeature(
        jwtPayload.id,
        FeatureKey.ALLOW_MODEL_TESTS,
        'Model tests are not available on your plan. Please upgrade to Pro.',
      );
    }

    for (const subj of subjects) {
      for (const raw of subj.questions) {
        const parsed = parseWizardQuestion(raw);
        if (parsed.kind === 'ungraded') {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_UNGRADED_QUESTIONS,
            'Ungraded questions are not available on your plan. Please upgrade.',
          );
        }
        if (parsed.kind === 'passage') {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_PASSAGE_QUESTIONS,
            'Passage questions are not available on your plan. Please upgrade.',
          );
        }
        const questionImage = (raw as { image?: unknown }).image;
        if (questionImage) {
          await this.entitlementsService.assertFeature(
            jwtPayload.id,
            FeatureKey.ALLOW_QUESTION_IMAGES,
            'Question images are not available on your plan. Please upgrade.',
          );
        }
      }
    }

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

    this.assertWizardSubjectAndPassingRules(formState, subjects);

    const { hasAutoScored, hasManual } = this.countQuestionCategories(subjects);
    if (!hasAutoScored && !hasManual) {
      throw new BadRequestException('Exam must include at least one question');
    }

    const isModelTest = Boolean(formState.isModelTest);
    const primarySubjectId = isModelTest ? null : subjects[0].id;

    if (orgContext?.organizationId) {
      await this.assertOrgWizardClassAndSubject(
        jwtPayload,
        orgContext,
        publishState,
        primarySubjectId,
      );
    } else if (publishState.testAudience === TestAudienceEnum.SELECTED_CLASS) {
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

    let studentCount = 0;
    if (publishState.testAudience === TestAudienceEnum.SPECIFIC_STUDENTS) {
      studentCount = targetStudents.length;
    } else if (publishState.testAudience === TestAudienceEnum.SELECTED_CLASS && publishState.selectedClassId) {
      const approvedCount = await this.classStudentRepo.count({
        where: {
          class_id: publishState.selectedClassId,
          status: ClassStudentStatusEnum.JOINED,
        },
      });
      studentCount = Math.max(0, approvedCount - excludedStudents.length);
    }

    if (studentCount > 0) {
      const entitlements = await this.entitlementsService.getEntitlements(jwtPayload.id);
      const maxStudents = entitlements.limits[LimitKey.MAX_STUDENTS_PER_EXAM] ?? 0;
      if (maxStudents > 0 && studentCount > maxStudents) {
        throw new ForbiddenException(
          `This exam targets ${studentCount} students, which exceeds your plan limit of ${maxStudents}. Please upgrade.`,
        );
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
      const questionRepo = manager.getRepository(ExamQuestionEntity);
      const sectionRepo = manager.getRepository(ExamQuestionSectionEntity);

      // No submissions exist before the start time, so replacing questions is safe.
      await questionRepo.createQueryBuilder().delete().where('exam_id = :id', { id }).execute();
      await sectionRepo.createQueryBuilder().delete().where('exam_id = :id', { id }).execute();

      const examRow = await examRepo.findOne({
        where: { id },
        relations: ['excluded_students', 'target_students'],
      });
      if (!examRow) throw new NotFoundException('Exam not found');

      examRow.exam_type = examType;
      examRow.exam_kind = isModelTest ? ExamKindEnum.MODEL : ExamKindEnum.HYBRID;
      examRow.is_model_test = isModelTest;
      examRow.test_name = formState.testName.trim();
      examRow.primary_subject_id = primarySubjectId;
      examRow.duration_minutes = formState.duration;
      examRow.passing_score = formState.passingScore ?? null;
      examRow.publish_timing = publishState.publishTiming;
      examRow.test_audience = publishState.testAudience;
      examRow.exam_start_time = publishState.scheduleAt;
      examRow.exam_end_time = publishState.endingAt;
      examRow.is_negative_marking = formState.allowNegativeMarking;
      examRow.negative_mark_value = negativeVal ?? null;
      examRow.subject = examSubjectLabel;
      examRow.class_id =
        publishState.testAudience === TestAudienceEnum.SELECTED_CLASS
          ? publishState.selectedClassId!
          : null;
      examRow.excluded_students = excludedStudents;
      examRow.target_students = targetStudents;
      examRow.updated_by = jwtPayload.id;
      examRow.updated_user_name = jwtPayload.full_name;
      examRow.updated_at = new Date();
      await examRepo.save(examRow);

      await this.persistWizardSubjects(manager, id, subjects, jwtPayload, dto.questionOrder);

      const reloaded = await examRepo.findOne({
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
      if (!reloaded) throw new NotFoundException('Exam not found after update');

      return this.formatExamResponse(reloaded, { includeCorrectAnswers: true });
    });
  }

  /**
   * Create sections + questions for an exam from the wizard subjects payload.
   * Uses exam-wide contiguous sort_order (respecting optional questionOrder).
   */
  private async persistWizardSubjects(
    manager: EntityManager,
    examId: string,
    subjects: CreateExamWizardDto['subjects'],
    jwtPayload: JwtPayloadInterface,
    questionOrder?: string[],
  ): Promise<void> {
    const sectionRepo = manager.getRepository(ExamQuestionSectionEntity);
    const questionRepo = manager.getRepository(ExamQuestionEntity);

    const sectionBySubjectId = new Map<string, ExamQuestionSectionEntity>();
    let sectionOrder = 0;
    for (const subj of subjects) {
      const sectionPayload: DeepPartial<ExamQuestionSectionEntity> = {
        exam_id: examId,
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
      sectionBySubjectId.set(subj.id, savedSec);
    }

    type FlatWizardQuestion = {
      subjectId: string;
      questionId: string;
      raw: CreateExamWizardDto['subjects'][number]['questions'][number];
    };

    const flat: FlatWizardQuestion[] = [];
    for (const subj of subjects) {
      for (const raw of subj.questions) {
        const questionId =
          typeof (raw as { id?: unknown }).id === 'string' ? (raw as { id: string }).id : '';
        flat.push({ subjectId: subj.id, questionId, raw });
      }
    }

    if (questionOrder?.length) {
      const orderMap = new Map(questionOrder.map((id, index) => [id, index]));
      flat.sort((a, b) => {
        const aOrder = orderMap.has(a.questionId) ? orderMap.get(a.questionId)! : Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.has(b.questionId) ? orderMap.get(b.questionId)! : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    }

    let globalOrder = 0;
    for (const item of flat) {
      const savedSec = sectionBySubjectId.get(item.subjectId);
      if (!savedSec) {
        continue;
      }

      const parsed = parseWizardQuestion(item.raw);
      if (parsed.kind === 'passage') {
        globalOrder = await this.persistPassageQuestion(
          questionRepo,
          examId,
          savedSec.id,
          item.subjectId,
          parsed.data,
          globalOrder,
          jwtPayload,
        );
      } else if (parsed.kind === 'graded') {
        await this.persistAutoScoredQuestion(
          questionRepo,
          examId,
          savedSec.id,
          item.subjectId,
          parsed.data,
          globalOrder++,
          jwtPayload,
          QuestionCategoryEnum.GRADED,
          null,
        );
      } else {
        await this.persistUngradedQuestion(
          questionRepo,
          examId,
          savedSec.id,
          item.subjectId,
          parsed.data,
          globalOrder++,
          jwtPayload,
        );
      }
    }
  }

  async updateExcludedStudents(
    examId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
    orgContext?: OrgContext | null,
  ): Promise<any> {
    const exam = await this.findOneEntity(examId);

    if (
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      await this.organizationAccessService.assertCanEditExam(exam, jwtPayload.id);
    }

    const students = await this.userRepo.find({
      where: { id: In(studentIds), role: RolesEnum.STUDENT },
    });

    exam.excluded_students = students;
    await this.examRepo.save(exam);

    return this.findOne(examId, jwtPayload, orgContext);
  }

  async delete(
    id: string,
    jwtPayload: JwtPayloadInterface,
    _orgContext?: OrgContext | null,
  ): Promise<void> {
    const exam = await this.findOneEntity(id);

    if (
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      await this.organizationAccessService.assertCanEditExam(exam, jwtPayload.id);
    }

    await this.examRepo.remove(exam);
  }

  // ========================
  // TEACHER GRADING
  // ========================

  async getGradingList(
    jwtPayload: JwtPayloadInterface,
    query: GradingListQueryDto,
    orgContext?: OrgContext | null,
  ): Promise<{ items: Record<string, unknown>[]; meta: Record<string, number> }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const now = new Date();

    const qb = this.examRepo
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.class', 'class')
      .leftJoinAndSelect('exam.primary_subject', 'primary_subject')
      .leftJoinAndSelect('exam.questionSections', 'questionSections')
      .leftJoinAndSelect('questionSections.questions', 'sectionQuestions')
      .leftJoinAndSelect('exam.questions', 'questions')
      .andWhere('exam.exam_end_time < :now', { now });

    if (orgContext?.organizationId) {
      await this.organizationAccessService.requireApprovedMember(
        orgContext.organizationId,
        jwtPayload.id,
      );
      // Only creator can grade — list only own exams even for OWNER/ADMIN
      qb.andWhere('exam.organization_id = :orgId', { orgId: orgContext.organizationId });
      qb.andWhere('exam.created_by = :teacherId', { teacherId: jwtPayload.id });
    } else {
      qb.andWhere('exam.created_by = :teacherId', { teacherId: jwtPayload.id });
      qb.andWhere('exam.organization_id IS NULL');
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(exam.test_name ILIKE :term OR exam.subject ILIKE :term OR class.class_name ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('exam.exam_end_time', 'DESC');

    const exams = await qb.getMany();
    const metrics = await this.loadExamListMetrics(exams);
    const gradingStats = await this.loadExamGradingStats(exams);

    let items = exams.map((exam) => {
      const hasManualQuestions = examHasManualQuestions(exam);
      const stat = gradingStats.get(exam.id)!;
      const examMetrics = metrics.get(exam.id)!;

      return {
        id: exam.id,
        test_name: exam.test_name,
        subject: resolveExamSubjectLabel(exam),
        class_name: exam.class?.class_name ?? null,
        exam_end_time: exam.exam_end_time,
        lifecycle_status: this.computeExamLifecycleStatus(
          exam.exam_start_time,
          exam.exam_end_time,
        ),
        total_participants: examMetrics.participant_count,
        submitted_count: stat.submitted_count,
        graded_count: stat.graded_count,
        pending_count: stat.pending_count,
        average_percentage: stat.average_percentage,
        has_manual_questions: hasManualQuestions,
        is_result_published: Boolean(exam.result_published_at),
        result_published_at: exam.result_published_at ?? null,
        grading_status: computeGradingStatus(exam, hasManualQuestions, stat.submitted_submissions),
      };
    });

    if (query.status) {
      items = items.filter((item) => item.grading_status === query.status);
    }

    const total = items.length;
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getGradingSummary(
    examId: string,
    jwtPayload: JwtPayloadInterface,
    query: GradingSummaryQueryDto,
  ): Promise<Record<string, unknown>> {
    await this.assertTeacherCanMonitorExam(examId, jwtPayload);

    const exam = await this.findOneEntity(examId);
    const hasManualQuestions = examHasManualQuestions(exam);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));

    const metrics = await this.loadExamListMetrics([exam]);
    const gradingStats = await this.loadExamGradingStats([exam]);
    const stat = gradingStats.get(exam.id)!;
    const examMetrics = metrics.get(exam.id)!;

    const totalStudents =
      examMetrics.participant_count > 0
        ? examMetrics.participant_count
        : stat.submitted_count;

    const submissionsQb = this.submissionRepo
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.student', 'student')
      .where('submission.exam_id = :examId', { examId })
      .andWhere('submission.status IN (:...statuses)', {
        statuses: TEACHER_VISIBLE_SUBMISSION_STATUSES,
      })
      .orderBy('submission.submitted_at', 'DESC');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      submissionsQb.andWhere(
        '(student.full_name ILIKE :term OR student.email ILIKE :term OR student.phone ILIKE :term)',
        { term },
      );
    }

    const [submissions, submissionTotal] = await submissionsQb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const gradingStatus = computeGradingStatus(exam, hasManualQuestions, stat.submitted_submissions);
    const { parseProctoringEvents, summarizeProctoringEvents } = await import(
      './utils/proctoring-events.util'
    );

    return {
      exam: {
        id: exam.id,
        test_name: exam.test_name,
        subject: resolveExamSubjectLabel(exam),
        class_name: exam.class?.class_name ?? null,
        total_marks: computeExamTotalMarks(exam),
        has_manual_questions: hasManualQuestions,
        grading_status: gradingStatus,
        is_result_published: Boolean(exam.result_published_at),
        result_published_at: exam.result_published_at ?? null,
        passing_score: exam.passing_score,
        exam_end_time: exam.exam_end_time,
      },
      stats: {
        total_students: totalStudents,
        submissions: stat.submitted_count,
        not_submitted: Math.max(0, totalStudents - stat.submitted_count),
        graded: stat.graded_count,
        pending: stat.pending_count,
        average_percentage: stat.average_percentage,
      },
      submissions: submissions.map((submission) => {
        const events = parseProctoringEvents(submission.proctoring_events_json);
        const summary = summarizeProctoringEvents(events);
        return {
          submission_id: submission.id,
          student_id: submission.student_id,
          student_name: submission.student?.full_name ?? null,
          email: submission.student?.email ?? null,
          phone: submission.student?.phone ?? null,
          submitted_at: submission.submitted_at ?? null,
          started_at: submission.started_at ?? null,
          status: submission.status,
          total_score: submission.total_score ?? null,
          max_score: submission.max_score ?? null,
          percentage: computePercentage(submission.total_score, submission.max_score),
          is_graded: submission.is_graded,
          grading_status: submission.is_graded
            ? SubmissionGradingStatusEnum.GRADED
            : SubmissionGradingStatusEnum.PENDING,
          browser_switch_count: submission.browser_switch_count ?? 0,
          tab_switch_count: submission.tab_switch_count ?? 0,
          disqualification_reason: submission.disqualification_reason ?? null,
          proctoring_summary: summary,
          proctoring_events: events,
        };
      }),
      meta: {
        page,
        limit,
        total: submissionTotal,
        total_pages: Math.ceil(submissionTotal / limit) || 1,
      },
    };
  }

  async publishResult(
    examId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<Record<string, unknown>> {
    await this.assertTeacherCanMonitorExam(examId, jwtPayload);

    const exam = await this.findOneEntity(examId);

    if (exam.result_published_at) {
      return {
        is_result_published: true,
        result_published_at: exam.result_published_at,
        grading_status: GradingStatusEnum.PUBLISHED,
      };
    }

    const submittedSubmissions = await this.submissionRepo.find({
      where: {
        exam_id: examId,
        status: In(FINALIZED_SUBMISSION_STATUSES),
      },
    });

    const ungraded = submittedSubmissions.filter((submission) => !submission.is_graded);
    if (ungraded.length > 0) {
      throw new BadRequestException('Grade all submissions before publishing.');
    }

    exam.result_published_at = new Date();
    exam.updated_at = new Date();
    exam.updated_by = jwtPayload.id;
    await this.examRepo.save(exam);

    return {
      is_result_published: true,
      result_published_at: exam.result_published_at,
      grading_status: GradingStatusEnum.PUBLISHED,
    };
  }

  private async loadExamGradingStats(exams: ExamEntity[]): Promise<
    Map<
      string,
      {
        submitted_count: number;
        graded_count: number;
        pending_count: number;
        average_percentage: number | null;
        submitted_submissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[];
      }
    >
  > {
    const out = new Map<
      string,
      {
        submitted_count: number;
        graded_count: number;
        pending_count: number;
        average_percentage: number | null;
        submitted_submissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[];
      }
    >();

    if (exams.length === 0) {
      return out;
    }

    const examIds = exams.map((exam) => exam.id);
    const submissions = await this.submissionRepo.find({
      where: {
        exam_id: In(examIds),
        status: In(FINALIZED_SUBMISSION_STATUSES),
      },
      select: ['id', 'exam_id', 'is_graded', 'total_score', 'max_score'],
    });

    const submissionsByExam = new Map<string, StudentExamSubmissionEntity[]>();
    for (const submission of submissions) {
      const existing = submissionsByExam.get(submission.exam_id) ?? [];
      existing.push(submission);
      submissionsByExam.set(submission.exam_id, existing);
    }

    for (const exam of exams) {
      const examSubmissions = submissionsByExam.get(exam.id) ?? [];
      const gradedSubmissions = examSubmissions.filter((submission) => submission.is_graded);
      const gradedWithScores = gradedSubmissions.filter((submission) => Number(submission.max_score) > 0);

      let averagePercentage: number | null = null;
      if (gradedWithScores.length > 0) {
        const totalPercentage = gradedWithScores.reduce((sum, submission) => {
          return sum + (Number(submission.total_score) || 0) / Number(submission.max_score) * 100;
        }, 0);
        averagePercentage = Math.round((totalPercentage / gradedWithScores.length) * 100) / 100;
      }

      out.set(exam.id, {
        submitted_count: examSubmissions.length,
        graded_count: gradedSubmissions.length,
        pending_count: examSubmissions.length - gradedSubmissions.length,
        average_percentage: averagePercentage,
        submitted_submissions: examSubmissions,
      });
    }

    return out;
  }

  /**
   * Full class roster for an exam: every assigned student with status + proctoring summary.
   */
  async getExamClassRoster(
    examId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<Record<string, unknown>> {
    await this.assertTeacherCanMonitorExam(examId, jwtPayload);

    const exam = await this.examRepo.findOne({
      where: { id: examId },
      relations: ['class', 'class.classStudents', 'class.classStudents.student', 'excluded_students'],
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const excludedIds = new Set((exam.excluded_students || []).map((student) => student.id));
    const classStudents = (exam.class?.classStudents || [])
      .map((row) => row.student)
      .filter((student): student is UserEntity => {
        if (!student) {
          return false;
        }
        return !excludedIds.has(student.id);
      });

    const submissions = await this.submissionRepo.find({
      where: { exam_id: examId },
    });
    const byStudent = new Map(submissions.map((submission) => [submission.student_id, submission]));
    const { parseProctoringEvents, summarizeProctoringEvents } = await import(
      './utils/proctoring-events.util'
    );

    const counts = {
      not_started: 0,
      in_progress: 0,
      submitted: 0,
      auto_submitted: 0,
      disqualified: 0,
    };

    const students = classStudents.map((student) => {
      const submission = byStudent.get(student.id);
      const status = submission?.status ?? ExamSubmissionStatusEnum.NOT_STARTED;
      if (status === ExamSubmissionStatusEnum.NOT_STARTED) counts.not_started += 1;
      else if (status === ExamSubmissionStatusEnum.IN_PROGRESS) counts.in_progress += 1;
      else if (status === ExamSubmissionStatusEnum.SUBMITTED) counts.submitted += 1;
      else if (status === ExamSubmissionStatusEnum.AUTO_SUBMITTED) counts.auto_submitted += 1;
      else if (status === ExamSubmissionStatusEnum.DISQUALIFIED) counts.disqualified += 1;

      const events = parseProctoringEvents(submission?.proctoring_events_json);
      const summary = summarizeProctoringEvents(events);
      const durationSeconds =
        submission?.started_at && submission?.submitted_at
          ? Math.max(
              0,
              Math.round(
                (new Date(submission.submitted_at).getTime() - new Date(submission.started_at).getTime()) /
                  1000,
              ),
            )
          : null;

      return {
        student_id: student.id,
        student_name: student.full_name ?? null,
        email: student.email ?? null,
        phone: student.phone ?? null,
        status,
        started_at: submission?.started_at ?? null,
        submitted_at: submission?.submitted_at ?? null,
        duration_seconds: durationSeconds,
        total_score: submission?.total_score ?? null,
        max_score: submission?.max_score ?? null,
        is_graded: submission?.is_graded ?? false,
        browser_switch_count: submission?.browser_switch_count ?? 0,
        tab_switch_count: submission?.tab_switch_count ?? 0,
        disqualification_reason: submission?.disqualification_reason ?? null,
        proctoring_summary: summary,
        proctoring_events: events,
        submission_id: submission?.id ?? null,
      };
    });

    return {
      exam: {
        id: exam.id,
        test_name: exam.test_name,
        class_id: exam.class?.id ?? null,
        class_name: exam.class?.class_name ?? null,
      },
      counts,
      students,
    };
  }
}
