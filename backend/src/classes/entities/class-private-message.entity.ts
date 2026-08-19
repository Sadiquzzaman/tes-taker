import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassPrivateConversationEntity } from './class-private-conversation.entity';

@Entity('class_private_messages')
@Index(['conversation_id', 'created_at'])
export class ClassPrivateMessageEntity extends CustomBaseEntity {
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => ClassPrivateConversationEntity, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ClassPrivateConversationEntity;

  @Index()
  @Column({ name: 'sender_id', type: 'uuid' })
  sender_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: UserEntity;

  @Column({ name: 'content', type: 'text' })
  content: string;
}
