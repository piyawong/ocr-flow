import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { File } from '../files/file.entity';
import { Group } from '../files/group.entity';
import { Document } from '../labeled-files/document.entity';
import { FoundationInstrument } from '../files/foundation-instrument.entity';
import { CommitteeMember } from '../files/committee-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      File,
      Group,
      Document,
      FoundationInstrument,
      CommitteeMember,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
