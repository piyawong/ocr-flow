import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { ActivityLog } from './activity-log.entity';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { FindActivityLogsDto } from './dto/find-activity-logs.dto';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Create a new activity log entry
   */
  async create(createDto: CreateActivityLogDto): Promise<ActivityLog> {
    const log = this.activityLogRepository.create(createDto);
    return await this.activityLogRepository.save(log);
  }

  /**
   * Find all activity logs with filters and pagination
   */
  async findAll(query: FindActivityLogsDto): Promise<{
    logs: ActivityLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 50,
      userId,
      groupId,
      action,
      entityType,
      stage,
      startDate,
      endDate,
      search,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (userId) where.userId = userId;
    if (groupId) where.groupId = groupId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (stage) where.stage = stage;

    // Date range filter
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = Between(new Date(startDate), new Date());
    }

    // Search filter (search in userName, description, fieldName)
    let queryBuilder = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('log.group', 'group');

    // Apply where conditions
    Object.keys(where).forEach((key) => {
      if (key === 'createdAt') {
        queryBuilder = queryBuilder.andWhere('log.createdAt BETWEEN :start AND :end', {
          start: where.createdAt._value[0],
          end: where.createdAt._value[1],
        });
      } else {
        queryBuilder = queryBuilder.andWhere(`log.${key} = :${key}`, { [key]: where[key] });
      }
    });

    // Search
    if (search) {
      queryBuilder = queryBuilder.andWhere(
        '(log.userName LIKE :search OR log.description LIKE :search OR log.fieldName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const logs = await queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find activity logs by group ID
   */
  async findByGroup(groupId: number, limit = 100): Promise<ActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { groupId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  /**
   * Find activity logs by user ID
   */
  async findByUser(userId: number, limit = 100): Promise<ActivityLog[]> {
    return await this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['group'],
    });
  }

  /**
   * Get activity statistics
   */
  async getStatistics(): Promise<{
    totalLogs: number;
    logsByAction: Record<string, number>;
    logsByStage: Record<string, number>;
    logsByEntityType: Record<string, number>;
  }> {
    const totalLogs = await this.activityLogRepository.count();

    // Group by action
    const logsByAction = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action')
      .getRawMany();

    // Group by stage
    const logsByStage = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.stage')
      .getRawMany();

    // Group by entity type
    const logsByEntityType = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.entityType', 'entityType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.entityType')
      .getRawMany();

    return {
      totalLogs,
      logsByAction: logsByAction.reduce((acc, row) => {
        acc[row.action] = parseInt(row.count);
        return acc;
      }, {}),
      logsByStage: logsByStage.reduce((acc, row) => {
        acc[row.stage] = parseInt(row.count);
        return acc;
      }, {}),
      logsByEntityType: logsByEntityType.reduce((acc, row) => {
        acc[row.entityType] = parseInt(row.count);
        return acc;
      }, {}),
    };
  }
}
