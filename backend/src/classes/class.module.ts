import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity } from './entities/class-student.entity';
import { ClassTeacherEntity } from './entities/class-teacher.entity';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from './entities/class-subject-teacher.entity';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { StudentClassController } from './student-class.controller';
import { ClassDiscussionController } from './class-discussion.controller';
import { ClassDiscussionService } from './class-discussion.service';
import { DiscussionAccessService } from './discussion-access.service';
import { ClassDiscussionPostEntity } from './entities/class-discussion-post.entity';
import { ClassDiscussionCommentEntity } from './entities/class-discussion-comment.entity';
import { ClassPrivateConversationEntity } from './entities/class-private-conversation.entity';
import { ClassPrivateMessageEntity } from './entities/class-private-message.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { EmailModule } from 'src/email/email.module';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { UserModule } from 'src/user/user.module';
import { ChatMongoModule } from 'src/chat-mongo/chat-mongo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassEntity,
      ClassStudentEntity,
      ClassTeacherEntity,
      ClassSubjectEntity,
      ClassSubjectTeacherEntity,
      // Legacy PostgreSQL discussion tables are left registered so synchronize
      // does not drop them. Runtime discussion I/O uses MongoDB.
      ClassDiscussionPostEntity,
      ClassDiscussionCommentEntity,
      ClassPrivateConversationEntity,
      ClassPrivateMessageEntity,
      UserEntity,
      ExamEntity,
      SubjectEntity,
    ]),
    ChatMongoModule,
    EmailModule,
    OrganizationsModule,
    UserModule,
  ],
  controllers: [ClassController, StudentClassController, ClassDiscussionController],
  providers: [ClassService, ClassDiscussionService, DiscussionAccessService],
  exports: [ClassService],
})
export class ClassModule {}
