import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CharterSection } from './charter-section.entity';
import { CharterSubItem } from './charter-sub-item.entity';

@Entity('charter_articles')
export class CharterArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'charter_section_id' })
  charterSectionId: number;

  @ManyToOne(() => CharterSection, (section) => section.articles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'charter_section_id' })
  charterSection: CharterSection;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @OneToMany(() => CharterSubItem, (subItem) => subItem.charterArticle, {
    cascade: true,
  })
  subItems: CharterSubItem[];
}
