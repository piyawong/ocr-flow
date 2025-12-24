import { Controller, Get, Query, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/summary
   * Get summary statistics (top cards)
   */
  @Get('summary')
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  /**
   * GET /dashboard/stage-progress
   * Get stage progress for workflow pipeline
   */
  @Get('stage-progress')
  async getStageProgress() {
    return this.dashboardService.getStageProgress();
  }

  /**
   * GET /dashboard/metrics
   * Get performance and quality metrics
   */
  @Get('metrics')
  async getMetrics() {
    return this.dashboardService.getMetrics();
  }

  /**
   * GET /dashboard/activity?limit=10
   * Get recent activity feed
   */
  @Get('activity')
  async getActivity(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentActivity(limitNum);
  }

  /**
   * GET /dashboard/alerts
   * Get alerts and issues
   */
  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getAlerts();
  }

  /**
   * GET /dashboard/trends?period=7d
   * Get trend data for charts
   */
  @Get('trends')
  async getTrends(@Query('period') period?: string) {
    return this.dashboardService.getTrends(period || '7d');
  }

  /**
   * SSE /dashboard/stream
   * Real-time dashboard updates (every 5 seconds)
   * Note: Public endpoint because SSE doesn't support custom headers (Bearer token)
   * This is safe because it's read-only data
   */
  @Public()
  @Sse('stream')
  streamUpdates(): Observable<MessageEvent> {
    return this.dashboardService.getUpdateObservable().pipe(
      map((update) => ({
        data: JSON.stringify(update),
      })),
    );
  }
}
