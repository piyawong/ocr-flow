import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './file.entity';
import { Group } from './group.entity';
import { FoundationInstrument } from './foundation-instrument.entity';
import { CharterSection } from './charter-section.entity';
import { CharterArticle } from './charter-article.entity';
import { CharterSubItem } from './charter-sub-item.entity';
import { CommitteeMember } from './committee-member.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { MinioModule } from '../minio/minio.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      File,
      Group,
      FoundationInstrument,
      CharterSection,
      CharterArticle,
      CharterSubItem,
      CommitteeMember,
    ]),
    MinioModule,
    ActivityLogsModule,
  ],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
