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
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ExamKindEnum, PublishTimingEnum, TestAudienceEnum } from '../enums/exam-wizard.enums';

export class WizardOptionDto {
  @ApiProperty({ description: 'Client-generated option id (used to resolve correct answer)' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Option text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @ApiPropertyOptional({ description: 'Reserved for future image support; ignored for now' })
  @IsOptional()
  image?: unknown | null;
}

export class WizardMcqQuestionDto {
  @ApiPropertyOptional({ description: 'Optional client-side identifier' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Question stem' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ description: 'Reserved for future image support; ignored for now' })
  @IsOptional()
  image?: unknown | null;

  @ApiProperty({ type: [WizardOptionDto], minItems: 4, maxItems: 4 })
  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => WizardOptionDto)
  options: WizardOptionDto[];

  @ApiProperty({ description: 'Must match one of options[].id' })
  @IsString()
  @IsNotEmpty()
  correctOptionId: string;

  @ApiProperty({ description: 'Marks for this question', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Client-only validation flag; ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export class WizardEssayQuestionDto {
  @ApiPropertyOptional({ description: 'Optional client-side identifier' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ description: 'Reserved for future image support; ignored for now' })
  @IsOptional()
  image?: unknown | null;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Client-only validation flag; ignored by backend' })
  @IsOptional()
  @IsBoolean()
  showValidation?: boolean;
}

export class WizardQuestionSectionDto {
  @ApiProperty({ enum: ['objective', 'essay', 'mixed'] })
  @IsIn(['objective', 'essay', 'mixed'])
  type: 'objective' | 'essay' | 'mixed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerText?: string;

  @ApiProperty({
    description:
      'MCQ items include options + correctOptionId. Essay items include text + points only. Hybrid/model requests may mix both shapes in the same array.',
    type: 'array',
  })
  @IsArray()
  @ArrayMinSize(1)
  questions: Record<string, unknown>[];
}

export class WizardSubjectBlockDto {
  @ApiProperty({ description: 'Subject UUID from GET /v1/subjects' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ type: [WizardQuestionSectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WizardQuestionSectionDto)
  questionSections: WizardQuestionSectionDto[];
}

export class WizardFormStateDto {
  @ApiProperty({ enum: ExamKindEnum, description: 'Exact values: mcq | essay | hybrid | model' })
  @IsIn(Object.values(ExamKindEnum))
  examType: ExamKindEnum;

  @ApiProperty({ description: 'Title of the test' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  testName: string;

  @ApiProperty({ description: 'Duration in minutes (string or number from UI)', example: '40' })
  @Transform(({ value }) => (value === '' || value === undefined ? NaN : Number(value)))
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ description: 'Minimum score to pass', example: '30' })
  @Transform(({ value }) => (value === '' || value === undefined ? NaN : Number(value)))
  @IsNumber()
  @Min(0)
  passingScore: number;

  @ApiProperty()
  @IsBoolean()
  allowNegativeMarking: boolean;

  @ApiPropertyOptional({
    description:
      'When allowNegativeMarking is true: percentage 1–100. Each wrong MCQ deducts (negativeMarking/100) × that question’s points from the objective total.',
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

  @ApiProperty({ enum: TestAudienceEnum, description: 'anyone | selected_class | specific_students' })
  @IsIn(Object.values(TestAudienceEnum))
  testAudience: TestAudienceEnum;

  @ApiPropertyOptional({ description: 'Required when testAudience is selected_class' })
  @IsOptional()
  @IsUUID('4')
  selectedClassId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Student user UUIDs when testAudience is specific_students. Each array item may contain one UUID or a comma-separated list of UUIDs.',
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
}

@ApiExtraModels(WizardMcqQuestionDto, WizardEssayQuestionDto)
export class CreateExamWizardDto {
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
