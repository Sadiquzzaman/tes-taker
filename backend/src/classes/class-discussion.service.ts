import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { In, Repository } from 'typeorm';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { DiscussionComment } from 'src/chat-mongo/schemas/discussion-comment.schema';
import { DiscussionPost } from 'src/chat-mongo/schemas/discussion-post.schema';
import { PrivateConversation } from 'src/chat-mongo/schemas/private-conversation.schema';
import { PrivateMessage } from 'src/chat-mongo/schemas/private-message.schema';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { DiscussionAccessService, PrivateConversationAccess } from './discussion-access.service';
import { CreatePrivateConversationDto } from './dto/create-private-conversation.dto';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from './entities/class-subject-teacher.entity';

type AuthorSummary = { id: string; name: string };

type Timestamped<T> = T & { createdAt?: Date; updatedAt?: Date };

@Injectable()
export class ClassDiscussionService {
  constructor(
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectModel(DiscussionPost.name)
    private readonly postModel: Model<DiscussionPost>,
    @InjectModel(DiscussionComment.name)
    private readonly commentModel: Model<DiscussionComment>,
    @InjectModel(PrivateConversation.name)
    private readonly conversationModel: Model<PrivateConversation>,
    @InjectModel(PrivateMessage.name)
    private readonly messageModel: Model<PrivateMessage>,
    private readonly discussionAccess: DiscussionAccessService,
    private readonly organizationAccess: OrganizationAccessService,
  ) {}

  async listDiscussionSubjects(classId: string, jwt: JwtPayloadInterface) {
    const classEntity = await this.discussionAccess.getClassOrThrow(classId);
    this.discussionAccess.assertWorkspaceAllowsClass(classEntity, jwt);

    const qb = this.classSubjectRepo
      .createQueryBuilder('classSubject')
      .innerJoinAndSelect('classSubject.subject', 'subject')
      .leftJoinAndSelect('classSubject.class', 'classEntity')
      .leftJoinAndSelect('classEntity.teacher', 'classOwner')
      .leftJoinAndSelect(
        'classSubject.teachers',
        'teachers',
        'teachers.is_active = :teacherActive',
        { teacherActive: ActiveStatusEnum.ACTIVE },
      )
      .leftJoinAndSelect('teachers.teacher', 'assignedTeacher')
      .where('classSubject.class_id = :classId', { classId })
      .andWhere('classSubject.is_active = :classSubjectActive', {
        classSubjectActive: ActiveStatusEnum.ACTIVE,
      })
      .orderBy('subject.name', 'ASC');

    if (jwt.role === RolesEnum.STUDENT) {
      await this.discussionAccess.assertJoinedStudent(jwt.id, classId);
    } else if (!classEntity.organization_id) {
      if (classEntity.teacher_id !== jwt.id) {
        return [];
      }
    } else {
      qb.innerJoin(
        ClassSubjectTeacherEntity,
        'cstFilter',
        'cstFilter.class_subject_id = classSubject.id AND cstFilter.teacher_id = :teacherId AND cstFilter.is_active = :cstActive',
        { teacherId: jwt.id, cstActive: ActiveStatusEnum.ACTIVE },
      );
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.mapDiscussionSubject(row));
  }

  async listPosts(
    classId: string,
    classSubjectId: string,
    jwt: JwtPayloadInterface,
    page = 1,
    limit = 20,
  ) {
    const { classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );

    const filter = { classId, classSubjectId, isActive: true };
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Timestamped<DiscussionPost>[]>()
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);
    const commentsCount = await this.countCommentsByPostIds(posts.map((post) => post._id));
    const names = await this.userNames(posts.map((post) => post.authorId));

