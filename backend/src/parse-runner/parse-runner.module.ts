import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParseRunnerController } from './parse-runner.controller';
import { ParseRunnerService } from './parse-runner.service';
import { FilesModule } from '../files/files.module';
import { LabeledFilesModule } from '../labeled-files/labeled-files.module';
import { FoundationInstrument } from '../files/foundation-instrument.entity';
import { CharterSection } from '../files/charter-section.entity';
import { CharterArticle } from '../files/charter-article.entity';
import { CharterSubItem } from '../files/charter-sub-item.entity';
import { CommitteeMember } from '../files/committee-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FoundationInstrument,
      CharterSection,
      CharterArticle,
      CharterSubItem,
      CommitteeMember,
    ]),
    FilesModule,
    forwardRef(() => LabeledFilesModule),
  ],
  controllers: [ParseRunnerController],
  providers: [ParseRunnerService],
  exports: [ParseRunnerService],
})
export class ParseRunnerModule {}
