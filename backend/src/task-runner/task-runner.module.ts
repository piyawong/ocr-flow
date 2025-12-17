import { Module } from '@nestjs/common';
import { TaskRunnerService } from './task-runner.service';
import { TaskRunnerController } from './task-runner.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [TaskRunnerController],
  providers: [TaskRunnerService],
  exports: [TaskRunnerService],
})
export class TaskRunnerModule {}
