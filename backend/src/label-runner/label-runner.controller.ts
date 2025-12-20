import { Controller, Post, Get, Param, ParseIntPipe, Sse } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { LabelRunnerService } from './label-runner.service';
import { Observable, map } from 'rxjs';

@Controller('label-runner')
export class LabelRunnerController {
  constructor(private readonly labelRunnerService: LabelRunnerService) {}

  @Post('relabel/:groupId')
  async relabelGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.labelRunnerService.relabelGroup(groupId);
  }

  @Post('start')
  async startAll() {
    // ⚠️ IMPORTANT: Check if already running
    if (this.labelRunnerService.isTaskRunning()) {
      return {
        message: 'Label task is already running',
        isRunning: true,
        error: 'ALREADY_RUNNING', // ✅ Return error code
      };
    }

    // Don't await - run in background
    this.labelRunnerService.startLabelTask();
    return { message: 'Label task started', isRunning: false };
  }

  @Post('stop')
  stop() {
    this.labelRunnerService.stopTask();
    return { message: 'Label task stop requested' };
  }

  @Get('status')
  getStatus() {
    return {
      isRunning: this.labelRunnerService.isTaskRunning(),
    };
  }

  @Get('logs-history')
  getLogsHistory() {
    return {
      logs: this.labelRunnerService.getLogHistory(),
      isRunning: this.labelRunnerService.isTaskRunning(),
    };
  }

  @Post('clear-logs')
  clearLogs() {
    this.labelRunnerService.clearLogs();
    return { message: 'Logs cleared' };
  }

  @Post('reload-templates')
  reloadTemplates() {
    this.labelRunnerService.reloadTemplates();
    return { message: 'Templates reloaded' };
  }

  @Public()
  @Sse('logs')
  streamLogs(): Observable<MessageEvent> {
    return this.labelRunnerService.getLogObservable().pipe(
      map((log) => ({
        data: JSON.stringify(log),
      } as MessageEvent)),
    );
  }
}
