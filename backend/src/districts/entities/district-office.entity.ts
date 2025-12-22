import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('district_offices')
export class DistrictOffice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string; // ชื่อสำนักงานเขต (เช่น "สำนักงานเขตจอมทอง")

  @Column({ type: 'varchar', length: 255 })
  foundationName: string; // ชื่อมูลนิธิ (เช่น "จอมทอง")

  @Column({ type: 'varchar', length: 100 })
  registrationNumber: string; // เลข กท. (เช่น "30", "31")

  @Column({ type: 'text', nullable: true })
  description: string | null; // คำอธิบายเพิ่มเติม (optional)

  @Column({ default: 0 })
  displayOrder: number; // ลำดับการแสดงผล

  @Column({ default: true })
  isActive: boolean; // เปิด/ปิดการใช้งาน

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
