import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { DiscussionAccessService } from './discussion-access.service';
import { CreatePrivateConversationDto } from './dto/create-private-conversation.dto';
import { ClassDiscussionCommentEntity } from './entities/class-discussion-comment.entity';
import { ClassDiscussionPostEntity } from './entities/class-discussion-post.entity';
import { ClassPrivateConversationEntity } from './entities/class-private-conversation.entity';
import { ClassPrivateMessageEntity } from './entities/class-private-message.entity';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from './entities/class-subject-teacher.entity';

type AuthorSummary = { id: string; name: string };

@Injectable()
export class ClassDiscussionService {
  constructor(
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(ClassDiscussionPostEntity)
    private readonly postRepo: Repository<ClassDiscussionPostEntity>,
    @InjectRepository(ClassDiscussionCommentEntity)
    private readonly commentRepo: Repository<ClassDiscussionCommentEntity>,
    @InjectRepository(ClassPrivateConversationEntity)
    private readonly conversationRepo: Repository<ClassPrivateConversationEntity>,
    @InjectRepository(ClassPrivateMessageEntity)
    private readonly messageRepo: Repository<ClassPrivateMessageEntity>,
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

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.class_id = :classId', { classId })
      .andWhere('post.class_subject_id = :classSubjectId', { classSubjectId })
      .andWhere('post.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('post.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();
    const commentsCount = await this.countCommentsByPostIds(posts.map((post) => post.id));

    return {
      items: posts.map((post) => this.mapPost(post, classSubject, commentsCount.get(post.id) ?? 0)),
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

    const post = this.postRepo.create({
      class_id: classEntity.id,
      class_subject_id: classSubject.id,
      organization_id: classEntity.organization_id,
      author_id: jwt.id,
      content,
      is_active: ActiveStatusEnum.ACTIVE,
      created_by: jwt.id,
      created_user_name: jwt.full_name,
      created_at: new Date(),
    });
    const saved = await this.postRepo.save(post);
    saved.author = { id: jwt.id, full_name: jwt.full_name } as ClassDiscussionPostEntity['author'];
    return this.mapPost(saved, classSubject, 0);
  }

  async getPost(classId: string, classSubjectId: string, postId: string, jwt: JwtPayloadInterface) {
    const { classSubject } = await this.discussionAccess.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    const commentsCount = await this.countCommentsByPostIds([post.id]);
    return this.mapPost(post, classSubject, commentsCount.get(post.id) ?? 0);
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
    this.assertAuthor(post.author_id, jwt.id);
    post.content = content;
    post.updated_by = jwt.id;
    post.updated_user_name = jwt.full_name;
    post.updated_at = new Date();
    const saved = await this.postRepo.save(post);
    const commentsCount = await this.countCommentsByPostIds([saved.id]);
    return this.mapPost(saved, classSubject, commentsCount.get(saved.id) ?? 0);
  }

  async deletePost(classId: string, classSubjectId: string, postId: string, jwt: JwtPayloadInterface) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);
    const post = await this.findScopedPost(classId, classSubjectId, postId);
    this.assertAuthor(post.author_id, jwt.id);
    post.is_active = ActiveStatusEnum.INACTIVE;
    post.updated_by = jwt.id;
    post.updated_user_name = jwt.full_name;
    post.updated_at = new Date();
    await this.postRepo.save(post);
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

    const [comments, total] = await this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.post_id = :postId', { postId })
      .andWhere('comment.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('comment.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: comments.map((comment) => this.mapComment(comment)),
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
    const comment = this.commentRepo.create({
      post_id: post.id,
      author_id: jwt.id,
      content,
      is_active: ActiveStatusEnum.ACTIVE,
      created_by: jwt.id,
      created_user_name: jwt.full_name,
      created_at: new Date(),
    });
    const saved = await this.commentRepo.save(comment);
    saved.author = { id: jwt.id, full_name: jwt.full_name } as ClassDiscussionCommentEntity['author'];
    return this.mapComment(saved);
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
    this.assertAuthor(comment.author_id, jwt.id);
    comment.content = content;
    comment.updated_by = jwt.id;
    comment.updated_user_name = jwt.full_name;
    comment.updated_at = new Date();
    const saved = await this.commentRepo.save(comment);
    return this.mapComment(saved);
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
    this.assertAuthor(comment.author_id, jwt.id);
    comment.is_active = ActiveStatusEnum.INACTIVE;
    comment.updated_by = jwt.id;
    comment.updated_user_name = jwt.full_name;
    comment.updated_at = new Date();
    await this.commentRepo.save(comment);
  }

  async listConversations(classId: string, classSubjectId: string, jwt: JwtPayloadInterface) {
    await this.discussionAccess.assertCanAccessClassSubject(classId, classSubjectId, jwt);

    const qb = this.conversationRepo
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.student', 'student')
      .leftJoinAndSelect('conversation.teacher', 'teacher')
      .where('conversation.class_id = :classId', { classId })
      .andWhere('conversation.class_subject_id = :classSubjectId', { classSubjectId })
      .andWhere('conversation.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('conversation.updated_at', 'DESC');

    if (jwt.role === RolesEnum.STUDENT) {
      qb.andWhere('conversation.student_id = :userId', { userId: jwt.id });
    } else {
      qb.andWhere('conversation.teacher_id = :userId', { userId: jwt.id });
    }

    const conversations = await qb.getMany();
    return conversations.map((conversation) => this.mapConversation(conversation));
  }

  async createConversation(
    classId: string,
    classSubjectId: string,
    jwt: JwtPayloadInterface,
    dto: CreatePrivateConversationDto,
  ) {
    const { classEntity } = await this.discussionAccess.assertCanAccessClassSubject(
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
      await this.assertTeacherCanChat(classEntity.organization_id, classEntity.teacher_id, classSubjectId, teacherId);
    } else {
      if (!dto.student_id) {
        throw new BadRequestException('student_id is required');
      }
      teacherId = jwt.id;
      studentId = dto.student_id;
      await this.assertTeacherCanChat(classEntity.organization_id, classEntity.teacher_id, classSubjectId, teacherId);
    }

    await this.discussionAccess.assertJoinedStudent(studentId, classId);

    const existing = await this.conversationRepo.findOne({
      where: {
        class_subject_id: classSubjectId,
        student_id: studentId,
        teacher_id: teacherId,
      },
      relations: ['student', 'teacher'],
    });

    if (existing) {
      if (existing.is_active !== ActiveStatusEnum.ACTIVE) {
        existing.is_active = ActiveStatusEnum.ACTIVE;
        existing.updated_by = jwt.id;
        existing.updated_user_name = jwt.full_name;
        existing.updated_at = new Date();
        await this.conversationRepo.save(existing);
      }
      return this.mapConversation(existing);
    }

    const conversation = this.conversationRepo.create({
      class_id: classEntity.id,
      class_subject_id: classSubjectId,
      organization_id: classEntity.organization_id,
      student_id: studentId,
      teacher_id: teacherId,
      is_active: ActiveStatusEnum.ACTIVE,
      created_by: jwt.id,
      created_user_name: jwt.full_name,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const saved = await this.conversationRepo.save(conversation);
    const loaded = await this.conversationRepo.findOne({
      where: { id: saved.id },
      relations: ['student', 'teacher'],
    });
    return this.mapConversation(loaded ?? saved);
  }

  async getConversation(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
  ) {
    const { conversation } = await this.discussionAccess.assertCanAccessConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
    );
    const loaded = await this.conversationRepo.findOne({
      where: { id: conversation.id },
      relations: ['student', 'teacher'],
    });
    return this.mapConversation(loaded ?? conversation);
  }

  async listMessages(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
    page = 1,
    limit = 20,
  ) {
    await this.discussionAccess.assertCanAccessConversation(classId, classSubjectId, conversationId, jwt);

    const [messages, total] = await this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversation_id = :conversationId', { conversationId })
      .andWhere('message.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('message.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: messages.map((message) => this.mapMessage(message)),
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
    const { conversation } = await this.discussionAccess.assertCanAccessConversation(
      classId,
      classSubjectId,
      conversationId,
      jwt,
    );

    const message = this.messageRepo.create({
      conversation_id: conversation.id,
      sender_id: jwt.id,
      content,
      is_active: ActiveStatusEnum.ACTIVE,
      created_by: jwt.id,
      created_user_name: jwt.full_name,
      created_at: new Date(),
    });
    const saved = await this.messageRepo.save(message);
    conversation.updated_at = new Date();
    conversation.updated_by = jwt.id;
    conversation.updated_user_name = jwt.full_name;
    await this.conversationRepo.save(conversation);
    saved.sender = { id: jwt.id, full_name: jwt.full_name } as ClassPrivateMessageEntity['sender'];
    return this.mapMessage(saved);
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
    const post = await this.postRepo.findOne({
      where: { id: postId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['author'],
    });
    if (!post || post.class_id !== classId || post.class_subject_id !== classSubjectId) {
      throw new NotFoundException('Discussion post not found');
    }
    return post;
  }

  private async findScopedComment(postId: string, commentId: string) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['author'],
    });
    if (!comment || comment.post_id !== postId) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
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

    const rows = await this.commentRepo
      .createQueryBuilder('comment')
      .select('comment.post_id', 'post_id')
      .addSelect('COUNT(comment.id)', 'count')
      .where('comment.post_id IN (:...postIds)', { postIds })
      .andWhere('comment.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .groupBy('comment.post_id')
      .getRawMany<{ post_id: string; count: string }>();

    for (const row of rows) {
      counts.set(row.post_id, Number(row.count));
    }
    return counts;
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

  private mapPost(post: ClassDiscussionPostEntity, classSubject: ClassSubjectEntity, commentsCount: number) {
    return {
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      updated_at: post.updated_at ?? null,
      comments_count: commentsCount,
      author: this.mapAuthor(post.author, post.author_id, post.created_user_name),
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

  private mapComment(comment: ClassDiscussionCommentEntity) {
    return {
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at ?? null,
      author: this.mapAuthor(comment.author, comment.author_id, comment.created_user_name),
    };
  }

  private mapConversation(conversation: ClassPrivateConversationEntity) {
    return {
      id: conversation.id,
      class_subject_id: conversation.class_subject_id,
      created_at: conversation.created_at,
      student: this.mapAuthor(conversation.student, conversation.student_id),
      teacher: this.mapAuthor(conversation.teacher, conversation.teacher_id),
    };
  }

  private mapMessage(message: ClassPrivateMessageEntity) {
    return {
      id: message.id,
      content: message.content,
      created_at: message.created_at,
      sender: this.mapAuthor(message.sender, message.sender_id, message.created_user_name),
    };
  }

  private mapAuthor(
    user: { id?: string; full_name?: string | null } | null | undefined,
    fallbackId: string,
    fallbackName?: string | null,
  ): AuthorSummary {
    return {
      id: user?.id ?? fallbackId,
      name: user?.full_name?.trim() || fallbackName?.trim() || 'User',
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
