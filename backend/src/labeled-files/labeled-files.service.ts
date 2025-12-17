import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabeledFile, LabelStatus } from './labeled-file.entity';
import { Group } from '../files/group.entity';
import { MinioService } from '../minio/minio.service';
import { TemplatesService } from '../templates/templates.service';
import { ParseRunnerService } from '../parse-runner/parse-runner.service';

@Injectable()
export class LabeledFilesService {
  constructor(
    @InjectRepository(LabeledFile)
    private labeledFileRepository: Repository<LabeledFile>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    private minioService: MinioService,
    private templatesService: TemplatesService,
    @Inject(forwardRef(() => ParseRunnerService))
    private parseRunnerService: ParseRunnerService,
  ) {}

  async createLabeledFile(data: {
    groupId: number;
    orderInGroup: number;
    groupedFileId: number;
    originalName: string;
    storagePath: string;
    ocrText: string;
    templateName?: string;
    category?: string;
    labelStatus: LabelStatus;
    matchReason?: string;
    documentId?: number;
    pageInDocument?: number;
  }): Promise<LabeledFile> {
    const labeledFile = this.labeledFileRepository.create(data);
    return this.labeledFileRepository.save(labeledFile);
  }

  async findAll(): Promise<LabeledFile[]> {
    return this.labeledFileRepository.find({
      order: { groupId: 'ASC', orderInGroup: 'ASC' },
    });
  }

  async findByGroup(groupId: number): Promise<LabeledFile[]> {
    return this.labeledFileRepository.find({
      where: { groupId },
      order: { orderInGroup: 'ASC' },
    });
  }

  async findByGroupAndTemplate(
    groupId: number,
    templateName: string,
  ): Promise<LabeledFile[]> {
    return this.labeledFileRepository.find({
      where: { groupId, templateName },
      order: { orderInGroup: 'ASC' },
    });
  }

  async findById(id: number): Promise<LabeledFile | null> {
    return this.labeledFileRepository.findOne({ where: { id } });
  }

  async getFileBuffer(storagePath: string): Promise<Buffer> {
    return this.minioService.getFile(storagePath);
  }

  async getGroupSummary(groupId: number): Promise<{
    totalPages: number;
    matchedPages: number;
    unmatchedPages: number;
    matchPercentage: number;
    documents: { templateName: string; category: string; pageCount: number }[];
  }> {
    const files = await this.findByGroup(groupId);
    const totalPages = files.length;
    const matchedPages = files.filter(f => f.labelStatus !== 'unmatched').length;
    const unmatchedPages = totalPages - matchedPages;
    const matchPercentage = totalPages > 0 ? (matchedPages / totalPages) * 100 : 0;

    // Group by document
    const documentMap = new Map<string, { templateName: string; category: string; pageCount: number }>();
    for (const file of files) {
      if (file.templateName && file.labelStatus !== 'unmatched') {
        const key = `${file.documentId}-${file.templateName}`;
        if (!documentMap.has(key)) {
          documentMap.set(key, {
            templateName: file.templateName,
            category: file.category || '',
            pageCount: 0,
          });
        }
        documentMap.get(key)!.pageCount++;
      }
    }

    return {
      totalPages,
      matchedPages,
      unmatchedPages,
      matchPercentage,
      documents: Array.from(documentMap.values()),
    };
  }

