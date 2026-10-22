import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from './class.entity';
import { ClassSubjectEntity } from './class-subject.entity';
import { ClassDiscussionCommentEntity } from './class-discussion-comment.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

@Entity('class_discussion_posts')
@Index(['class_subject_id', 'created_at'])
export class ClassDiscussionPostEntity extends CustomBaseEntity {
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
  @Column({ name: 'author_id', type: 'uuid' })
  author_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @OneToMany(() => ClassDiscussionCommentEntity, (comment) => comment.post)
  comments: ClassDiscussionCommentEntity[];
}
