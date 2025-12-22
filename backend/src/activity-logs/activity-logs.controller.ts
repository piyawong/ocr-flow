import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { FindActivityLogsDto } from './dto/find-activity-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/user.entity';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Only admin can access activity logs
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  /**
   * Get all activity logs with filters and pagination
   * GET /activity-logs?page=1&limit=50&stage=03-pdf-label&action=update
   */
  @Get()
  async findAll(@Query() query: FindActivityLogsDto) {
    return await this.activityLogsService.findAll(query);
  }

  /**
   * Get activity logs by group ID
   * GET /activity-logs/group/:groupId
   */
  @Get('group/:groupId')
  async findByGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    const logs = await this.activityLogsService.findByGroup(groupId);
    return { logs };
  }

  /**
   * Get activity logs by user ID
   * GET /activity-logs/user/:userId
   */
  @Get('user/:userId')
  async findByUser(@Param('userId', ParseIntPipe) userId: number) {
    const logs = await this.activityLogsService.findByUser(userId);
    return { logs };
  }

  /**
   * Get activity logs statistics
   * GET /activity-logs/stats
   */
  @Get('stats')
  async getStatistics() {
    return await this.activityLogsService.getStatistics();
  }
}