  async getAllGroupsSummary(options?: { includeReviewed?: boolean }): Promise<
    {
      groupId: number;
      totalPages: number;
      matchedPages: number;
      matchPercentage: number;
      status: 'matched' | 'has_unmatched' | 'all_unmatched';
      isParseData: boolean;
      isReviewed: boolean;
      reviewer: string | null;
    }[]
  > {
    const allFiles = await this.findAll();
    const groupMap = new Map<number, LabeledFile[]>();

    for (const file of allFiles) {
      if (!groupMap.has(file.groupId)) {
        groupMap.set(file.groupId, []);
      }
      groupMap.get(file.groupId)!.push(file);
    }

    // Fetch isParseData status from groups table
    const groupIds = Array.from(groupMap.keys());
    const groups = await this.groupRepository.find({
      where: groupIds.map(id => ({ id })),
      select: ['id', 'isParseData'],
    });
    const parseDataMap = new Map<number, boolean>();
    for (const group of groups) {
      parseDataMap.set(group.id, group.isParseData || false);
    }

    const summaries: {
      groupId: number;
      totalPages: number;
      matchedPages: number;
      matchPercentage: number;
      status: 'matched' | 'has_unmatched' | 'all_unmatched';
      isParseData: boolean;
      isReviewed: boolean;
      reviewer: string | null;
    }[] = [];

    for (const [groupId, files] of groupMap) {
      // ✅ Check if all files in group are reviewed
      const allReviewed = files.every(f => f.isUserReviewed);
      const reviewer = files.find(f => f.reviewer)?.reviewer || null;

      // ✅ Filter: By default, only show groups that have at least one file with isUserReviewed = false
      // If includeReviewed is true, show all groups
      if (!options?.includeReviewed) {
        const hasUnreviewedFiles = files.some(f => !f.isUserReviewed);
        if (!hasUnreviewedFiles) {
          continue; // Skip this group if all files are reviewed
        }
      }

      const totalPages = files.length;
      const matchedPages = files.filter(f => f.labelStatus !== 'unmatched').length;
      const matchPercentage = totalPages > 0 ? (matchedPages / totalPages) * 100 : 0;

      let status: 'matched' | 'has_unmatched' | 'all_unmatched';
      if (matchedPages === totalPages) {
        status = 'matched';
      } else if (matchedPages === 0) {
        status = 'all_unmatched';
      } else {
        status = 'has_unmatched';
      }

      summaries.push({
        groupId,
        totalPages,
        matchedPages,
        matchPercentage,
        status,
        isParseData: parseDataMap.get(groupId) || false,
        isReviewed: allReviewed,
        reviewer,
      });
    }

    return summaries.sort((a, b) => a.groupId - b.groupId);
  }

  async clearAll(): Promise<void> {
    // Delete files from MinIO first
    const files = await this.labeledFileRepository.find();
    for (const file of files) {
      if (file.storagePath) {
        try {
          await this.minioService.deleteFile(file.storagePath);
        } catch (e) {
          // Ignore deletion errors (file might not exist)
        }
      }
    }

    // Clear DB
    await this.labeledFileRepository.clear();

    // Reset labeled status in groups table (using QueryBuilder to update all)
    await this.groupRepository
      .createQueryBuilder()
      .update()
      .set({
        isAutoLabeled: false,
        labeledAt: null,
      })
      .execute();
  }

  async clearByGroup(groupId: number): Promise<void> {
    // ✅ FIX: Do NOT delete files from MinIO!
    // labeled_files.storagePath points to the ORIGINAL file in raw/
    // Deleting would destroy the source files!
    // We only need to clear the label metadata from database.

    // Clear labeled_files records from database
    await this.labeledFileRepository.delete({ groupId });

    // Reset labeled status for this group
    await this.groupRepository.update(
      { id: groupId },
      {
        isAutoLabeled: false,
        labeledAt: null,
      }
    );
  }

  async getProcessedGroups(): Promise<number[]> {
    const result = await this.labeledFileRepository
      .createQueryBuilder('lf')
      .select('DISTINCT lf.groupId', 'groupId')
      .getRawMany();
    return result.map(r => r.groupId);
  }

  async isGroupProcessed(groupId: number): Promise<boolean> {
    const count = await this.labeledFileRepository.count({
      where: { groupId },
    });
    return count > 0;
  }

  async isGroup100Matched(groupId: number): Promise<boolean> {
    const files = await this.findByGroup(groupId);
    if (files.length === 0) return false;
    const matchedCount = files.filter(f => f.labelStatus !== 'unmatched').length;
    return matchedCount === files.length;
  }

  async isGroupUserReviewed(groupId: number): Promise<boolean> {
    const files = await this.findByGroup(groupId);
    if (files.length === 0) return false;
    // Check if all files in the group have been user reviewed
    const reviewedCount = files.filter(f => f.isUserReviewed === true).length;
    return reviewedCount === files.length;
  }

  async getGroupOcrTexts(groupId: number): Promise<Map<number, string>> {
    const files = await this.findByGroup(groupId);
    const ocrTexts = new Map<number, string>();
    for (const file of files) {
      ocrTexts.set(file.orderInGroup, file.ocrText || '');
    }
    return ocrTexts;
  }

