import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CharterArticle } from './charter-article.entity';

@Entity('charter_sub_items')
export class CharterSubItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'charter_article_id' })
  charterArticleId: number;

  @ManyToOne(() => CharterArticle, (article) => article.subItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'charter_article_id' })
  charterArticle: CharterArticle;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;
}
