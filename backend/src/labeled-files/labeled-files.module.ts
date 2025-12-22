import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { Group } from '../files/group.entity';
import { LabeledFilesService } from './labeled-files.service';
import { LabeledFilesController } from './labeled-files.controller';
import { MinioModule } from '../minio/minio.module';
import { TemplatesModule } from '../templates/templates.module';
import { ParseRunnerModule } from '../parse-runner/parse-runner.module';
import { FilesModule } from '../files/files.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Group]),
    MinioModule,
    TemplatesModule,
    forwardRef(() => ParseRunnerModule),
    forwardRef(() => FilesModule),
    ActivityLogsModule,
  ],
  controllers: [LabeledFilesController],
  providers: [LabeledFilesService],
  exports: [LabeledFilesService],
})
export class LabeledFilesModule {}
