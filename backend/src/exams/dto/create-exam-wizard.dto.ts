import { ApiProperty, ApiPropertyOptional, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PublishTimingEnum, TestAudienceEnum } from '../enums/exam-wizard.enums';
import { ExamCategoryEnum } from '../enums/exam-category.enum';
import {
  AUTO_SCORED_SUB_TYPES,
  IELTS_AUTO_SUB_TYPES,
  IELTS_MANUAL_SUB_TYPES,
  MANUAL_SUB_TYPES,
  PASSAGE_CHILD_SUB_TYPES,
  QuestionCategoryEnum,
} from '../enums/question.enums';

export class WizardOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;
}

export class WizardMatchingSideOptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;
}

export class WizardMatchingOptionsDto {
  @ApiProperty({ type: [WizardMatchingSideOptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardMatchingSideOptionDto)
  left: WizardMatchingSideOptionDto[];

  @ApiProperty({ type: [WizardMatchingSideOptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardMatchingSideOptionDto)
  right: WizardMatchingSideOptionDto[];
}

export class WizardAnswerDto {
  @ApiProperty({ enum: ['optionId', 'matchingOrdering', 'text'] })
  @IsIn(['optionId', 'matchingOrdering', 'text'])
  type: 'optionId' | 'matchingOrdering' | 'text';

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  value: string[];
}

export class WizardChildQuestionDto {
  @ApiPropertyOptional({ description: 'Client-side id; persisted when valid UUID' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    enum: QuestionCategoryEnum,
    example: QuestionCategoryEnum.PASSAGE,
  })
  @IsIn([QuestionCategoryEnum.PASSAGE])
  type: QuestionCategoryEnum.PASSAGE;

  @ApiProperty({
    enum: [...PASSAGE_CHILD_SUB_TYPES],
    example: 'multiple-choice',
    description: 'Auto-scored subtypes or essay (for Passage / CQ creative questions)',
  })
  @IsIn([...PASSAGE_CHILD_SUB_TYPES])
  subType: (typeof PASSAGE_CHILD_SUB_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;

  @ApiPropertyOptional({ description: 'Audio URL for listening stems' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;

  @ApiPropertyOptional({ description: 'Per-question / task time limit (seconds)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeLimitSeconds?: number | null;

  @ApiPropertyOptional({ description: 'Extensible media metadata (cue card, timestamps, etc.)' })
  @IsOptional()
  mediaMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [WizardOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardOptionDto)
  options?: WizardOptionDto[];

  @ApiPropertyOptional({ type: WizardMatchingOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardMatchingOptionsDto)
  matchingOptions?: WizardMatchingOptionsDto;

  @ApiPropertyOptional({
    type: WizardAnswerDto,
    description: 'Required for auto-scored children; optional sample answer for essay',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardAnswerDto)
  answer?: WizardAnswerDto;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export class WizardPassageQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    enum: QuestionCategoryEnum,
    example: QuestionCategoryEnum.PASSAGE,
    description: 'Passage block — use passageText + childQuestions (not text/options on the parent)',
  })
  @IsIn([QuestionCategoryEnum.PASSAGE])
  type: QuestionCategoryEnum.PASSAGE;

  @ApiProperty({
    example:
      'This is a passage. This is a passage. This is a passage.',
  })
  @IsString()
  @IsNotEmpty()
  passageText: string;

  @ApiPropertyOptional({ description: 'Optional passage title (IELTS Reading)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string | null;

  @ApiPropertyOptional({ description: 'Optional passage instructions' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string | null;

  @ApiPropertyOptional({ description: 'Optional passage image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Optional audio URL (Listening)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;

  @ApiProperty({
    type: [WizardChildQuestionDto],
    description: 'Questions based on the passage (auto-scored and/or essay for CQ)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardChildQuestionDto)
  childQuestions: WizardChildQuestionDto[];

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export class WizardGradedQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    enum: QuestionCategoryEnum,
    example: QuestionCategoryEnum.GRADED,
  })
  @IsIn([QuestionCategoryEnum.GRADED])
  type: QuestionCategoryEnum.GRADED;

  @ApiProperty({
    enum: [...AUTO_SCORED_SUB_TYPES],
    example: 'multiple-choice',
  })
  @IsIn([...AUTO_SCORED_SUB_TYPES])
  subType: (typeof AUTO_SCORED_SUB_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;

  @ApiPropertyOptional({ description: 'Audio URL for listening stems' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;

  @ApiPropertyOptional({ description: 'Per-question / task time limit (seconds)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeLimitSeconds?: number | null;

  @ApiPropertyOptional({ description: 'Extensible media metadata' })
  @IsOptional()
  mediaMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [WizardOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardOptionDto)
  options?: WizardOptionDto[];

  @ApiPropertyOptional({ type: WizardMatchingOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardMatchingOptionsDto)
  matchingOptions?: WizardMatchingOptionsDto;

  @ApiProperty({ type: WizardAnswerDto })
  @ValidateNested()
  @Type(() => WizardAnswerDto)
  answer: WizardAnswerDto;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export class WizardUngradedQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    enum: QuestionCategoryEnum,
    example: QuestionCategoryEnum.UNGRADED,
  })
  @IsIn([QuestionCategoryEnum.UNGRADED])
  type: QuestionCategoryEnum.UNGRADED;

  @ApiProperty({
    enum: [...MANUAL_SUB_TYPES],
    example: 'essay',
  })
  @IsIn([...MANUAL_SUB_TYPES])
  subType: (typeof MANUAL_SUB_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;

  @ApiPropertyOptional({ description: 'Audio URL (speaking cue / listening)' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;

  @ApiPropertyOptional({ description: 'Per-question / task time limit (seconds)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeLimitSeconds?: number | null;

  @ApiPropertyOptional({ description: 'Suggested word limit (writing tasks)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  wordLimit?: number | null;

  @ApiPropertyOptional({ description: 'Extensible media metadata (cue card, etc.)' })
  @IsOptional()
  mediaMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: WizardAnswerDto, description: 'Sample answers for manual grading' })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardAnswerDto)
  answer?: WizardAnswerDto;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

/** Flat IELTS builder questions (auto-scored or writing/speaking tasks). */
export class WizardIeltsQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({
    enum: QuestionCategoryEnum,
    example: QuestionCategoryEnum.IELTS,
  })
  @IsIn([QuestionCategoryEnum.IELTS])
  type: QuestionCategoryEnum.IELTS;

  @ApiProperty({
    enum: [...IELTS_AUTO_SUB_TYPES, ...IELTS_MANUAL_SUB_TYPES],
    example: 'multiple-choice',
  })
  @IsIn([...IELTS_AUTO_SUB_TYPES, ...IELTS_MANUAL_SUB_TYPES])
  subType: (typeof IELTS_AUTO_SUB_TYPES)[number] | (typeof IELTS_MANUAL_SUB_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;

  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  image?: unknown | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timeLimitSeconds?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  wordLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  mediaMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: [WizardOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardOptionDto)
  options?: WizardOptionDto[];

  @ApiPropertyOptional({ type: WizardMatchingOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardMatchingOptionsDto)
  matchingOptions?: WizardMatchingOptionsDto;

  @ApiPropertyOptional({ type: WizardAnswerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WizardAnswerDto)
  answer?: WizardAnswerDto;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export type WizardQuestionDto =
  | WizardGradedQuestionDto
  | WizardUngradedQuestionDto
  | WizardPassageQuestionDto
  | WizardIeltsQuestionDto;

export class WizardSubjectBlockDto {
  @ApiProperty({
    description:
      'Subject UUID (Academic) or namespaced module key (IELTS, e.g. ielts.reading). When moduleKey is set, this should match moduleKey.',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({
    description: 'Namespaced module key for non-academic categories (e.g. ielts.reading)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Display name for the subject/module block' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({
    description:
      'Flat question list. Each item is graded, ungraded, passage, or IELTS (see Schemas below).',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(WizardGradedQuestionDto) },
        { $ref: getSchemaPath(WizardUngradedQuestionDto) },
        { $ref: getSchemaPath(WizardPassageQuestionDto) },
        { $ref: getSchemaPath(WizardIeltsQuestionDto) },
      ],
    },
  })
  @IsArray()
  @ArrayMinSize(1)
  questions: WizardQuestionDto[];
}

export class WizardFormStateDto {
  @ApiProperty({ description: 'Title of the test' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  testName: string;

  @ApiPropertyOptional({
    enum: ExamCategoryEnum,
    description: 'Exam product category (defaults to academic for backwards compatibility)',
    default: ExamCategoryEnum.ACADEMIC,
  })
  @IsOptional()
  @IsIn(Object.values(ExamCategoryEnum))
  examCategory?: ExamCategoryEnum;

  @ApiProperty({ description: 'Duration in minutes', example: '40' })
  @Transform(({ value }) => (value === '' || value === undefined ? NaN : Number(value)))
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiPropertyOptional({ description: 'Minimum score to pass', example: '30' })
  @Transform(({ value }) =>
    value === '' || value === undefined || value === null ? undefined : Number(value),
  )
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiProperty({ description: 'Whether this is a multi-subject model test' })
  @IsBoolean()
  isModelTest: boolean;

  @ApiProperty()
  @IsBoolean()
  allowNegativeMarking: boolean;

  @ApiPropertyOptional({
    description: 'Percentage 1–100 when negative marking is enabled',
    example: 25,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? undefined : Number(value),
  )
  @IsNumber()
  @Min(0)
  @Max(100)
  negativeMarking?: number;
}

export class WizardPublishStateDto {
  @ApiProperty({ enum: PublishTimingEnum })
  @IsIn(Object.values(PublishTimingEnum))
  publishTiming: PublishTimingEnum;

  @ApiProperty({ description: 'ISO start when exam becomes available' })
  @IsNotEmpty()
  @Type(() => Date)
  scheduleAt: Date;

  @ApiProperty({ description: 'ISO hard end' })
  @IsNotEmpty()
  @Type(() => Date)
  endingAt: Date;

  @ApiProperty({ enum: TestAudienceEnum })
  @IsIn(Object.values(TestAudienceEnum))
  testAudience: TestAudienceEnum;

  @ApiPropertyOptional({ description: 'Required when testAudience is selected_class' })
  @IsOptional()
  @IsUUID('4')
  selectedClassId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Student UUIDs when testAudience is specific_students',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    const rawItems = Array.isArray(value) ? value : [value];
    const normalized = rawItems
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return [...new Set(normalized)];
  })
  @IsArray()
  @IsUUID('4', { each: true })
  specificStudents?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Students excluded when audience is selected_class',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    const rawItems = Array.isArray(value) ? value : [value];
    return rawItems
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  })
  @IsArray()
  @IsUUID('4', { each: true })
  excluded_students?: string[];
}

@ApiExtraModels(
  WizardOptionDto,
  WizardMatchingSideOptionDto,
  WizardMatchingOptionsDto,
  WizardAnswerDto,
  WizardChildQuestionDto,
  WizardPassageQuestionDto,
  WizardGradedQuestionDto,
  WizardUngradedQuestionDto,
  WizardIeltsQuestionDto,
  WizardSubjectBlockDto,
  WizardFormStateDto,
  WizardPublishStateDto,
)
export class CreateExamWizardDto {
  @ApiPropertyOptional({ description: 'Ignored by backend — builder UI step name' })
  @IsOptional()
  @IsString()
  currentStep?: string;

  @ApiProperty({ type: WizardFormStateDto })
  @ValidateNested()
  @Type(() => WizardFormStateDto)
  formState: WizardFormStateDto;

  @ApiProperty({
    type: [WizardSubjectBlockDto],
    description: 'One or more subject blocks, each with a flat questions array',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardSubjectBlockDto)
  subjects: WizardSubjectBlockDto[];

  @ApiPropertyOptional({
    description: 'Optional exam-wide root question order (overrides subject-array order for sort_order)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionOrder?: string[];

  @ApiProperty({ type: WizardPublishStateDto })
  @ValidateNested()
  @Type(() => WizardPublishStateDto)
  publishState: WizardPublishStateDto;
}
