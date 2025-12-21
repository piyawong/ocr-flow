import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabelStatus } from './types';
import { Document } from './document.entity';
import { Group } from '../files/group.entity';
import { MinioService } from '../minio/minio.service';
import { TemplatesService } from '../templates/templates.service';
import { ParseRunnerService } from '../parse-runner/parse-runner.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class LabeledFilesService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    private minioService: MinioService,
    private templatesService: TemplatesService,
    @Inject(forwardRef(() => ParseRunnerService))
    private parseRunnerService: ParseRunnerService,
    @Inject(forwardRef(() => FilesService))
    private filesService: FilesService,
  ) {}

  // ❌ DEPRECATED: No longer needed (using documents table)
  // async createLabeledFile(data: {
  //   groupId: number;
  //   orderInGroup: number;
  //   groupedFileId: number;
  //   originalName: string;
  //   storagePath: string;
  //   ocrText: string;
  //   templateName?: string;
  //   category?: string;
  //   labelStatus: LabelStatus;
  //   matchReason?: string;
  //   documentId?: number;
  //   pageInDocument?: number;
  // }): Promise<LabeledFile> {
  //   const labeledFile = this.labeledFileRepository.create(data);
  //   return this.labeledFileRepository.save(labeledFile);
  // }

  // ❌ DEPRECATED: Use getGroupPagesWithLabels() instead
  // async findAll(): Promise<LabeledFile[]> {
  //   return this.labeledFileRepository.find({
  //     order: { groupId: 'ASC', orderInGroup: 'ASC' },
  //   });
  // }

  // ❌ DEPRECATED: Use getGroupPagesWithLabels() instead
  // async findByGroup(groupId: number): Promise<LabeledFile[]> {
  //   return this.labeledFileRepository.find({
  //     where: { groupId },
  //     order: { orderInGroup: 'ASC' },
  //     relations: ['document'], // Include document relation
  //   });
  // }

  // ❌ DEPRECATED: labeled_files table removed
  // async findByGroupAndTemplate(
  //   groupId: number,
  //   templateName: string,
  // ): Promise<any[]> {
  //   // Use getGroupPagesWithLabels() instead
  // }

  // ❌ DEPRECATED: labeled_files table removed
  // async findById(id: number): Promise<any | null> {
  //   // Use files or documents table directly
  // }

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
    // Calculate from documents + files
    const files = await this.filesService.findByGroup(groupId);
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { documentNumber: 'ASC' },
    });

    const totalPages = files.length;

    // Count matched pages (pages covered by documents)
    let matchedPages = 0;
    for (const doc of documents) {
      matchedPages += (doc.endPage - doc.startPage + 1);
    }

    const unmatchedPages = totalPages - matchedPages;
    const matchPercentage = totalPages > 0 ? (matchedPages / totalPages) * 100 : 0;

    // Documents summary
    const documentsSummary = documents.map(doc => ({
      templateName: doc.templateName,
      category: doc.category || '',
      pageCount: doc.endPage - doc.startPage + 1,
    }));

    return {
      totalPages,
      matchedPages,
      unmatchedPages,
      matchPercentage,
      documents: documentsSummary,
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
    // Calculate from groups + files + documents
    const groups = await this.groupRepository.find({
      where: { isAutoLabeled: true }, // Only labeled groups
      select: ['id', 'isParseData', 'isLabeledReviewed', 'labeledReviewer'],
    });

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

    for (const group of groups) {
      // Filter: By default, only show unreviewed groups
      if (!options?.includeReviewed && group.isLabeledReviewed) {
        continue;
      }

      // Get files and documents for this group
      const files = await this.filesService.findByGroup(group.id);
      const documents = await this.documentRepository.find({
        where: { groupId: group.id },
      });

      const totalPages = files.length;

      // Count matched pages (pages covered by documents)
      let matchedPages = 0;
      for (const doc of documents) {
        matchedPages += (doc.endPage - doc.startPage + 1);
      }

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
        groupId: group.id,
        totalPages,
        matchedPages,
        matchPercentage,
        status,
        isParseData: group.isParseData || false,
        isReviewed: group.isLabeledReviewed || false,
        reviewer: group.labeledReviewer || null,
      });
    }

    return summaries.sort((a, b) => a.groupId - b.groupId);
  }

  async clearAll(): Promise<void> {
    // Delete all documents (files in MinIO are preserved in files table)
    await this.documentRepository.clear();

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


  async getProcessedGroups(): Promise<number[]> {
    // Get distinct group IDs from documents table
    const result = await this.documentRepository
      .createQueryBuilder('doc')
      .select('DISTINCT doc.groupId', 'groupId')
      .getRawMany();
    return result.map(r => r.groupId);
  }

  async isGroupProcessed(groupId: number): Promise<boolean> {
    // Check if documents exist for this group
    const count = await this.documentRepository.count({
      where: { groupId },
    });
    return count > 0;
  }

  async isGroup100Matched(groupId: number): Promise<boolean> {
    // ✅ NEW: Compare total pages vs matched pages from documents
    const files = await this.filesService.findByGroup(groupId);
    const documents = await this.documentRepository.find({
      where: { groupId },
    });

    if (files.length === 0) return false;

    // Count matched pages (pages covered by documents)
    let matchedPages = 0;
    for (const doc of documents) {
      matchedPages += (doc.endPage - doc.startPage + 1);
    }

    return matchedPages === files.length;
  }

  async isGroupUserReviewed(groupId: number): Promise<boolean> {
    // ✅ NEW: Check if ALL documents in group are reviewed
    const documents = await this.documentRepository.find({
      where: { groupId },
    });

    if (documents.length === 0) return false;

    // All documents must be reviewed
    return documents.every(doc => doc.isUserReviewed === true);
  }

  async getGroupOcrTexts(groupId: number): Promise<Map<number, string>> {
    // ✅ NEW: Get from files table directly
    const files = await this.filesService.findByGroup(groupId);
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
    // ✅ NEW: Get from documents table directly
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { documentNumber: 'ASC' },
    });

    const files = await this.filesService.findByGroup(groupId);
    const filesMap = new Map(files.map(f => [f.orderInGroup, f]));

    const result = new Map<string, {
      pages: number[];
      ocrTexts: Map<number, string>;
      startPage: number;
      endPage: number;
    }>();

    for (const doc of documents) {
      const key = `${doc.templateName}_${doc.documentNumber}`;
      const pages: number[] = [];
      const ocrTexts = new Map<number, string>();

      // Get OCR texts for pages in this document
      for (let pageNum = doc.startPage; pageNum <= doc.endPage; pageNum++) {
        pages.push(pageNum);
        const file = filesMap.get(pageNum);
        if (file) {
          ocrTexts.set(pageNum, file.ocrText || '');
        }
      }

      result.set(key, {
        pages,
        ocrTexts,
        startPage: doc.startPage,
        endPage: doc.endPage,
      });
    }

    return result;
  }

  // ❌ DEPRECATED: Use updateGroupDocuments() instead (document-based)
  // async updatePageLabels(
  //   groupId: number,
  //   updates: {
  //     id: number;
  //     templateName?: string;
  //     category?: string;
  //     labelStatus?: LabelStatus;
  //     matchReason?: string;
  //     documentId?: number;
  //     pageInDocument?: number;
  //   }[],
  //   documentDates?: {
  //     documentNumber: number;
  //     templateName: string;
  //     documentDate: string | null;
  //   }[],
  // ): Promise<{ updated: number }> {
  //   // Old page-based logic - no longer used
  //   return { updated: 0 };
  // }

  // Get all templates from database
  async getTemplates(): Promise<{ name: string; category: string }[]> {
    const templates = await this.templatesService.findAll();
    return templates.map(t => ({
      name: t.name,
      category: t.category || '',
    }));
  }

  // ========================================================================
  // DOCUMENT CRUD METHODS (NEW)
  // ========================================================================

  // ❌ DEPRECATED: Documents created directly with startPage/endPage
  // async createOrUpdateDocument(data: {
  //   groupId: number;
  //   documentNumber: number;
  //   templateName: string;
  //   category?: string;
  //   documentDate?: Date | null;
  // }): Promise<Document> {
  //   // Old logic - no longer used
  //   return null as any;
  // }


  /**
   * Update document date only
   */
  async updateDocumentDate(
    documentId: number,
    documentDate: Date | null,
  ): Promise<Document> {
    await this.documentRepository.update(documentId, { documentDate });
    return this.documentRepository.findOne({ where: { id: documentId } })!;
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: number): Promise<Document | null> {
    return this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['pages'],
    });
  }

  /**
   * Delete document (CASCADE will delete labeled_files.documentTableId references)
   */
  async deleteDocument(documentId: number): Promise<void> {
    await this.documentRepository.delete(documentId);
  }

  // ❌ DEPRECATED: No longer needed (documents created directly)
  // async linkFilesToDocuments(groupId: number): Promise<void> {
  //   const files = await this.findByGroup(groupId);
  //   for (const file of files) {
  //     if (file.documentId && file.templateName && !file.documentTableId) {
  //       const doc = await this.createOrUpdateDocument({
  //         groupId,
  //         documentNumber: file.documentId,
  //         templateName: file.templateName,
  //         category: file.category,
  //       });
  //       await this.labeledFileRepository.update(file.id, {
  //         documentTableId: doc.id,
  //       });
  //     }
  //   }
  //   await this.updateDocumentPageCounts(groupId);
  // }

  // ❌ DEPRECATED: pageCount calculated from endPage - startPage + 1
  // async updateDocumentPageCounts(groupId: number): Promise<void> {
  //   const documents = await this.documentRepository.find({
  //     where: { groupId },
  //   });
  //   for (const doc of documents) {
  //     const pageCount = await this.labeledFileRepository.count({
  //       where: { documentTableId: doc.id },
  //     });
  //     await this.documentRepository.update(doc.id, { pageCount });
  //   }
  // }

  // Mark all files in a group as reviewed by a user
  async markGroupAsReviewed(
    groupId: number,
    reviewer: string,
    notes?: string,
    markAsReviewed: boolean = true,
  ): Promise<{ updated: number; marked: boolean; parsed?: boolean; parseMessage?: string }> {
    let result;

    // Update documents with review information
    if (markAsReviewed) {
      result = await this.documentRepository.update(
        { groupId },
        {
          isUserReviewed: true,
          reviewer,
          reviewNotes: notes || null,
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

  // ========================================================================
  // DOCUMENT-BASED LABELING METHODS (NEW)
  // ========================================================================

  /**
   * Extract document ranges from page labels
   * Converts page-by-page labels to document ranges
   */
  extractDocumentRanges(
    pageLabels: any[],
    files: any[],
  ): {
    templateName: string;
    category: string;
    startPage: number;
    endPage: number;
    pageCount: number;
  }[] {
    const ranges: {
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      pageCount: number;
    }[] = [];
    let currentRange: {
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      pageCount: number;
    } | null = null;

    pageLabels.forEach((label, idx) => {
      const orderInGroup = files[idx].orderInGroup;

      if (label.status === 'start' || label.status === 'single') {
        // เริ่ม document ใหม่
        if (currentRange) ranges.push(currentRange);

        currentRange = {
          templateName: label.templateName!,
          category: label.category,
          startPage: orderInGroup,
          endPage: orderInGroup,
          pageCount: 1,
        };

        // ถ้า single page → ปิด document ทันที
        if (label.status === 'single') {
          ranges.push(currentRange);
          currentRange = null;
        }
      } else if (label.status === 'continue' || label.status === 'end') {
        // ขยาย document ปัจจุบัน
        if (currentRange) {
          currentRange.endPage = orderInGroup;
          currentRange.pageCount++;

          // ถ้า end → ปิด document
          if (label.status === 'end') {
            ranges.push(currentRange);
            currentRange = null;
          }
        }
      }
      // unmatched → skip (ไม่เป็น document)
    });

    // Handle incomplete document (shouldn't happen in practice)
    if (currentRange) {
      ranges.push(currentRange);
    }

    return ranges;
  }

  /**
   * Get next document number for a group
   */
  private async getNextDocumentNumber(groupId: number): Promise<number> {
    const maxDoc = await this.documentRepository.findOne({
      where: { groupId },
      order: { documentNumber: 'DESC' },
    });
    return (maxDoc?.documentNumber || 0) + 1;
  }

  /**
   * Create a document with its pages (document-based labeling)
   * ✅ NEW: Only creates document record (no labeled_files)
   */
  async createDocumentWithPages(
    groupId: number,
    range: {
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      pageCount: number;
      documentDate?: string | null;
    },
    allFiles: any[],
  ): Promise<Document> {
    // Get next document number
    const documentNumber = await this.getNextDocumentNumber(groupId);

    // Create document record
    const document = await this.documentRepository.save({
      groupId,
      documentNumber,
      templateName: range.templateName,
      category: range.category,
      startPage: range.startPage,
      endPage: range.endPage,
      pageCount: range.pageCount,
      documentDate: range.documentDate ? new Date(range.documentDate) : null,
      isUserReviewed: false,
      reviewer: null,
      reviewNotes: null,
    });

    return document;
  }

  /**
   * Get all documents for a group (with page ranges)
   */
  async getDocumentsByGroup(groupId: number): Promise<any[]> {
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { documentNumber: 'ASC' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      documentNumber: doc.documentNumber,
      templateName: doc.templateName,
      category: doc.category,
      startPage: doc.startPage,
      endPage: doc.endPage,
      pageCount: doc.pageCount,
      documentDate: doc.documentDate,
      isUserReviewed: doc.isUserReviewed,
      reviewer: doc.reviewer,
      reviewNotes: doc.reviewNotes,
      createdAt: doc.createdAt,
    }));
  }

  /**
   * ✅ NEW: Get pages with labels (merge files + documents)
   * This replaces the old labeled_files table
   */
  async getGroupPagesWithLabels(groupId: number): Promise<any[]> {
    // 1. Get all files in the group
    const files = await this.filesService.findByGroup(groupId);

    // 2. Get all documents in the group
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { documentNumber: 'ASC' },
    });

    // 3. Merge: for each file, find which document it belongs to
    const pages = files.map((file) => {
      // Find document that contains this page
      const document = documents.find(
        (doc) => file.orderInGroup >= doc.startPage && file.orderInGroup <= doc.endPage,
      );

      if (document) {
        // Calculate labelStatus based on position
        let labelStatus: 'start' | 'continue' | 'end' | 'single';
        const isStart = file.orderInGroup === document.startPage;
        const isEnd = file.orderInGroup === document.endPage;
        const isSingle = document.startPage === document.endPage;

        if (isSingle) {
          labelStatus = 'single';
        } else if (isStart) {
          labelStatus = 'start';
        } else if (isEnd) {
          labelStatus = 'end';
        } else {
          labelStatus = 'continue';
        }

        return {
          id: file.id, // Use file.id as page id
          groupId: file.groupId,
          orderInGroup: file.orderInGroup,
          groupedFileId: file.id,
          originalName: file.originalName,
          storagePath: file.storagePath,
          ocrText: file.ocrText,
          templateName: document.templateName,
          category: document.category,
          labelStatus,
          matchReason: `document ${document.documentNumber}`,
          documentId: document.documentNumber,
          pageInDocument: file.orderInGroup - document.startPage + 1,
          documentDate: document.documentDate, // Add document date
          isUserReviewed: document.isUserReviewed,
          reviewer: document.reviewer,
          createdAt: file.createdAt,
        };
      } else {
        // Unmatched page
        return {
          id: file.id,
          groupId: file.groupId,
          orderInGroup: file.orderInGroup,
          groupedFileId: file.id,
          originalName: file.originalName,
          storagePath: file.storagePath,
          ocrText: file.ocrText,
          templateName: null,
          category: null,
          labelStatus: 'unmatched',
          matchReason: 'no document matched',
          documentId: null,
          pageInDocument: null,
          isUserReviewed: false,
          reviewer: null,
          createdAt: file.createdAt,
        };
      }
    });

    return pages;
  }

  /**
   * Clear labeled files by group (for relabeling)
   * ✅ NEW: Only delete documents (no labeled_files table)
   */
  async clearByGroup(groupId: number): Promise<void> {
    // Delete documents only
    await this.documentRepository.delete({ groupId });
  }

  /**
   * Update documents for a group (document-based labeling)
   * Used by API endpoint
   */
  async updateGroupDocuments(
    groupId: number,
    documents: {
      id?: number;
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      documentDate?: string;
    }[],
  ): Promise<{ success: boolean; documentsCreated: number }> {
    // Get files from this group
    const files = await this.filesService.findByGroup(groupId);

    // Clear existing labels
    await this.clearByGroup(groupId);

    // Create new documents with pages
    for (const doc of documents) {
      await this.createDocumentWithPages(
        groupId,
        {
          templateName: doc.templateName,
          category: doc.category,
          startPage: doc.startPage,
          endPage: doc.endPage,
          pageCount: doc.endPage - doc.startPage + 1,
          documentDate: doc.documentDate || null,
        },
        files,
      );
    }

    return { success: true, documentsCreated: documents.length };
  }
}
