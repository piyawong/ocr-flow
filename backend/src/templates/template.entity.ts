import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  firstPagePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  lastPagePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  firstPageNegativePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  lastPageNegativePatterns: string[][] | null;

  @Column({ nullable: true })
  category: string | null;

  @Column({ default: false })
  isSinglePage: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  contextRules: {
    requirePreviousCategory?: string;
    blockPreviousCategory?: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
