import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { FoundationInstrument } from './foundation-instrument.entity';
import { CharterArticle } from './charter-article.entity';

@Entity('charter_sections')
export class CharterSection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'foundation_instrument_id' })
  foundationInstrumentId: number;

  @ManyToOne(
    () => FoundationInstrument,
    (instrument) => instrument.charterSections,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'foundation_instrument_id' })
  foundationInstrument: FoundationInstrument;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @OneToMany(() => CharterArticle, (article) => article.charterSection, {
    cascade: true,
  })
  articles: CharterArticle[];
}
