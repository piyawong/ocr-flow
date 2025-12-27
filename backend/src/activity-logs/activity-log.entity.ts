import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Group } from '../files/group.entity';

export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  REVIEWED = 'reviewed',
  REVIEW = 'review',
  APPROVE = 'approve',
  REJECT = 'reject',
  UPLOAD = 'upload',
}

export enum ActivityEntityType {
  FILE = 'file',
  DOCUMENT = 'document',
  FOUNDATION_INSTRUMENT = 'foundation_instrument',
  CHARTER_SECTION = 'charter_section',
  CHARTER_ARTICLE = 'charter_article',
  CHARTER_SUB_ITEM = 'charter_sub_item',
  COMMITTEE_MEMBER = 'committee_member',
  GROUP = 'group',
}

export enum ActivityStage {
  STAGE_00_UPLOAD = '00-upload',
  STAGE_03_PDF_LABEL = '03-pdf-label',
  STAGE_04_EXTRACT = '04-extract',
  STAGE_05_REVIEW = '05-review',
  STAGE_06_UPLOAD = '06-upload',
}

@Entity('activity_logs')
@Index(['userId'])
@Index(['groupId'])
@Index(['stage'])
@Index(['action'])
@Index(['createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  // User who performed the action
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 255 })
  userName: string;

  // Action details
  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({
    type: 'enum',
    enum: ActivityEntityType,
  })
  entityType: ActivityEntityType;

  @Column({ type: 'int', nullable: true })
  entityId: number | null;

  // Group relation (for filtering)
  @Column({ type: 'int', nullable: true })
  groupId: number | null;

  @ManyToOne(() => Group, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group | null;

  // Stage where action occurred
  @Column({
    type: 'enum',
    enum: ActivityStage,
  })
  stage: ActivityStage;

  // Field changes
  @Column({ type: 'varchar', length: 255, nullable: true })
  fieldName: string | null;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  // Description
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
