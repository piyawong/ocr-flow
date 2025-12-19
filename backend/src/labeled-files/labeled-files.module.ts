import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabeledFile } from './labeled-file.entity';
import { Document } from './document.entity';
import { Group } from '../files/group.entity';
import { LabeledFilesService } from './labeled-files.service';
import { LabeledFilesController } from './labeled-files.controller';
import { MinioModule } from '../minio/minio.module';
import { TemplatesModule } from '../templates/templates.module';
import { ParseRunnerModule } from '../parse-runner/parse-runner.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabeledFile, Document, Group]),
    MinioModule,
    TemplatesModule,
    forwardRef(() => ParseRunnerModule),
  ],
  controllers: [LabeledFilesController],
  providers: [LabeledFilesService],
  exports: [LabeledFilesService],
})
export class LabeledFilesModule {}
