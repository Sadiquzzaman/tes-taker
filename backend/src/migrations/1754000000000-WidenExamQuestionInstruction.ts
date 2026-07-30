import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenExamQuestionInstruction1754000000000 implements MigrationInterface {
  name = 'WidenExamQuestionInstruction1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "instruction" TYPE text
      USING "instruction"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "exam_questions"
      ALTER COLUMN "instruction" TYPE varchar(500)
      USING LEFT("instruction", 500)
    `);
  }
}
