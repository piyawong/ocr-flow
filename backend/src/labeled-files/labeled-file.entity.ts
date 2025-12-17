import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from '../files/group.entity';

export type LabelStatus = 'start' | 'continue' | 'end' | 'single' | 'unmatched';

@Entity('labeled_files')
export class LabeledFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  groupId: number;

  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column()
  orderInGroup: number;

  @Column()
  groupedFileId: number;

  @Column()
  originalName: string;

  @Column()
  storagePath: string;

  @Column({ type: 'text', nullable: true })
  ocrText: string;

  // Label results
  @Column({ nullable: true })
  templateName: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'varchar', default: 'unmatched' })
  labelStatus: LabelStatus;

  @Column({ type: 'text', nullable: true })
  matchReason: string;

  // Document tracking
  @Column({ nullable: true })
  documentId: number; // Which document this page belongs to (auto-increment per group)

  @Column({ nullable: true })
  pageInDocument: number; // Page number within the document

  // User review tracking
  @Column({ type: 'boolean', default: false })
  isUserReviewed: boolean; // Has user reviewed this label?

  @Column({ nullable: true })
  reviewer: string; // Name/ID of the reviewer

  @CreateDateColumn()
  createdAt: Date;
}
