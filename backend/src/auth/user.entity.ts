import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// Available permissions for stage access
export enum StagePermission {
  STAGE_03_PDF_LABEL = 'stage_03_pdf_label',
  STAGE_04_EXTRACT = 'stage_04_extract',
  STAGE_05_REVIEW = 'stage_05_review',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  // Permissions for stage access (stored as JSON array)
  @Column({ type: 'simple-array', nullable: true, default: '' })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
