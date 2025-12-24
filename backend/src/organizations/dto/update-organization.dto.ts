import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  districtOfficeName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  matchedGroupId?: number;
}
