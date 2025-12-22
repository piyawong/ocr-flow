import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateDistrictOfficeDto {
  @IsString()
  name: string; // ชื่อสำนักงานเขต

  @IsString()
  foundationName: string; // ชื่อมูลนิธิ

  @IsString()
  registrationNumber: string; // เลข กท.

  @IsOptional()
  @IsString()
  description?: string; // คำอธิบาย (optional)

  @IsOptional()
  @IsInt()
  displayOrder?: number; // ลำดับการแสดงผล

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // เปิด/ปิดการใช้งาน
}
