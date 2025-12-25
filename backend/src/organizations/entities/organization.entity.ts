import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Group } from '../../files/group.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  districtOfficeName: string; // สำนักงานเขต (เช่น "สำนักงานเขตจอมทอง")

  @Column({ type: 'varchar', length: 255 })
  name: string; // ชื่อองค์กร/มูลนิธิ/สมาคม (เช่น "มูลนิธิจอมทอง")

  @Column({ type: 'varchar', length: 50 })
  type: string; // ประเภท: "สมาคม" | "มูลนิธิ"

  @Column({ type: 'varchar', length: 100 })
  registrationNumber: string; // เลข กท. (เช่น "30", "31")

  @Column({ type: 'text', nullable: true })
  description: string | null; // คำอธิบายเพิ่มเติม (optional)

  @Column({ default: 0 })
  displayOrder: number; // ลำดับการแสดงผล

  @Column({ default: true })
  isActive: boolean; // เปิด/ปิดการใช้งาน

  @Column({ nullable: true })
  matchedGroupId: number | null; // FK to groups.id

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matchedGroupId' })
  matchedGroup: Group | null; // Relation to Group entity

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