    return {
      items: posts.map((post) =>
        this.mapPost(post, classSubject, commentsCount.get(post._id) ?? 0, names),
      ),
      meta: this.meta(page, limit, total),
    };
  }

  async createPost(
    classId: string,
    classSubjectId: string,
    jwt: JwtPayloadInterface,
    content: string,
  ) {
    const { classEntity, classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );

    const saved = await this.postModel.create({
      organizationId: classEntity.organization_id,
      classId: classEntity.id,
      classSubjectId: classSubject.id,
      subjectId: classSubject.subject_id,
      authorId: jwt.id,
      authorName: jwt.full_name,
      content,
      isActive: true,
    });

    return this.mapPost(saved.toObject() as Timestamped<DiscussionPost>, classSubject, 0, new Map());
  }

  async getPost(classId: string, classSubjectId: string, postId: string, jwt: JwtPayloadInterface) {
    const { classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    const commentsCount = await this.countCommentsByPostIds([post._id]);
    const names = await this.userNames([post.authorId]);
    return this.mapPost(post, classSubject, commentsCount.get(post._id) ?? 0, names);
  }

  async updatePost(
    classId: string,
    classSubjectId: string,
    postId: string,
    jwt: JwtPayloadInterface,
    content: string,
  ) {
    const { classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    this.assertAuthor(post.authorId, jwt.id);
    const saved = await this.postModel
      .findByIdAndUpdate(post._id, { content }, { new: true })
      .lean<Timestamped<DiscussionPost>>()
      .exec();
    if (!saved) {
      throw new NotFoundException('Discussion post not found');
    }
    const commentsCount = await this.countCommentsByPostIds([saved._id]);
    const names = await this.userNames([saved.authorId]);
    return this.mapPost(saved, classSubject, commentsCount.get(saved._id) ?? 0, names);
  }

  async deletePost(classId: string, classSubjectId: string, postId: string, jwt: JwtPayloadInterface) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    this.assertAuthor(post.authorId, jwt.id);
    await this.postModel.findByIdAndUpdate(post._id, { isActive: false }).exec();
  }

  async listComments(
    classId: string,
    classSubjectId: string,
    postId: string,
    jwt: JwtPayloadInterface,
    page = 1,
    limit = 20,
  ) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    await this.findScopedPost(classId, classSubjectId, postId);

    const filter = { postId, isActive: true };
    const [comments, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Timestamped<DiscussionComment>[]>()
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);
    const names = await this.userNames(comments.map((comment) => comment.authorId));

    return {
      items: comments.map((comment) => this.mapComment(comment, names)),
      meta: this.meta(page, limit, total),
    };
  }

  async createComment(
    classId: string,
    classSubjectId: string,
    postId: string,
    jwt: JwtPayloadInterface,
    content: string,
  ) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    const saved = await this.commentModel.create({
      postId: post._id,
      authorId: jwt.id,
      authorName: jwt.full_name,
      content,
      isActive: true,
    });
    return this.mapComment(saved.toObject() as Timestamped<DiscussionComment>, new Map());
  }

  async updateComment(
    classId: string,
    classSubjectId: string,
    postId: string,
    commentId: string,
    jwt: JwtPayloadInterface,
    content: string,
  ) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    await this.findScopedPost(classId, classSubjectId, postId);
    const comment = await this.findScopedComment(postId, commentId);
    this.assertAuthor(comment.authorId, jwt.id);
    const saved = await this.commentModel
      .findByIdAndUpdate(comment._id, { content }, { new: true })
      .lean<Timestamped<DiscussionComment>>()
      .exec();
    if (!saved) {
      throw new NotFoundException('Comment not found');
    }
    const names = await this.userNames([saved.authorId]);
    return this.mapComment(saved, names);
  }

  async deleteComment(
    classId: string,
    classSubjectId: string,
    postId: string,
    commentId: string,
    jwt: JwtPayloadInterface,
  ) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    await this.findScopedPost(classId, classSubjectId, postId);
    const comment = await this.findScopedComment(postId, commentId);
    this.assertAuthor(comment.authorId, jwt.id);
    await this.commentModel.findByIdAndUpdate(comment._id, { isActive: false }).exec();
  }

  async listConversations(classId: string, classSubjectId: string, jwt: JwtPayloadInterface) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);

    const filter: Record<string, unknown> = {
      classId,
      classSubjectId,
      isActive: true,
    };
    if (jwt.role === RolesEnum.STUDENT) {
      filter.studentId = jwt.id;
    } else {
      filter.teacherId = jwt.id;
    }

    const conversations = await this.conversationModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .lean<Timestamped<PrivateConversation>[]>()
      .exec();
    const names = await this.userNames(
      conversations.flatMap((conversation) => [conversation.studentId, conversation.teacherId]),
    );

    return conversations.map((conversation) => this.mapConversation(conversation, names));
  }

  async createConversation(
    classId: string,
    classSubjectId: string,
    jwt: JwtPayloadInterface,
    dto: CreatePrivateConversationDto,
  ) {
    const { classEntity, classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );

    let studentId: string;
    let teacherId: string;

    if (jwt.role === RolesEnum.STUDENT) {
      if (!dto.teacher_id) {
        throw new BadRequestException('teacher_id is required');
      }
      studentId = jwt.id;
      teacherId = dto.teacher_id;
      await this.assertTeacherCanChat(
        classEntity.organization_id,
        classEntity.teacher_id,
        classSubjectId,
        teacherId,
      );
    } else {
      if (!dto.student_id) {
        throw new BadRequestException('student_id is required');
      }
      teacherId = jwt.id;
      studentId = dto.student_id;
      await this.assertTeacherCanChat(
        classEntity.organization_id,
        classEntity.teacher_id,
        classSubjectId,
        teacherId,
      );
    }

    await this.discussionAccess.assertJoinedStudent(studentId, classId);

    const existing = await this.conversationModel
      .findOne({ classSubjectId, studentId, teacherId })
      .lean<Timestamped<PrivateConversation>>()
      .exec();

    if (existing) {
      if (!existing.isActive) {
        await this.conversationModel
          .findByIdAndUpdate(existing._id, { isActive: true })
          .exec();
        existing.isActive = true;
      }
      const names = await this.userNames([existing.studentId, existing.teacherId]);
      return this.mapConversation(existing, names);
    }

    const saved = await this.conversationModel.create({
      organizationId: classEntity.organization_id,
      classId: classEntity.id,
      classSubjectId,
      subjectId: classSubject.subject_id,
      studentId,
      teacherId,
      isActive: true,
    });
    const names = await this.userNames([studentId, teacherId]);
    return this.mapConversation(saved.toObject() as Timestamped<PrivateConversation>, names);
  }

  async getConversation(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
  ) {
    const loaded = await this.conversationModel
      .findById(conversationId)
      .lean<Timestamped<PrivateConversation>>()
      .exec();
    const { conversation } = await this.discussionAccess.assertCanAccessConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
      this.toConversationAccess(loaded),
    );
    const names = await this.userNames([conversation.studentId, conversation.teacherId]);
    return this.mapConversation(loaded as Timestamped<PrivateConversation>, names);
  }

  async listMessages(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
    page = 1,
    limit = 20,
  ) {
    const loaded = await this.conversationModel
      .findById(conversationId)
      .lean<Timestamped<PrivateConversation>>()
      .exec();
    await this.discussionAccess.assertCanAccessConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
      this.toConversationAccess(loaded),
    );

    const filter = { conversationId, isActive: true };
    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Timestamped<PrivateMessage>[]>()
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);
    const names = await this.userNames(messages.map((message) => message.senderId));

    return {
      items: messages.map((message) => this.mapMessage(message, names)),
      meta: this.meta(page, limit, total),
    };
  }

  async createMessage(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
    content: string,
  ) {
    const loaded = await this.conversationModel
      .findById(conversationId)
      .lean<Timestamped<PrivateConversation>>()
      .exec();
    const { conversation } = await this.discussionAccess.assertCanAccessConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
      this.toConversationAccess(loaded),
    );

    const saved = await this.messageModel.create({
      conversationId: conversation.id,
      senderId: jwt.id,
      senderName: jwt.full_name,
      content,
      isActive: true,
    });
    await this.conversationModel.findByIdAndUpdate(conversation.id, { updatedAt: new Date() }).exec();
    return this.mapMessage(saved.toObject() as Timestamped<PrivateMessage>, new Map());
  }

  private async assertTeacherCanChat(
    organizationId: string | null,
    classOwnerId: string,
    classSubjectId: string,
    teacherId: string,
  ): Promise<void> {
    if (!organizationId) {
      if (teacherId !== classOwnerId) {
        throw new ForbiddenException('Teacher is not assigned to this class subject');
      }
      return;
    }

    const assigned = await this.organizationAccess.isAssignedToClassSubject(teacherId, classSubjectId);
    if (!assigned) {
      throw new ForbiddenException('Teacher is not assigned to this class subject');
    }
  }

  private async findScopedPost(classId: string, classSubjectId: string, postId: string) {
    const post = await this.postModel.findById(postId).lean<Timestamped<DiscussionPost>>().exec();
    if (!post || !post.isActive || post.classId !== classId || post.classSubjectId !== classSubjectId) {
      throw new NotFoundException('Discussion post not found');
    }
    return post;
  }

  private async findScopedComment(postId: string, commentId: string) {
    const comment = await this.commentModel
      .findById(commentId)
      .lean<Timestamped<DiscussionComment>>()
      .exec();
    if (!comment || !comment.isActive || comment.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private toConversationAccess(
    conversation: Timestamped<PrivateConversation> | null,
  ): PrivateConversationAccess | null {
    if (!conversation) {
      return null;
    }
    return {
      id: conversation._id,
      classId: conversation.classId,
      classSubjectId: conversation.classSubjectId,
      studentId: conversation.studentId,
      teacherId: conversation.teacherId,
      isActive: conversation.isActive,
    };
  }

  private assertAuthor(authorId: string, userId: string) {
    if (authorId !== userId) {
      throw new ForbiddenException('Only the author can modify this content');
    }
  }

  private async countCommentsByPostIds(postIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (postIds.length === 0) {
      return counts;
    }

    const rows = await this.commentModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { postId: { $in: postIds }, isActive: true } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ])
      .exec();

    for (const row of rows) {
      counts.set(row._id, row.count);
    }
    return counts;
  }

  private async userNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.userRepo.find({ where: { id: In(unique) } });
    return new Map(users.map((user) => [user.id, user.full_name?.trim() || 'User']));
  }

  private mapDiscussionSubject(row: ClassSubjectEntity) {
    const teachers = (row.teachers || [])
      .filter((assignment) => assignment.is_active === ActiveStatusEnum.ACTIVE)
      .map((assignment) => ({
        id: assignment.teacher_id,
        name: assignment.teacher?.full_name?.trim() || 'Teacher',
      }));

    if (row.class && !row.class.organization_id && row.class.teacher_id) {
      if (!teachers.some((teacher) => teacher.id === row.class.teacher_id)) {
        teachers.unshift({
          id: row.class.teacher_id,
          name: row.class.teacher?.full_name?.trim() || 'Teacher',
        });
      }
    }

    return {
      id: row.id,
      class_subject: {
        id: row.id,
        subject: {
          id: row.subject?.id ?? row.subject_id,
          name: row.subject?.name ?? '',
          code: row.subject?.code ?? null,
        },
      },
      teachers,
    };
  }

  private mapPost(
    post: Timestamped<DiscussionPost>,
    classSubject: ClassSubjectEntity,
    commentsCount: number,
    names: Map<string, string>,
  ) {
    return {
      id: post._id,
      content: post.content,
      created_at: post.createdAt ?? null,
      updated_at: post.updatedAt ?? null,
      comments_count: commentsCount,
      author: this.mapAuthor(post.authorId, names.get(post.authorId) || post.authorName),
      class_subject: {
        id: classSubject.id,
        subject: {
          id: classSubject.subject?.id ?? classSubject.subject_id,
          name: classSubject.subject?.name ?? '',
          code: classSubject.subject?.code ?? null,
        },
      },
    };
  }

  private mapComment(comment: Timestamped<DiscussionComment>, names: Map<string, string>) {
    return {
      id: comment._id,
      content: comment.content,
      created_at: comment.createdAt ?? null,
      updated_at: comment.updatedAt ?? null,
      author: this.mapAuthor(comment.authorId, names.get(comment.authorId) || comment.authorName),
    };
  }

  private mapConversation(conversation: Timestamped<PrivateConversation>, names: Map<string, string>) {
    return {
      id: conversation._id,
      class_subject_id: conversation.classSubjectId,
      created_at: conversation.createdAt ?? null,
      student: this.mapAuthor(conversation.studentId, names.get(conversation.studentId)),
      teacher: this.mapAuthor(conversation.teacherId, names.get(conversation.teacherId)),
    };
  }

  private mapMessage(message: Timestamped<PrivateMessage>, names: Map<string, string>) {
    return {
      id: message._id,
      content: message.content,
      created_at: message.createdAt ?? null,
      sender: this.mapAuthor(message.senderId, names.get(message.senderId) || message.senderName),
    };
  }

  private mapAuthor(id: string, name?: string | null): AuthorSummary {
    return {
      id,
      name: name?.trim() || 'User',
    };
  }

  private meta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    };
  }
}
