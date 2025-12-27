import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from './group.entity';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileNumber: number;

  @Column()
  originalName: string;

  @Column()
  storagePath: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  // Stage 00: Review tracking (for uploaded images)
  @Column({ default: false })
  isReviewed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  // Stage 00: Edited image (after drawing/masking)
  @Column({ type: 'varchar', length: 500, nullable: true })
  editedPath: string | null;

  @Column({ default: false })
  hasEdited: boolean;

  // Stage 01: Upload tracking
  @Column({ default: false })
  processed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  // ⭐ OCR Queue State Tracking (Database-backed Queue)
  @Column({ default: false })
  ocrProcessing: boolean; // กำลัง OCR อยู่ (locked by worker)

  @Column({ type: 'timestamp', nullable: true })
  ocrStartedAt: Date | null; // เวลาที่เริ่ม OCR (detect timeout)

  @Column({ type: 'timestamp', nullable: true })
  ocrCompletedAt: Date | null; // เวลาที่ OCR สำเร็จ

  @Column({ default: 0 })
  ocrFailedCount: number; // จำนวนครั้งที่ OCR fail

  @Column({ type: 'text', nullable: true })
  lastOcrError: string | null; // Error message ล่าสุด

  // Stage 02: Grouping - Foreign Key to groups table
  @Column({ type: 'int', nullable: true })
  groupId: number | null;

  @ManyToOne(() => Group, (group) => group.files, { nullable: true })
  @JoinColumn({ name: 'groupId' })
  group: Group | null;

  @Column({ type: 'int', nullable: true })
  orderInGroup: number | null;

  @Column({ type: 'text', nullable: true })
  ocrText: string | null;

  @Column({ default: false })
  isBookmark: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
