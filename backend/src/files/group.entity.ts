import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { File } from './file.entity';
import { FoundationInstrument } from './foundation-instrument.entity';
import { CommitteeMember } from './committee-member.entity';
import { User } from '../auth/user.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  isComplete: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ default: false })
  isAutoLabeled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  labeledAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  labeledReviewer: string | null;

  @Column({ type: 'int', nullable: true })
  labeledReviewerId: number | null; // User ID who reviewed labels (Stage 03)

  @Column({ type: 'text', nullable: true })
  labeledNotes: string | null;

  @Column({ default: false })
  isLabeledReviewed: boolean;

  @Column({ default: false })
  isParseData: boolean;

  @Column({ type: 'timestamp', nullable: true })
  parseDataAt: Date | null;

  @Column({ default: false })
  isParseDataReviewed: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  parseDataReviewer: string | null;

  @Column({ type: 'text', nullable: true })
  extractDataNotes: string | null;

  // Stage 05: Final Review & Approval
  @Column({ default: false })
  isFinalApproved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  finalApprovedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  finalReviewer: string | null;

  @Column({ type: 'text', nullable: true })
  finalReviewNotes: string | null;

  // District office registration info
  @Column({ type: 'text', nullable: true })
  districtOffice: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  // Group locking for concurrent editing prevention
  @Column({ type: 'int', nullable: true })
  lockedBy: number | null; // User ID who locked this group

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null; // When the group was locked

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lockedBy' })
  lockedByUser: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relation to files
  @OneToMany(() => File, (file) => file.group)
  files: File[];

  // Relation to foundation instrument (one-to-one)
  @OneToOne(
    () => FoundationInstrument,
    (instrument) => instrument.group,
    { cascade: true },
  )
  foundationInstrument: FoundationInstrument;

  // Relation to committee members (one-to-many)
  @OneToMany(() => CommitteeMember, (member) => member.group, { cascade: true })
  committeeMembers: CommitteeMember[];
}
