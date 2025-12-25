import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Subject } from 'rxjs';
import * as sharp from 'sharp';
import { File } from './file.entity';
import { Group } from './group.entity';
import { FoundationInstrument } from './foundation-instrument.entity';
import { CharterSection } from './charter-section.entity';
import { CharterArticle } from './charter-article.entity';
import { CharterSubItem } from './charter-sub-item.entity';
import { CommitteeMember } from './committee-member.entity';
import { MinioService } from '../minio/minio.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityEntityType,
  ActivityStage,
} from '../activity-logs/activity-log.entity';

export interface FileEvent {
  type: 'GROUP_COMPLETE' | 'GROUP_CREATED' | 'GROUP_LOCKED' | 'GROUP_UNLOCKED' | 'GROUP_PARSED' | 'GROUP_REVIEWED';
  groupId?: number;
  lockedBy?: number;
  lockedAt?: Date;
  unlockedBy?: number;
  reviewer?: string;
  timestamp?: string;
}

@Injectable()
export class FilesService {
  private eventSubject = new Subject<FileEvent>();

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(CharterSection)
    private charterSectionRepository: Repository<CharterSection>,
    @InjectRepository(CharterArticle)
    private charterArticleRepository: Repository<CharterArticle>,
    @InjectRepository(CharterSubItem)
    private charterSubItemRepository: Repository<CharterSubItem>,
    private minioService: MinioService,
    private dataSource: DataSource,
    private activityLogsService: ActivityLogsService,
  ) {}

  // ========== EVENT BROADCASTING ==========
  getEventObservable() {
    return this.eventSubject.asObservable();
  }

  emitEvent(event: FileEvent) {
    this.eventSubject.next(event);
  }

  // ========== STAGE 01: UPLOAD OPERATIONS ==========
  async getNextFileNumber(): Promise<number> {
    const lastFile = await this.fileRepository.find({
      order: { fileNumber: 'DESC' },
      take: 1,
    });
    return lastFile.length > 0 ? lastFile[0].fileNumber + 1 : 1;
  }

  async uploadFiles(
    files: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>,
  ): Promise<File[]> {
    // Use transaction with PostgreSQL advisory lock to prevent race condition
    // Advisory lock key: 12345 (arbitrary unique number for file upload)
    const LOCK_KEY = 12345;

    return await this.dataSource.transaction(async (manager) => {
      // Acquire advisory lock (blocks until lock is available)
      await manager.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);

      const uploadedFiles: File[] = [];
      const fileRepo = manager.getRepository(File);

      // Now safe to get next file number
      const lastFile = await fileRepo
        .createQueryBuilder('file')
        .orderBy('file.fileNumber', 'DESC')
        .getOne();

      let nextNumber = lastFile ? lastFile.fileNumber + 1 : 1;

      for (const file of files) {
        const ext = file.originalname.split('.').pop() || '';
        const storagePath = `raw/${nextNumber}.${ext}`;

        await this.minioService.uploadFile(
          storagePath,
          file.buffer,
          file.mimetype,
        );

        const fileEntity = fileRepo.create({
          fileNumber: nextNumber,
          originalName: file.originalname,
          storagePath,
          mimeType: file.mimetype,
          size: file.size,
        });

        const saved = await fileRepo.save(fileEntity);
        uploadedFiles.push(saved);
        nextNumber++;
      }

      return uploadedFiles;
      // Advisory lock automatically released when transaction commits
    });
  }

  async findAll(): Promise<File[]> {
    return this.fileRepository.find({
      order: { fileNumber: 'ASC' },
    });
  }

  async findAllPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    processed?: 'all' | 'true' | 'false';
  }): Promise<{
    files: File[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'DESC';
    const processed = params.processed || 'all';

    // Build query
    const queryBuilder = this.fileRepository.createQueryBuilder('file');

    // Filter by processed status
    if (processed === 'true') {
      queryBuilder.where('file.processed = :processed', { processed: true });
    } else if (processed === 'false') {
      queryBuilder.where('file.processed = :processed', { processed: false });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply sorting
    const orderColumn = sortBy === 'createdAt' ? 'file.createdAt' :
                       sortBy === 'fileNumber' ? 'file.fileNumber' :
                       sortBy === 'originalName' ? 'file.originalName' :
                       'file.createdAt';
    queryBuilder.orderBy(orderColumn, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const files = await queryBuilder.getMany();

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUnprocessed(): Promise<File[]> {
    return this.fileRepository.find({
      where: { processed: false },
      order: { fileNumber: 'ASC' },
    });
  }

  async markAsProcessed(id: number): Promise<void> {
    // Get file to check if it has editedPath
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // Cleanup editedPath if exists
    if (file.editedPath) {
      try {
        // Delete edited file from MinIO
        await this.minioService.deleteFile(file.editedPath);
      } catch (error) {
        // Log error but don't fail the processing
        console.error(`Failed to delete editedPath ${file.editedPath}:`, error.message);
      }
    }

    // Update file status and clear editedPath fields
    await this.fileRepository.update(id, {
      processed: true,
      processedAt: new Date(),
      editedPath: null,
      hasEdited: false,
    });
  }

  async findOne(id: number): Promise<File | null> {
    return this.fileRepository.findOne({ where: { id } });
  }

  async getFileCount(): Promise<number> {
    return this.fileRepository.count();
  }

  async getFileBuffer(storagePath: string): Promise<Buffer> {
    const exists = await this.minioService.fileExists(storagePath);
    if (!exists) {
      throw new Error(`File not found in storage: ${storagePath}`);
    }
    return this.minioService.getFile(storagePath);
  }

  async rotateImage(id: number, degrees: number): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new Error('File not found');
    }

    // Get the current file buffer
    const buffer = await this.getFileBuffer(file.storagePath);

    // Rotate the image using sharp
    const rotatedBuffer = await sharp(buffer)
      .rotate(degrees)
      .toBuffer();

    // Upload the rotated image back to MinIO (overwrite)
    await this.minioService.uploadFile(
      file.storagePath,
      rotatedBuffer,
      file.mimeType,
    );

    // Update file size in database
    await this.fileRepository.update(id, {
      size: rotatedBuffer.length,
    });

    return this.fileRepository.findOne({ where: { id } });
  }

  // ========== STAGE 00: REVIEW OPERATIONS ==========
  async markAsReviewed(id: number, isReviewed: boolean): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    file.isReviewed = isReviewed;
    file.reviewedAt = isReviewed ? new Date() : null;

    await this.fileRepository.save(file);

    return file;
  }

  async saveEditedImage(
    id: number,
    uploadedFile: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // Generate edited file path in raw_temp folder (same filename)
    const originalPath = file.storagePath; // e.g., "raw/123.jpeg"
    const pathParts = originalPath.split('/');
    const filename = pathParts[pathParts.length - 1]; // e.g., "123.jpeg"

    // Change folder to raw_temp
    const folder = pathParts[0]; // e.g., "raw"
    const editedFolder = `${folder}_temp`; // e.g., "raw_temp"

    // Keep same filename
    const editedPath = `${editedFolder}/${filename}`; // e.g., "raw_temp/123.jpeg"

    // Upload edited file to MinIO
    await this.minioService.uploadFile(
      editedPath,
      uploadedFile.buffer,
      uploadedFile.mimetype || 'image/jpeg',
    );

    // Update file record
    file.editedPath = editedPath;
    file.hasEdited = true;

    await this.fileRepository.save(file);

    return file;
  }

  async resetEditedImage(id: number): Promise<File> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    // Delete edited file from MinIO if exists
    if (file.editedPath) {
      try {
        await this.minioService.deleteFile(file.editedPath);
      } catch (err) {
        // Ignore if file doesn't exist in MinIO
        console.warn(`Failed to delete edited file ${file.editedPath}:`, err);
      }
    }

    // Reset database fields
    file.editedPath = null;
    file.hasEdited = false;

    await this.fileRepository.save(file);

    return file;
  }

  async deleteFile(id: number): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      return; // File not found - nothing to delete
    }

    // Check if file is in a group
    if (file.groupId !== null) {
      // File is part of a group - check if we should delete the whole group
      const filesInGroup = await this.fileRepository.count({
        where: { groupId: file.groupId },
      });

      if (filesInGroup === 1) {
        // Last file in group - delete the whole group (cascade deletes documents)
        await this.groupRepository.delete(file.groupId);
      } else {
        // Multiple files in group - just remove this file from group
        // Note: documents table handles this via CASCADE DELETE
      }
    }

    // Delete file from MinIO
    try {
      await this.minioService.deleteFile(file.storagePath);
    } catch (e) {
      // Ignore MinIO deletion errors (file might not exist)
    }

    // Delete file record from database
    await this.fileRepository.delete(id);
  }

  async clearAll(): Promise<void> {
    // NOTE: labeled_files are deleted via CASCADE when groups are deleted
    // Step 1: Get all files for MinIO deletion
    const files = await this.fileRepository.find();

    // Step 2: Delete files from MinIO
    for (const file of files) {
      try {
        await this.minioService.deleteFile(file.storagePath);
      } catch (e) {
        // Ignore deletion errors (file might not exist in MinIO)
      }
    }

    // Step 3: Delete all file records from database (must delete before groups due to FK)
    await this.fileRepository.clear();

    // Step 4: Delete all groups (cascade deletes labeled_files)
    await this.groupRepository
      .createQueryBuilder()
      .delete()
      .execute();
  }

  async resetProcessed(): Promise<number> {
    const result = await this.fileRepository.update(
      { processed: true },
      { processed: false, processedAt: null },
    );
    return result.affected || 0;
  }

  async validateAndCleanupStorage(): Promise<{
    removed: number;
    validated: number;
    orphanedLabelsRemoved: number;
    orphanedGroupsRemoved: number;
  }> {
    const allFiles = await this.fileRepository.find();
    let removedCount = 0;
    let validatedCount = 0;

    // Step 1: Validate files against MinIO
    const fileIdsToRemove: number[] = [];
    for (const file of allFiles) {
      const exists = await this.minioService.fileExists(file.storagePath);
      if (!exists) {
        // File not in MinIO - mark for removal
        fileIdsToRemove.push(file.id);
        removedCount++;
      } else {
        validatedCount++;
      }
    }

    // Step 2: Delete files that don't exist in MinIO
    if (fileIdsToRemove.length > 0) {
      await this.fileRepository
        .createQueryBuilder()
        .delete()
        .whereInIds(fileIdsToRemove)
        .execute();
    }

    // NOTE: labeled_files cleanup is handled via CASCADE DELETE when groups are deleted
    const orphanedLabelsRemoved = 0;

    // Step 3: Cleanup orphaned groups (groups without any files)
    const allGroups = await this.groupRepository.find();
    const orphanedGroupIds: number[] = [];

    for (const group of allGroups) {
      const fileCount = await this.fileRepository.count({
        where: { groupId: group.id },
      });
      if (fileCount === 0) {
        orphanedGroupIds.push(group.id);
      }
    }

    const orphanedGroupsRemoved = orphanedGroupIds.length;
    if (orphanedGroupsRemoved > 0) {
      // This will cascade delete labeled_files
      await this.groupRepository
        .createQueryBuilder()
        .delete()
        .whereInIds(orphanedGroupIds)
        .execute();
    }

    return {
      removed: removedCount,
      validated: validatedCount,
      orphanedLabelsRemoved,
      orphanedGroupsRemoved,
    };
  }

  // ========== STAGE 02: GROUPING OPERATIONS ==========

  async createGroup(): Promise<Group> {
    const group = this.groupRepository.create({
      isComplete: false,
      isAutoLabeled: false,
    });
    return this.groupRepository.save(group);
  }

  async updateFileGrouping(fileId: number, data: {
    groupId: number | null;
    orderInGroup: number | null;
    ocrText: string;
    isBookmark: boolean;
  }): Promise<File> {
    await this.fileRepository.update(fileId, data);
    return this.fileRepository.findOne({ where: { id: fileId } });
  }

  async findByGroup(groupId: number): Promise<File[]> {
    return this.fileRepository.find({
      where: { groupId },
      order: { orderInGroup: 'ASC' },
    });
  }

  async getGroupCount(): Promise<number> {
    return this.groupRepository.count();
  }

  async getGroupMetadata(
    userId?: number,
    userRole?: string,
  ): Promise<
    Array<{
      groupId: number;
      fileCount: number;
      isComplete: boolean;
      completedAt: Date | null;
      isAutoLabeled: boolean;
      labeledAt: Date | null;
      createdAt: Date;
      lockedBy: number | null;
      lockedByName: string | null;
      lockedAt: Date | null;
    }>
  > {
    const groups = await this.groupRepository.find({
      order: { id: 'ASC' },
    });

    const result = [];
    for (const group of groups) {
      // ✅ Filter logic: Hide groups locked by other users (except for admins)
      if (
        group.lockedBy && // Group is locked
        userRole !== 'admin' && // User is not admin
        group.lockedBy !== userId // Not locked by current user
      ) {
        // Skip this group (hide from list)
        continue;
      }

      const fileCount = await this.fileRepository.count({
        where: { groupId: group.id },
      });

      // Fetch locked user info if locked
      let lockedByName: string | null = null;
      if (group.lockedBy) {
        const lockedUser = await this.dataSource
          .getRepository('users')
          .findOne({
            where: { id: group.lockedBy },
            select: ['name'],
          });
        lockedByName = lockedUser?.name || null;
      }

      result.push({
        groupId: group.id,
        fileCount,
        isComplete: group.isComplete,
        completedAt: group.completedAt,
        isAutoLabeled: group.isAutoLabeled,
        labeledAt: group.labeledAt,
        createdAt: group.createdAt,
        lockedBy: group.lockedBy,
        lockedByName,
        lockedAt: group.lockedAt,
      });
    }

    return result;
  }

  async getGroupsReadyToLabel(): Promise<number[]> {
    const groups = await this.groupRepository.find({
      where: { isComplete: true, isAutoLabeled: false },
      order: { id: 'ASC' },
    });
    return groups.map(g => g.id);
  }

  async getGroupsReadyToParseData(): Promise<number[]> {
    // Get groups that are auto-labeled but not yet parsed
    const groups = await this.groupRepository.find({
      where: { isAutoLabeled: true, isParseData: false },
      order: { id: 'ASC' },
    });
    return groups.map(g => g.id);
  }

  async findGroupById(groupId: number): Promise<Group | null> {
    return await this.groupRepository.findOne({
      where: { id: groupId },
    });
  }

  async getFileIdsInCompleteGroups(): Promise<number[]> {
    const groupedFiles = await this.fileRepository
      .createQueryBuilder('f')
      .select('f.id')
      .where('f.groupId IS NOT NULL')
      .getMany();

    return groupedFiles.map(f => f.id);
  }

  async markGroupComplete(groupId: number): Promise<void> {
    await this.groupRepository.update(groupId, {
      isComplete: true,
      completedAt: new Date(),
    });

    // Emit GROUP_COMPLETE event
    this.emitEvent({
      type: 'GROUP_COMPLETE',
      groupId,
      timestamp: new Date().toISOString(),
    });
  }

  async markGroupLabeled(groupId: number): Promise<void> {
    await this.groupRepository.update(groupId, {
      isAutoLabeled: true,
      labeledAt: new Date(),
    });
  }

  async markGroupParseData(groupId: number): Promise<void> {
    await this.groupRepository.update(groupId, {
      isParseData: true,
      parseDataAt: new Date(),
    });
  }

  async updateGroupParseData(
    groupId: number,
    data: {
      foundationInstrument?: any;
      committeeMembers?: any;
    } | null,
  ): Promise<void> {
    // Only update status (data is now stored in separate tables)
    await this.groupRepository.update(groupId, {
      isParseData: true,
      parseDataAt: new Date(),
    });
  }

  async resetGroupParseData(groupId?: number): Promise<void> {
    if (groupId) {
      await this.groupRepository.update(groupId, {
        isParseData: false,
        parseDataAt: null,
        foundationInstrument: null,
        committeeMembers: null,
      });
    } else {
      // Reset all groups
      await this.groupRepository
        .createQueryBuilder()
        .update()
        .set({
          isParseData: false,
          parseDataAt: null,
          foundationInstrument: null,
          committeeMembers: null,
        })
        .execute();
    }
  }

  async clearIncompleteGroups(): Promise<void> {
    // Find incomplete groups
    const incompleteGroups = await this.groupRepository.find({
      where: { isComplete: false },
    });

    if (incompleteGroups.length === 0) return;

    const groupIds = incompleteGroups.map(g => g.id);

    // Clear files in ALL incomplete groups (use In operator for multiple IDs)
    await this.fileRepository.update(
      { groupId: In(groupIds) },
      { groupId: null, orderInGroup: null, ocrText: null, isBookmark: false }
    );

    // Now safe to delete incomplete groups (no files reference them)
    await this.groupRepository.delete({ isComplete: false });
  }

  async clearGroupedFiles(): Promise<void> {
    // NOTE: labeled_files are deleted via CASCADE when groups are deleted in Step 3

    // Step 1: Clear grouping info from files (but keep the raw files)
    await this.fileRepository
      .createQueryBuilder()
      .update()
      .set({
        groupId: null,
        orderInGroup: null,
        ocrText: null,
        isBookmark: false,
        processed: false,
        processedAt: null,
      })
      .execute();

    // Step 2: Delete all groups (cascade deletes labeled_files + clears Step 4 parsed data)
    await this.groupRepository
      .createQueryBuilder()
      .delete()
      .execute();
  }

  async getGroupById(groupId: number): Promise<Group | null> {
    return this.groupRepository.findOne({ where: { id: groupId } });
  }

  async getParsedGroups(): Promise<Array<{
    groupId: number;
    fileCount: number;
    parseDataAt: Date | null;
    hasFoundationInstrument: boolean;
    committeeCount: number;
    isParseDataReviewed: boolean;
    parseDataReviewer: string | null;
    lockedBy: number | null;
    lockedByName: string | null;
    lockedAt: Date | null;
  }>> {
    const groups = await this.groupRepository.find({
      where: { isParseData: true },
      relations: ['foundationInstrument', 'committeeMembers', 'lockedByUser'],
      order: { parseDataAt: 'DESC' },
    });

    const result = [];
    for (const group of groups) {
      const fileCount = await this.fileRepository.count({
        where: { groupId: group.id },
      });

      result.push({
        groupId: group.id,
        fileCount,
        parseDataAt: group.parseDataAt,
        hasFoundationInstrument: !!group.foundationInstrument,
        committeeCount: group.committeeMembers?.length || 0,
        isParseDataReviewed: group.isParseDataReviewed,
        parseDataReviewer: group.parseDataReviewer,
        lockedBy: group.lockedBy,
        lockedByName: group.lockedByUser?.name || null,
        lockedAt: group.lockedAt,
      });
    }

    return result;
  }

  async getParsedGroupDetail(groupId: number): Promise<{
    group: Group;
    foundationInstrument: any;
    committeeMembers: any[];
  } | null> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, isParseData: true },
      relations: [
        'foundationInstrument',
        'foundationInstrument.charterSections',
        'foundationInstrument.charterSections.articles',
        'foundationInstrument.charterSections.articles.subItems',
        'committeeMembers',
      ],
    });

    if (!group) return null;

    // Sort charter sections, articles, and sub-items by orderIndex
    if (group.foundationInstrument?.charterSections) {
      group.foundationInstrument.charterSections.sort((a, b) => a.orderIndex - b.orderIndex);

      for (const section of group.foundationInstrument.charterSections) {
        if (section.articles) {
          section.articles.sort((a, b) => a.orderIndex - b.orderIndex);

          for (const article of section.articles) {
            if (article.subItems) {
              article.subItems.sort((a, b) => a.orderIndex - b.orderIndex);
            }
          }
        }
      }
    }

    // Sort committee members by orderIndex
    if (group.committeeMembers) {
      group.committeeMembers.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    return {
      group,
      foundationInstrument: group.foundationInstrument,
      committeeMembers: group.committeeMembers || [],
    };
  }

  async updateParsedData(
    groupId: number,
    data: {
      foundationInstrument?: {
        name: string;
        shortName: string;
        address: string;
        logoDescription: string;
        charterSections: any[];
      } | null;
      committeeMembers?: any[] | null;
    },
  ): Promise<void> {
    // This method is for updating parsed data from UI
    // Since we use parse-runner to generate data, this is for manual corrections only
    // For now, we'll just log that this endpoint is called
    // Full implementation would require updating all related tables
    throw new Error('Manual update of parsed data is not yet implemented. Use re-parse instead.');
  }

  async markExtractDataReviewed(
    groupId: number,
    reviewer: string,
    notes?: string,
    userId?: number,
  ): Promise<{ success: boolean; message: string }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, isParseData: true },
    });

    if (!group) {
      return {
        success: false,
        message: `Group ${groupId} not found or not parsed yet`,
      };
    }

    await this.groupRepository.update(
      { id: groupId },
      {
        isParseDataReviewed: true,
        parseDataReviewer: reviewer,
        extractDataNotes: notes || null,
      },
    );

    // Log the review action
    await this.activityLogsService.create({
      userId,
      userName: reviewer,
      action: ActivityAction.REVIEW,
      entityType: ActivityEntityType.GROUP,
      entityId: groupId,
      groupId,
      stage: ActivityStage.STAGE_04_EXTRACT,
      description: `Reviewed and approved extracted data${notes ? `: ${notes}` : ''}`,
    });

    return {
      success: true,
      message: `Group ${groupId} marked as extract data reviewed by ${reviewer}`,
    };
  }

  async updateParsedGroupData(
    groupId: number,
    data: {
      foundationInstrument?: any;
      committeeMembers?: any;
      districtOffice?: string | null;
      registrationNumber?: string | null;
    },
    userId?: number,
    userName?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const groupRepo = manager.getRepository(Group);
      const foundationRepo = manager.getRepository(FoundationInstrument);

      // Update Group-level fields (districtOffice, registrationNumber)
      if (data.districtOffice !== undefined || data.registrationNumber !== undefined) {
        const group = await groupRepo.findOne({ where: { id: groupId } });
        if (group) {
          if (data.districtOffice !== undefined) {
            group.districtOffice = data.districtOffice;
          }
          if (data.registrationNumber !== undefined) {
            group.registrationNumber = data.registrationNumber;
          }
          await groupRepo.save(group);
        }
      }
      const sectionRepo = manager.getRepository(CharterSection);
      const articleRepo = manager.getRepository(CharterArticle);
      const subItemRepo = manager.getRepository(CharterSubItem);
      const memberRepo = manager.getRepository(CommitteeMember);

      // Update Foundation Instrument
      if (data.foundationInstrument) {
        const existingFI = await foundationRepo.findOne({
          where: { groupId },
          relations: ['charterSections', 'charterSections.articles', 'charterSections.articles.subItems'],
        });

        if (existingFI) {
          // Update basic fields
          existingFI.name = data.foundationInstrument.name;
          existingFI.shortName = data.foundationInstrument.shortName;
          existingFI.address = data.foundationInstrument.address;
          existingFI.logoDescription = data.foundationInstrument.logoDescription;
          if (data.foundationInstrument.isCancelled !== undefined) {
            existingFI.isCancelled = data.foundationInstrument.isCancelled;
          }

          // Delete all existing nested relations
          for (const section of existingFI.charterSections || []) {
            for (const article of section.articles || []) {
              if (article.subItems) {
                await subItemRepo.remove(article.subItems);
              }
            }
            if (section.articles) {
              await articleRepo.remove(section.articles);
            }
          }
          if (existingFI.charterSections) {
            await sectionRepo.remove(existingFI.charterSections);
          }

          // Create new charter sections with articles and sub-items
          const newSections = [];
          for (const sectionData of data.foundationInstrument.charterSections || []) {
            const section = sectionRepo.create({
              foundationInstrumentId: existingFI.id,
              number: sectionData.number,
              title: sectionData.title,
              orderIndex: sectionData.orderIndex,
            });
            const savedSection = await sectionRepo.save(section);

            // Create articles
            for (const articleData of sectionData.articles || []) {
              const article = articleRepo.create({
                charterSectionId: savedSection.id,
                number: articleData.number,
                content: articleData.content,
                orderIndex: articleData.orderIndex,
              });
              const savedArticle = await articleRepo.save(article);

              // Create sub-items
              for (const subItemData of articleData.subItems || []) {
                const subItem = subItemRepo.create({
                  charterArticleId: savedArticle.id,
                  number: subItemData.number,
                  content: subItemData.content,
                  orderIndex: subItemData.orderIndex,
                });
                await subItemRepo.save(subItem);
              }
            }

            newSections.push(savedSection);
          }

          existingFI.charterSections = newSections;
          await foundationRepo.save(existingFI);
        }
      }

      // Update Committee Members
      if (data.committeeMembers) {
        // Delete all existing members for this group
        await memberRepo.delete({ groupId });

        // Create new members
        for (const memberData of data.committeeMembers) {
          const member = memberRepo.create({
            groupId,
            name: memberData.name,
            address: memberData.address,
            phone: memberData.phone,
            position: memberData.position,
            orderIndex: memberData.orderIndex,
          });
          await memberRepo.save(member);
        }
      }
    });

    // Log the update after transaction completes
    if (userId || userName) {
      const changes: string[] = [];
      if (data.foundationInstrument) changes.push('Foundation Instrument');
      if (data.committeeMembers) changes.push('Committee Members');
      if (data.districtOffice !== undefined) changes.push('District Office');
      if (data.registrationNumber !== undefined) changes.push('Registration Number');

      await this.activityLogsService.create({
        userId,
        userName: userName || 'Unknown User',
        action: ActivityAction.UPDATE,
        entityType: ActivityEntityType.GROUP,
        entityId: groupId,
        groupId,
        stage: ActivityStage.STAGE_04_EXTRACT,
        description: `Updated extracted data: ${changes.join(', ')}`,
      });
    }
  }

  async reorderGroupFiles(
    groupId: number,
    reorderedFiles: Array<{ id: number; newOrder: number }>,
  ): Promise<void> {
    // Use transaction to ensure all updates succeed or fail together
    await this.dataSource.transaction(async (manager) => {
      const fileRepo = manager.getRepository(File);

      // Validate that all files belong to the group
      const fileIds = reorderedFiles.map(f => f.id);
      const files = await fileRepo
        .createQueryBuilder('file')
        .where('file.id IN (:...ids)', { ids: fileIds })
        .andWhere('file.groupId = :groupId', { groupId })
        .getMany();

      if (files.length !== reorderedFiles.length) {
        throw new Error('Some files do not belong to this group');
      }

      // Update orderInGroup for each file
      for (const { id, newOrder } of reorderedFiles) {
        await fileRepo.update(id, { orderInGroup: newOrder });
      }

      // NOTE: labeled_files orderInGroup is managed by labeled-files module
    });
  }

  async uploadGroupLogo(groupId: number, imageData: string): Promise<string> {
    // Find the group
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Parse base64 image data
    // Format: data:image/png;base64,xxxxx or data:image/jpeg;base64,xxxxx
    const matches = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data format');
    }

    const imageType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate storage path
    const ext = imageType === 'jpg' ? 'jpeg' : imageType;
    const storagePath = `logos/group-${groupId}-logo.${ext}`;

    // Delete old logo if exists
    if (group.logoUrl) {
      try {
        await this.minioService.deleteFile(group.logoUrl);
      } catch (e) {
        // Ignore deletion errors
      }
    }

    // Upload to MinIO
    await this.minioService.uploadFile(storagePath, buffer, `image/${ext}`);

    // Update group with logo URL
    group.logoUrl = storagePath;
    await this.groupRepository.save(group);

    return storagePath;
  }

  // ========== STAGE 05: FINAL REVIEW METHODS ==========

  async getFinalReviewGroups(status: 'pending' | 'approved' | 'all') {
    const queryBuilder = this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.files', 'files')
      .leftJoinAndSelect('group.foundationInstrument', 'foundationInstrument')
      .leftJoinAndSelect('group.committeeMembers', 'committeeMembers')
      .where('group.isLabeledReviewed = :labelReviewed', { labelReviewed: true })
      .andWhere('group.isParseDataReviewed = :parseReviewed', { parseReviewed: true });

    // Apply status filter
    if (status === 'pending') {
      queryBuilder.andWhere('group.isFinalApproved = :approved', { approved: false });
    } else if (status === 'approved') {
      queryBuilder.andWhere('group.isFinalApproved = :approved', { approved: true });
    }
    // 'all' doesn't add any additional filter

    queryBuilder.orderBy('group.id', 'ASC');

    const groups = await queryBuilder.getMany();

    // NOTE: labeled_files stats are calculated in labeled-files module
    // Use group.files for page count here
    const groupsWithStats = groups.map((group) => {
      return {
        groupId: group.id,
        totalPages: group.files.length,

        // Stage 03 data - match percentage not available here (use labeled-files API)
        labelMatchPercentage: 0,
        isLabeledReviewed: group.isLabeledReviewed,
        labeledReviewer: group.labeledReviewer,

        // Stage 04 data
        hasFoundationInstrument: !!group.foundationInstrument,
        committeeCount: group.committeeMembers?.length || 0,
        isParseDataReviewed: group.isParseDataReviewed,
        parseDataReviewer: group.parseDataReviewer,
        parseDataAt: group.parseDataAt,

        // Stage 05 data
        isFinalApproved: group.isFinalApproved,
        finalReviewer: group.finalReviewer,
        finalApprovedAt: group.finalApprovedAt,
      };
    });

    return groupsWithStats;
  }

  async getFinalReviewGroupDetail(groupId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: [
        'files',
        'foundationInstrument',
        'foundationInstrument.charterSections',
        'foundationInstrument.charterSections.articles',
        'foundationInstrument.charterSections.articles.subItems',
        'committeeMembers'
      ],
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // NOTE: labeled_files data should be fetched from labeled-files module API
    // This method returns only group-level data without labeled_files details
    const totalPages = group.files.length;

    // Sort charter sections, articles, and sub-items by orderIndex
    if (group.foundationInstrument?.charterSections) {
      group.foundationInstrument.charterSections.sort((a, b) => a.orderIndex - b.orderIndex);

      for (const section of group.foundationInstrument.charterSections) {
        if (section.articles) {
          section.articles.sort((a, b) => a.orderIndex - b.orderIndex);

          for (const article of section.articles) {
            if (article.subItems) {
              article.subItems.sort((a, b) => a.orderIndex - b.orderIndex);
            }
          }
        }
      }
    }

    // Sort committee members by orderIndex
    if (group.committeeMembers) {
      group.committeeMembers.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    return {
      groupId: group.id,

      // Stage 03 - Basic info only (use labeled-files API for full details)
      stage03: {
        totalPages,
        matchedPages: 0,
        unmatchedPages: 0,
        matchPercentage: 0,
        documents: [],
        labeledFiles: [],
        isReviewed: group.isLabeledReviewed,
        reviewer: group.labeledReviewer,
        reviewedAt: group.labeledAt,
      },

      // Stage 04 - Full detail
      stage04: {
        hasFoundationInstrument: !!group.foundationInstrument,
        foundationData: group.foundationInstrument || null,
        committeeCount: group.committeeMembers?.length || 0,
        committeeMembers: group.committeeMembers || [],
        isReviewed: group.isParseDataReviewed,
        reviewer: group.parseDataReviewer,
        parseDataAt: group.parseDataAt,
      },

      // Stage 05 status
      stage05: {
        isFinalApproved: group.isFinalApproved,
        finalReviewer: group.finalReviewer,
        finalApprovedAt: group.finalApprovedAt,
        finalReviewNotes: group.finalReviewNotes,
      },

      // Group metadata
      metadata: {
        districtOffice: group.districtOffice,
        registrationNumber: group.registrationNumber,
        logoUrl: group.logoUrl,
      },
    };
  }

  async approveFinalReview(
    groupId: number,
    reviewerName: string,
    notes?: string,
    userId?: number,
  ) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Verify prerequisites
    if (!group.isLabeledReviewed) {
      throw new BadRequestException('Group must be reviewed in Stage 03 first');
    }

    if (!group.isParseDataReviewed) {
      throw new BadRequestException('Group must be reviewed in Stage 04 first');
    }

    // Update group
    group.isFinalApproved = true;
    group.finalApprovedAt = new Date();
    group.finalReviewer = reviewerName;
    group.finalReviewNotes = notes || null;

    await this.groupRepository.save(group);

    // Log the final approval
    await this.activityLogsService.create({
      userId,
      userName: reviewerName,
      action: ActivityAction.APPROVE,
      entityType: ActivityEntityType.GROUP,
      entityId: groupId,
      groupId,
      stage: ActivityStage.STAGE_05_REVIEW,
      description: `Final approval completed${notes ? `: ${notes}` : ''}`,
    });

    return {
      groupId: group.id,
      isFinalApproved: group.isFinalApproved,
      finalReviewer: group.finalReviewer,
      finalApprovedAt: group.finalApprovedAt,
      finalReviewNotes: group.finalReviewNotes,
    };
  }

  // ========== GROUP LOCKING METHODS ==========

  /**
   * Lock a group for editing
   * @throws ConflictException if group is already locked by another user
   */
  async lockGroup(
    groupId: number,
    userId: number,
  ): Promise<{ lockedBy: number; lockedAt: Date }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if already locked by another user
    if (group.lockedBy && group.lockedBy !== userId) {
      // Check if lock is expired (30 minutes)
      const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      const lockAge = Date.now() - group.lockedAt.getTime();

      if (lockAge < LOCK_TIMEOUT_MS) {
        // Still locked, fetch user name
        const lockedUser = await this.dataSource
          .getRepository('users')
          .findOne({
            where: { id: group.lockedBy },
            select: ['name', 'email'],
          });

        throw new ConflictException({
          message: 'Group is locked by another user',
          lockedBy: group.lockedBy,
          lockedByName: lockedUser?.name || 'Unknown User',
          lockedAt: group.lockedAt,
        });
      }

      // Lock expired, can take over
      console.log(
        `Lock expired for group ${groupId}, taking over from user ${group.lockedBy}`,
      );
    }

    // Lock the group
    group.lockedBy = userId;
    group.lockedAt = new Date();
    await this.groupRepository.save(group);

    // Broadcast lock event via SSE
    this.eventSubject.next({
      type: 'GROUP_LOCKED',
      groupId,
      lockedBy: userId,
      lockedAt: group.lockedAt,
    });

    return {
      lockedBy: group.lockedBy,
      lockedAt: group.lockedAt,
    };
  }

  /**
   * Unlock a group
   * Only the user who locked it can unlock (or force unlock for admins)
   */
  async unlockGroup(groupId: number, userId: number): Promise<void> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only allow unlock if user owns the lock
    if (group.lockedBy && group.lockedBy !== userId) {
      throw new ForbiddenException('You do not own this lock');
    }

    // Unlock
    group.lockedBy = null;
    group.lockedAt = null;
    await this.groupRepository.save(group);

    // Broadcast unlock event via SSE
    this.eventSubject.next({
      type: 'GROUP_UNLOCKED',
      groupId,
      unlockedBy: userId,
    });
  }

  /**
   * Renew group lock (heartbeat)
   * Extends the lock timeout
   */
  async renewGroupLock(groupId: number, userId: number): Promise<void> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only allow renew if user owns the lock
    if (!group.lockedBy || group.lockedBy !== userId) {
      throw new ForbiddenException('You do not own this lock');
    }

    // Renew lock timestamp
    group.lockedAt = new Date();
    await this.groupRepository.save(group);
  }

  // ========== CHARTER REORDER OPERATIONS ==========

  /**
   * Reorder charter sections
   */
  async reorderCharterSections(items: Array<{ id: number; orderIndex: number }>): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sectionRepo = manager.getRepository(CharterSection);

      for (const item of items) {
        await sectionRepo.update(item.id, { orderIndex: item.orderIndex });
      }
    });
  }

  /**
   * Reorder charter articles within a section
   */
  async reorderCharterArticles(items: Array<{ id: number; orderIndex: number }>): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const articleRepo = manager.getRepository(CharterArticle);

      for (const item of items) {
        await articleRepo.update(item.id, { orderIndex: item.orderIndex });
      }
    });
  }

  /**
   * Reorder charter sub items within an article
   */
  async reorderCharterSubItems(items: Array<{ id: number; orderIndex: number }>): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const subItemRepo = manager.getRepository(CharterSubItem);

      for (const item of items) {
        await subItemRepo.update(item.id, { orderIndex: item.orderIndex });
      }
    });
  }
}
