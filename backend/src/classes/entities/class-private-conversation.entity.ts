import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from './class.entity';
import { ClassSubjectEntity } from './class-subject.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { ClassPrivateMessageEntity } from './class-private-message.entity';

@Entity('class_private_conversations')
@Unique(['class_subject_id', 'student_id', 'teacher_id'])
export class ClassPrivateConversationEntity extends CustomBaseEntity {
  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @Index()
  @Column({ name: 'class_subject_id', type: 'uuid' })
  class_subject_id: string;

  @ManyToOne(() => ClassSubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject: ClassSubjectEntity;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity | null;

  @Index()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity;

  @Index()
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @OneToMany(() => ClassPrivateMessageEntity, (message) => message.conversation)
  messages: ClassPrivateMessageEntity[];
}
