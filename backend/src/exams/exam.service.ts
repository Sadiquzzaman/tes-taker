import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { ExamEntity, ExamTypeEnum } from './entities/exam.entity';
import { ExamQuestionEntity, QuestionTypeEnum, CorrectAnswerEnum } from './entities/exam-question.entity';
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
import { ExamKindEnum, TestAudienceEnum } from './enums/exam-wizard.enums';

const CORRECT_ENUM_BY_INDEX: CorrectAnswerEnum[] = [
  CorrectAnswerEnum.OPTION_1,
  CorrectAnswerEnum.OPTION_2,
  CorrectAnswerEnum.OPTION_3,
  CorrectAnswerEnum.OPTION_4,
];

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
   * Unified wizard create (mcq | essay | hybrid | model)
   */
  async createFromWizard(
    dto: CreateExamWizardDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<ExamEntity> {
    const { formState, subjects, publishState } = dto;

    if (publishState.scheduleAt >= publishState.endingAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (formState.allowNegativeMarking) {
      const v = formState.negativeMarking;
      if (v === undefined || v === null || Number(v) <= 0) {
        throw new BadRequestException('Negative marking value is required when enabled');
      }
    }

    const subjectIds = subjects.map((s) => s.id);
    await this.subjectService.assertSubjectsExist(subjectIds);

    if (
      formState.examType === ExamKindEnum.MCQ ||
      formState.examType === ExamKindEnum.ESSAY ||
      formState.examType === ExamKindEnum.HYBRID
    ) {
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

    const inviteToken =
      publishState.testAudience === TestAudienceEnum.ANYONE ? randomUUID() : null;

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
        invite_token: inviteToken,
        exam_start_time: publishState.scheduleAt,
        exam_end_time: publishState.endingAt,
        is_negative_marking: formState.allowNegativeMarking,
        negative_mark_value: negativeVal ?? null,
        subject: subjects[0]?.name ?? formState.testName,
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
          const sectionPayload: DeepPartial<ExamQuestionSectionEntity> = {
            exam_id: savedExam.id,
            subject_id: subj.id,
            section_type: sec.type,
            header_text: sec.headerText ?? null,
            sort_order: sectionOrder++,
            created_by: jwtPayload.id,
            created_user_name: jwtPayload.full_name,
            created_at: new Date(),
          };
          const section = sectionRepo.create(sectionPayload);
          const savedSec = await sectionRepo.save(section);

          let qOrder = 0;
          if (sec.type === 'objective') {
            for (const raw of sec.questions) {
              const q = raw as unknown as WizardMcqQuestionDto;
              this.assertMcqQuestion(q);
              const idx = q.options.findIndex((o) => o.id === q.correctOptionId);
              if (idx < 0 || idx > 3) {
                throw new BadRequestException('Each MCQ must reference a valid correctOptionId');
              }
              const objectivePayload: DeepPartial<ExamQuestionEntity> = {
                section_id: savedSec.id,
                exam: { id: savedExam.id } as ExamEntity,
                sort_order: qOrder++,
                question_type: QuestionTypeEnum.OBJECTIVE,
                question: q.text,
                image_url: typeof q.image === 'string' ? q.image : null,
                points: q.points,
                correct_option_index: idx,
                correct_answer: CORRECT_ENUM_BY_INDEX[idx],
                option1: q.options[0].text,
                option2: q.options[1].text,
                option3: q.options[2].text,
                option4: q.options[3].text,
                created_by: jwtPayload.id,
                created_user_name: jwtPayload.full_name,
                created_at: new Date(),
              };
              const row = questionRepo.create(objectivePayload);
              await questionRepo.save(row);
            }
          } else {
            for (const raw of sec.questions) {
              const q = raw as unknown as WizardEssayQuestionDto;
              if (!q.text || q.points === undefined) {
                throw new BadRequestException('Each essay question needs text and points');
              }
              const essayPayload: DeepPartial<ExamQuestionEntity> = {
                section_id: savedSec.id,
                exam: { id: savedExam.id } as ExamEntity,
                sort_order: qOrder++,
                question_type: QuestionTypeEnum.SUBJECTIVE,
                question: q.text,
                image_url: typeof q.image === 'string' ? q.image : null,
                points: q.points,
                marks_per_question: q.points,
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

      return reloaded;
    });
  }

  private validateSectionsForExamType(kind: ExamKindEnum, subjects: CreateExamWizardDto['subjects']): void {
    let objectiveSections = 0;
    let essaySections = 0;
    for (const s of subjects) {
      for (const sec of s.questionSections) {
        if (sec.type === 'objective') objectiveSections++;
        else essaySections++;
      }
    }

    if (kind === ExamKindEnum.MCQ) {
      if (objectiveSections < 1 || essaySections > 0) {
        throw new BadRequestException('MCQ exams must contain only objective sections');
      }
    }
    if (kind === ExamKindEnum.ESSAY) {
      if (essaySections < 1 || objectiveSections > 0) {
        throw new BadRequestException('Essay exams must contain only essay sections');
      }
    }
    if (kind === ExamKindEnum.HYBRID) {
      if (objectiveSections < 1 || essaySections < 1) {
        throw new BadRequestException('Hybrid exams must include at least one objective and one essay section');
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
        if (sec.type === 'objective') hasObjective = true;
        else hasSubjective = true;
      }
    }
    return { hasObjective, hasSubjective };
  }

  private assertMcqQuestion(q: WizardMcqQuestionDto): void {
    if (!q.options || q.options.length !== 4) {
      throw new BadRequestException('Each MCQ must have exactly four options');
    }
    if (!q.text || q.points === undefined) {
      throw new BadRequestException('Each MCQ needs text, options, points, and correctOptionId');
    }
  }

  /**
   * Create an objective exam (legacy)
   */
  async createObjectiveExam(
    dto: CreateObjectiveExamDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<ExamEntity | null> {
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
  ): Promise<ExamEntity | null> {
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

  async findAll(jwtPayload: JwtPayloadInterface): Promise<ExamEntity[]> {
    return this.examRepo.find({
      where: { created_by: jwtPayload.id },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findAllAdmin(): Promise<ExamEntity[]> {
    return this.examRepo.find({
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'class',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findByClass(classId: string, jwtPayload: JwtPayloadInterface): Promise<ExamEntity[]> {
    return this.examRepo.find({
      where: { class_id: classId },
      relations: [
        'questions',
        'questionSections',
        'questionSections.questions',
        'excluded_students',
        'target_students',
        'primary_subject',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<ExamEntity> {
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

  async updateExcludedStudents(
    examId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<ExamEntity> {
    const exam = await this.findOne(examId, jwtPayload);

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
    const exam = await this.findOne(id, jwtPayload);

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
