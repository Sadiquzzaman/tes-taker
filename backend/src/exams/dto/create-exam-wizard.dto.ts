import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @ApiPropertyOptional({ description: 'Reserved for future image support' })
  @IsOptional()
  @IsString()
  image?: string | null;
}

export class WizardMcqQuestionDto {
  @ApiProperty({ description: 'Client question id' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Question stem' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  image?: string | null;

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
}

export class WizardEssayQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  image?: string | null;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  points: number;
}

export class WizardQuestionSectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ enum: ['objective', 'essay'] })
  @IsIn(['objective', 'essay'])
  type: 'objective' | 'essay';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerText?: string;

  @ApiProperty({
    description:
      'When type is objective: items shaped as WizardMcqQuestionDto. When essay: WizardEssayQuestionDto. Validated in service.',
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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

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

  @ApiPropertyOptional({ description: 'Penalty per wrong MCQ (flat). Example 0.25' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === undefined ? undefined : Number(value),
  )
  @IsNumber()
  @Min(0)
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
    description: 'Student user UUIDs when testAudience is specific_students',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  specificStudents?: string[];
}

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
