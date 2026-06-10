import { ApiProperty, ApiPropertyOptional, ApiExtraModels } from '@nestjs/swagger';
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
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PublishTimingEnum, TestAudienceEnum } from '../enums/exam-wizard.enums';
import {
  AUTO_SCORED_SUB_TYPES,
  MANUAL_SUB_TYPES,
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

  @ApiProperty({ enum: [QuestionCategoryEnum.PASSAGE] })
  @IsIn([QuestionCategoryEnum.PASSAGE])
  type: QuestionCategoryEnum.PASSAGE;

  @ApiProperty({ enum: AUTO_SCORED_SUB_TYPES })
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

export class WizardPassageQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ enum: [QuestionCategoryEnum.PASSAGE] })
  @IsIn([QuestionCategoryEnum.PASSAGE])
  type: QuestionCategoryEnum.PASSAGE;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  passageText: string;

  @ApiProperty({ type: [WizardChildQuestionDto] })
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

  @ApiProperty({ enum: [QuestionCategoryEnum.GRADED] })
  @IsIn([QuestionCategoryEnum.GRADED])
  type: QuestionCategoryEnum.GRADED;

  @ApiProperty({ enum: AUTO_SCORED_SUB_TYPES })
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

  @ApiProperty({ enum: [QuestionCategoryEnum.UNGRADED] })
  @IsIn([QuestionCategoryEnum.UNGRADED])
  type: QuestionCategoryEnum.UNGRADED;

  @ApiProperty({ enum: MANUAL_SUB_TYPES })
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

export class WizardSubjectBlockDto {
  @ApiProperty({ description: 'Subject UUID from GET /v1/subjects' })
  @IsUUID('4')
  id: string;

  @ApiProperty({
    description: 'Flat question list: graded, ungraded, or passage blocks',
    type: 'array',
  })
  @IsArray()
  @ArrayMinSize(1)
  questions: Record<string, unknown>[];
}

export class WizardFormStateDto {
  @ApiProperty({ description: 'Title of the test' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  testName: string;

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
  WizardGradedQuestionDto,
  WizardUngradedQuestionDto,
  WizardPassageQuestionDto,
  WizardChildQuestionDto,
)
export class CreateExamWizardDto {
  @ApiPropertyOptional({ description: 'Ignored by backend' })
  @IsOptional()
  @IsString()
  currentStep?: string;

  @ApiProperty({ type: WizardFormStateDto })
  @ValidateNested()
  @Type(() => WizardFormStateDto)
  formState: WizardFormStateDto;

  @ApiProperty({ type: [WizardSubjectBlockDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardSubjectBlockDto)
  subjects: WizardSubjectBlockDto[];

  @ApiProperty({ type: WizardPublishStateDto })
  @ValidateNested()
  @Type(() => WizardPublishStateDto)
  publishState: WizardPublishStateDto;
}
