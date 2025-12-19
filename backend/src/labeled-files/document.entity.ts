import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Group } from '../files/group.entity';
import { LabeledFile } from './labeled-file.entity';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relation to labeled_files (one document has many pages)
  @OneToMany(() => LabeledFile, (file) => file.document)
  pages: LabeledFile[];
}
