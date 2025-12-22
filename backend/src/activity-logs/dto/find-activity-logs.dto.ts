import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import {
  ActivityAction,
  ActivityEntityType,
  ActivityStage,
} from '../activity-log.entity';

export class FindActivityLogsDto {
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsNumber()
  @IsOptional()
  groupId?: number;

  @IsEnum(ActivityAction)
  @IsOptional()
  action?: ActivityAction;

  @IsEnum(ActivityEntityType)
  @IsOptional()
  entityType?: ActivityEntityType;

  @IsEnum(ActivityStage)
  @IsOptional()
  stage?: ActivityStage;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
