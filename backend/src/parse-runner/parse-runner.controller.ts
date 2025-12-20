import { Controller, Get, Post, Sse, MessageEvent, Param, Query, ParseIntPipe } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import { ParseRunnerService } from './parse-runner.service';

@Controller('parse-runner')
export class ParseRunnerController {
  constructor(private readonly parseRunnerService: ParseRunnerService) {}

  @Get('status')
  getStatus() {
    return {
      isRunning: this.parseRunnerService.isTaskRunning(),
    };
  }

  @Get('logs-history')
  getLogsHistory() {
    return {
      logs: this.parseRunnerService.getLogHistory(),
      isRunning: this.parseRunnerService.isTaskRunning(),
    };
  }

  @Post('clear-logs')
  clearLogs() {
    this.parseRunnerService.clearLogs();
    return { message: 'Logs cleared' };
  }

  @Post('start')
  async startTask() {
    // Check if already running
    if (this.parseRunnerService.isTaskRunning()) {
      return {
        message: 'Parse task is already running',
        isRunning: true,
        error: 'ALREADY_RUNNING',
      };
    }

    // Don't await - let it run in background
    this.parseRunnerService.startTask();
    return { message: 'Parse task started', isRunning: false };
  }

  @Post('stop')
  stopTask() {
    this.parseRunnerService.stopTask();
    return { message: 'Parse task stopped' };
  }

  @Post('parse/:groupId')
  async parseGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('force') force?: string,
  ) {
    const forceReparse = force === 'true';
    const result = await this.parseRunnerService.parseGroup(groupId, forceReparse);
    return result;
  }

  @Public()
  @Sse('logs')
  streamLogs(): Observable<MessageEvent> {
    return this.parseRunnerService.getLogObservable().pipe(
      map((log) => ({
        data: JSON.stringify(log),
      })),
    );
  }
}
