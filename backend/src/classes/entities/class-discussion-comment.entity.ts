import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassDiscussionPostEntity } from './class-discussion-post.entity';

@Entity('class_discussion_comments')
@Index(['post_id', 'created_at'])
export class ClassDiscussionCommentEntity extends CustomBaseEntity {
  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  post_id: string;

  @ManyToOne(() => ClassDiscussionPostEntity, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: ClassDiscussionPostEntity;

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  author_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: UserEntity;

  @Column({ name: 'content', type: 'text' })
  content: string;
}
