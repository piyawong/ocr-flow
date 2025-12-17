import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { CharterSection } from './charter-section.entity';

@Entity('foundation_instruments')
export class FoundationInstrument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id', unique: true })
  groupId: number;

  @OneToOne(() => Group, (group) => group.foundationInstrument, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 255, nullable: true })
  shortName: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'logo_description', type: 'text', nullable: true })
  logoDescription: string;

  @OneToMany(() => CharterSection, (section) => section.foundationInstrument, {
    cascade: true,
  })
  charterSections: CharterSection[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
