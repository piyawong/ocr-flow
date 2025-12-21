import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from '../files/group.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  groupId: number;

  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column()
  documentNumber: number; // Auto-increment per group (1, 2, 3, ...)

  @Column({ nullable: true })
  templateName: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'date', nullable: true })
  documentDate: Date | null; // วันที่ของเอกสาร (optional)

  @Column({ default: 0 })
  pageCount: number; // จำนวนหน้าทั้งหมดของ document นี้

  @Column({ nullable: true })
  startPage: number; // หน้าแรกของ document (orderInGroup)

  @Column({ nullable: true })
  endPage: number; // หน้าสุดท้ายของ document (orderInGroup)

  // Review tracking
  @Column({ type: 'boolean', default: false })
  isUserReviewed: boolean; // User reviewed this document?

  @Column({ nullable: true })
  reviewer: string; // Name of the reviewer

  @Column({ type: 'text', nullable: true })
  reviewNotes: string; // Review notes for this document

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // NOTE: pages are computed dynamically from files table using startPage/endPage
}
