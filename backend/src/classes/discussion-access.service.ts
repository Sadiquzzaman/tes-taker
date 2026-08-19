import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from './entities/class-student.entity';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassPrivateConversationEntity } from './entities/class-private-conversation.entity';

export type ClassSubjectAccessContext = {
  classEntity: ClassEntity;
  classSubject: ClassSubjectEntity;
};

@Injectable()
export class DiscussionAccessService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,
    @InjectRepository(ClassPrivateConversationEntity)
    private readonly conversationRepo: Repository<ClassPrivateConversationEntity>,
    private readonly organizationAccess: OrganizationAccessService,
  ) {}

  async getClassOrThrow(classId: string): Promise<ClassEntity> {
    const classEntity = await this.classRepo.findOne({ where: { id: classId } });
    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }
    return classEntity;
  }

  assertWorkspaceAllowsClass(classEntity: ClassEntity, jwt: JwtPayloadInterface): void {
    if (jwt.session_mode === 'organization' && jwt.organization_id) {
      if (classEntity.organization_id !== jwt.organization_id) {
        throw new ForbiddenException('This class is outside your selected workspace');
      }
      return;
    }

    if (classEntity.organization_id) {
      throw new ForbiddenException('This class is outside your selected workspace');
    }

    if (jwt.context_type === 'individual_teacher' && jwt.teacher_id) {
      if (classEntity.teacher_id !== jwt.teacher_id) {
        throw new ForbiddenException('This class is outside your selected workspace');
      }
    }

    if (jwt.role !== RolesEnum.STUDENT && jwt.id !== classEntity.teacher_id) {
      throw new ForbiddenException('You cannot access discussions for this class');
    }
  }

  async isJoinedStudent(userId: string, classId: string): Promise<boolean> {
    const membership = await this.classStudentRepo.findOne({
      where: {
        class_id: classId,
        student_id: userId,
        status: ClassStudentStatusEnum.JOINED,
        is_active: ActiveStatusEnum.ACTIVE,
      },
    });
    return Boolean(membership);
  }

  async assertJoinedStudent(userId: string, classId: string): Promise<void> {
    if (!(await this.isJoinedStudent(userId, classId))) {
      throw new ForbiddenException('You are not enrolled in this class');
    }
  }

  async canTeachClassSubject(
    jwt: JwtPayloadInterface,
    classEntity: ClassEntity,
    classSubjectId: string,
  ): Promise<boolean> {
    if (jwt.role === RolesEnum.STUDENT) {
      return false;
    }

    if (!classEntity.organization_id) {
      return classEntity.teacher_id === jwt.id;
    }

    return this.organizationAccess.isAssignedToClassSubject(jwt.id, classSubjectId);
  }

  async assertCanAccessClassSubject(
    classId: string,
    classSubjectId: string,
    jwt: JwtPayloadInterface,
  ): Promise<ClassSubjectAccessContext> {
    const classSubject = await this.classSubjectRepo.findOne({
      where: { id: classSubjectId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['subject', 'class'],
    });

    if (!classSubject || classSubject.class_id !== classId) {
      throw new NotFoundException('Class subject not found');
    }

    const classEntity = classSubject.class ?? (await this.getClassOrThrow(classId));
    this.assertWorkspaceAllowsClass(classEntity, jwt);

    if (jwt.role === RolesEnum.STUDENT) {
      await this.assertJoinedStudent(jwt.id, classId);
      return { classEntity, classSubject };
    }

    if (!(await this.canTeachClassSubject(jwt, classEntity, classSubjectId))) {
      throw new ForbiddenException('You are not assigned to this class subject');
    }

    return { classEntity, classSubject };
  }

  async assertCanAccessConversation(
    classId: string,
    classSubjectId: string,
    conversationId: string,
    jwt: JwtPayloadInterface,
  ): Promise<{
    classEntity: ClassEntity;
    classSubject: ClassSubjectEntity;
    conversation: ClassPrivateConversationEntity;
  }> {
    const { classEntity, classSubject } = await this.assertCanAccessClassSubject(
      classId,
      classSubjectId,
      jwt,
    );

    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, is_active: ActiveStatusEnum.ACTIVE },
    });

    if (
      !conversation ||
      conversation.class_id !== classId ||
      conversation.class_subject_id !== classSubjectId
    ) {
      throw new NotFoundException('Conversation not found');
    }

    const isStudentParticipant = conversation.student_id === jwt.id;
    const isTeacherParticipant = conversation.teacher_id === jwt.id;

    if (!isStudentParticipant && !isTeacherParticipant) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (isTeacherParticipant && !(await this.canTeachClassSubject(jwt, classEntity, classSubjectId))) {
      throw new ForbiddenException('You are not assigned to this class subject');
    }

    return { classEntity, classSubject, conversation };
  }
}
