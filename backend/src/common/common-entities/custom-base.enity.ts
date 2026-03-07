import { BaseEntity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { ActiveStatusEnum } from '../enums/active-status.enum';

export class CustomBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column({
    type: 'enum',
    name: 'is_active',
    enum: ActiveStatusEnum,
    default: `${ActiveStatusEnum.ACTIVE}`,
  })
  is_active: ActiveStatusEnum;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', name: 'created_user_name', length: 100,nullable:true })
  created_user_name: string;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updated_by: string | null;

  @Column({ type: 'varchar', name: 'updated_user_name', length: 100,nullable:true })
  updated_user_name: string;

  @Column({
    name: 'created_at',
    nullable: true,
  })
  created_at: Date;

  @Column({
    name: 'updated_at',
    nullable: true,
  })
  updated_at: Date;
}
