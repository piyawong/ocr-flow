import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  districtOfficeName: string; // สำนักงานเขต

  @IsString()
  name: string; // ชื่อองค์กร

  @IsString()
  type: string; // ประเภท: "สมาคม" | "มูลนิธิ"

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

  @IsOptional()
  @IsInt()
  matchedGroupId?: number; // FK to groups.id (optional)
}
