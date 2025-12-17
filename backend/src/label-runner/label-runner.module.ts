import { Module } from '@nestjs/common';
import { LabelRunnerService } from './label-runner.service';
import { LabelRunnerController } from './label-runner.controller';
import { FilesModule } from '../files/files.module';
import { LabeledFilesModule } from '../labeled-files/labeled-files.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [FilesModule, LabeledFilesModule, TemplatesModule],
  controllers: [LabelRunnerController],
  providers: [LabelRunnerService],
  exports: [LabelRunnerService],
})
export class LabelRunnerModule {}