  async getDocumentsByTemplate(groupId: number): Promise<Map<string, {
    pages: number[];
    ocrTexts: Map<number, string>;
    startPage: number;
    endPage: number;
  }>> {
    const files = await this.findByGroup(groupId);
    const documents = new Map<string, {
      pages: number[];
      ocrTexts: Map<number, string>;
      startPage: number;
      endPage: number;
    }>();

    // Group files by documentId and templateName
    for (const file of files) {
      if (file.templateName && file.documentId) {
        const key = `${file.templateName}_${file.documentId}`;
        if (!documents.has(key)) {
          documents.set(key, {
            pages: [],
            ocrTexts: new Map(),
            startPage: file.orderInGroup,
            endPage: file.orderInGroup,
          });
        }
        const doc = documents.get(key)!;
        doc.pages.push(file.orderInGroup);
        doc.ocrTexts.set(file.orderInGroup, file.ocrText || '');
        doc.startPage = Math.min(doc.startPage, file.orderInGroup);
        doc.endPage = Math.max(doc.endPage, file.orderInGroup);
      }
    }

    return documents;
  }

  // Manual Label: Update page labels
  async updatePageLabels(
    groupId: number,
    updates: {
      id: number;
      templateName?: string;
      category?: string;
      labelStatus?: LabelStatus;
      matchReason?: string;
      documentId?: number;
      pageInDocument?: number;
    }[],
  ): Promise<{ updated: number }> {
    let updatedCount = 0;

    for (const update of updates) {
      const result = await this.labeledFileRepository.update(
        { id: update.id, groupId },
        {
          templateName: update.templateName,
          category: update.category,
          labelStatus: update.labelStatus,
          matchReason: update.matchReason || 'manual',
          documentId: update.documentId,
          pageInDocument: update.pageInDocument,
        },
      );
      if (result.affected) {
        updatedCount += result.affected;
      }
    }

    return { updated: updatedCount };
  }

  // Get all templates from database
  async getTemplates(): Promise<{ name: string; category: string }[]> {
    const templates = await this.templatesService.findAll();
    return templates.map(t => ({
      name: t.name,
      category: t.category || '',
    }));
  }

  // Mark all files in a group as reviewed by a user
  async markGroupAsReviewed(
    groupId: number,
    reviewer: string,
    notes?: string,
    markAsReviewed: boolean = true,
  ): Promise<{ updated: number; marked: boolean; parsed?: boolean; parseMessage?: string }> {
    let result;

    // Only update isUserReviewed when markAsReviewed is true
    if (markAsReviewed) {
      result = await this.labeledFileRepository.update(
        { groupId },
        {
          isUserReviewed: true,
          reviewer,
        },
      );

      // Update groups table with reviewer and reviewed status
      await this.groupRepository.update(
        { id: groupId },
        {
          labeledReviewer: reviewer,
          isLabeledReviewed: true,
          labeledNotes: notes || null,
        },
      );
    } else {
      result = { affected: 0 };

      // Only update notes when not marking as reviewed
      await this.groupRepository.update(
        { id: groupId },
        { labeledNotes: notes || null },
      );
    }

    // Auto-trigger parse data if marked as reviewed and 100% matched
    let parsed = false;
    let parseMessage = '';
    if (markAsReviewed) {
      try {
        // Check if 100% matched
        const is100Matched = await this.isGroup100Matched(groupId);

        if (is100Matched) {
          // Trigger parse data in background (don't wait for it to complete)
          this.parseRunnerService
            .parseGroup(groupId)
            .then((parseResult) => {
              if (parseResult.success) {
                console.log(`Auto-parse successful for group ${groupId}`);
              } else {
                console.log(`Auto-parse failed for group ${groupId}: ${parseResult.message}`);
              }
            })
            .catch((err) => {
              console.error(`Auto-parse error for group ${groupId}:`, err);
            });

          parsed = true;
          parseMessage = 'Parse data triggered in background';
        }
      } catch (err) {
        console.error(`Error triggering auto-parse for group ${groupId}:`, err);
      }
    }

    return {
      updated: result.affected || 0,
      marked: markAsReviewed,
      parsed,
      parseMessage,
    };
  }
}
