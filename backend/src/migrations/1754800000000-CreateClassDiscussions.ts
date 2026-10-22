import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassDiscussions1754800000000 implements MigrationInterface {
  name = 'CreateClassDiscussions1754800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_discussion_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "class_id" uuid NOT NULL,
        "class_subject_id" uuid NOT NULL,
        "organization_id" uuid,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "PK_class_discussion_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_discussion_posts_class" FOREIGN KEY ("class_id")
          REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_discussion_posts_class_subject" FOREIGN KEY ("class_subject_id")
          REFERENCES "class_subjects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_discussion_posts_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_discussion_posts_author" FOREIGN KEY ("author_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_discussion_posts_class_subject_created"
       ON "class_discussion_posts" ("class_subject_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_discussion_posts_author" ON "class_discussion_posts" ("author_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_discussion_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "post_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "PK_class_discussion_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_discussion_comments_post" FOREIGN KEY ("post_id")
          REFERENCES "class_discussion_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_discussion_comments_author" FOREIGN KEY ("author_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_discussion_comments_post_created"
       ON "class_discussion_comments" ("post_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_private_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "class_id" uuid NOT NULL,
        "class_subject_id" uuid NOT NULL,
        "organization_id" uuid,
        "student_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        CONSTRAINT "PK_class_private_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_class_private_conversations_subject_student_teacher"
          UNIQUE ("class_subject_id", "student_id", "teacher_id"),
        CONSTRAINT "FK_class_private_conversations_class" FOREIGN KEY ("class_id")
          REFERENCES "classes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_private_conversations_class_subject" FOREIGN KEY ("class_subject_id")
          REFERENCES "class_subjects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_private_conversations_organization" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_private_conversations_student" FOREIGN KEY ("student_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_private_conversations_teacher" FOREIGN KEY ("teacher_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_private_conversations_class_subject"
       ON "class_private_conversations" ("class_subject_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "class_private_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_active" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "created_user_name" character varying(100),
        "updated_by" uuid,
        "updated_user_name" character varying(100),
        "created_at" TIMESTAMP,
        "updated_at" TIMESTAMP,
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "PK_class_private_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_class_private_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "class_private_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_class_private_messages_sender" FOREIGN KEY ("sender_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_class_private_messages_conversation_created"
       ON "class_private_messages" ("conversation_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "class_private_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_private_conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_discussion_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "class_discussion_posts"`);
  }
}
