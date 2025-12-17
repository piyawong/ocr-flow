import { Controller, Get, Post, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { TaskRunnerService } from './task-runner.service';

@Controller('task-runner')
export class TaskRunnerController {
  constructor(private readonly taskRunnerService: TaskRunnerService) {}

  @Get('status')
  getStatus() {
    return {
      isRunning: this.taskRunnerService.isTaskRunning(),
    };
  }

  @Get('logs-history')
  getLogsHistory() {
    return {
      logs: this.taskRunnerService.getLogHistory(),
      isRunning: this.taskRunnerService.isTaskRunning(),
    };
  }

  @Post('clear-logs')
  clearLogs() {
    this.taskRunnerService.clearLogs();
    return { message: 'Logs cleared' };
  }

  @Post('start')
  async startTask() {
    // Check if already running
    if (this.taskRunnerService.isTaskRunning()) {
      return {
        message: 'Task is already running',
        isRunning: true,
        error: 'ALREADY_RUNNING'
      };
    }

    // Don't await - let it run in background
    this.taskRunnerService.startTask();
    return { message: 'Task started', isRunning: false };
  }

  @Post('stop')
  stopTask() {
    this.taskRunnerService.stopTask();
    return { message: 'Task stopped' };
  }

  @Sse('logs')
  streamLogs(): Observable<MessageEvent> {
    return this.taskRunnerService.getLogObservable().pipe(
      map((log) => ({
        data: JSON.stringify(log),
      })),
    );
  }
}
