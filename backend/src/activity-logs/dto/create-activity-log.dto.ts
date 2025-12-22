import { IsEnum, IsOptional, IsString, IsNumber } from 'class-validator';
import {
  ActivityAction,
  ActivityEntityType,
  ActivityStage,
} from '../activity-log.entity';

export class CreateActivityLogDto {
  @IsNumber()
  @IsOptional()
  userId?: number;

  @IsString()
  userName: string;

  @IsEnum(ActivityAction)
  action: ActivityAction;

  @IsEnum(ActivityEntityType)
  entityType: ActivityEntityType;

  @IsNumber()
  @IsOptional()
  entityId?: number;

  @IsNumber()
  @IsOptional()
  groupId?: number;

  @IsEnum(ActivityStage)
  stage: ActivityStage;

  @IsString()
  @IsOptional()
  fieldName?: string;

  @IsString()
  @IsOptional()
  oldValue?: string;

  @IsString()
  @IsOptional()
  newValue?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
