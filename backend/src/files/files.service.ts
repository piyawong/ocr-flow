import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between } from 'typeorm';
import { Subject } from 'rxjs';
import * as sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { File } from './file.entity';
import { Group } from './group.entity';
import { FoundationInstrument } from './foundation-instrument.entity';
import { CharterSection } from './charter-section.entity';
import { CharterArticle } from './charter-article.entity';
import { CharterSubItem } from './charter-sub-item.entity';
import { CommitteeMember } from './committee-member.entity';
import { Document } from '../labeled-files/document.entity';
import { MinioService } from '../minio/minio.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityEntityType,
  ActivityStage,
} from '../activity-logs/activity-log.entity';

export interface FileEvent {
  type: 'GROUP_COMPLETE' | 'GROUP_CREATED' | 'GROUP_LOCKED' | 'GROUP_UNLOCKED' | 'GROUP_PARSED' | 'GROUP_REVIEWED' | 'FINAL_REVIEW_03_UPDATED' | 'FINAL_REVIEW_04_UPDATED' | 'PORTAL_UPLOAD_SUCCESS' | 'PORTAL_UPLOAD_FAILED' | 'AUTO_PORTAL_UPLOAD_SUCCESS' | 'AUTO_PORTAL_UPLOAD_FAILED';
  groupId?: number;
  lockedBy?: number;
  lockedAt?: Date;
  unlockedBy?: number;
  reviewer?: string;
  timestamp?: string;
  status?: 'approved' | 'rejected' | 'pending';
  stage?: '03' | '04';
  portalOrganizationId?: string;
  error?: string;
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
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private minioService: MinioService,
    public dataSource: DataSource, // ⭐ public สำหรับ transaction ใน TaskRunnerService
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
      where: {
        processed: false,
        isReviewed: true,  // ⭐ หยิบเฉพาะไฟล์ที่ reviewed แล้ว (จาก Stage 00)
      },
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

    // Update file status and clear editedPath (keep hasEdited = true)
    await this.fileRepository.update(id, {
      processed: true,
      processedAt: new Date(),
      editedPath: null,
      // ⭐ ไม่ reset hasEdited - เก็บไว้เพื่อบอกว่าไฟล์นี้เคย edited
    });
  }

  // ========== OCR QUEUE MANAGEMENT (Database-backed Queue) ==========

  /**
   * ⭐ หางาน OCR ถัดไปจาก queue (with Transaction + Advisory Lock)
   *
   * Logic:
   * 1. หาไฟล์ที่ยัง processed=false
   * 2. และ (ocrProcessing=false OR timeout เกิน 10 นาที)
   * 3. Sort by ocrFailedCount ASC (ไฟล์ที่ fail น้อยกว่าได้ priority)
   * 4. Lock ด้วย pg_advisory_xact_lock (ป้องกัน race condition)
   * 5. Update ocrProcessing=true, ocrStartedAt=now()
   *
   * Returns: File object พร้อม storagePath, editedPath
   */
  async getNextOcrJob(): Promise<File | null> {
    const OCR_LOCK_KEY = 99999; // Advisory lock key for OCR queue
    const OCR_TIMEOUT_MINUTES = 10; // ถือว่า stuck ถ้าเกิน 10 นาที

    return await this.dataSource.transaction(async (manager) => {
      // Acquire advisory lock (blocks until lock is available)
      await manager.query('SELECT pg_advisory_xact_lock($1)', [OCR_LOCK_KEY]);

      // Find next file to OCR (ต้อง reviewed ก่อนถึงจะ OCR ได้)
      const file = await manager
        .getRepository(File)
        .createQueryBuilder('file')
        .where('file.processed = false')
        .andWhere('file.isReviewed = true')
        .andWhere(
          `(file.ocrProcessing = false OR file.ocrStartedAt < NOW() - INTERVAL '${OCR_TIMEOUT_MINUTES} minutes')`
        )
        .orderBy('file.fileNumber', 'ASC') // เรียงตาม fileNumber เท่านั้น
        .getOne();

      if (!file) {
        return null; // ไม่มีงาน
      }

      // Lock this file (mark as processing)
      await manager.getRepository(File).update(file.id, {
        ocrProcessing: true,
        ocrStartedAt: new Date(),
      });

      return file;
    });
  }

  /**
   * ⭐ Mark OCR สำเร็จ
   * หลัง OCR เสร็จ จะลบ edited file และ clear editedPath (ใช้เฉพาะตอน OCR เท่านั้น)
   */
  async markOcrCompleted(
    fileId: number,
    ocrText: string,
    isBookmark: boolean,
  ): Promise<void> {
    // Get file to check if has edited image
    const file = await this.fileRepository.findOne({ where: { id: fileId } });

    // Delete edited file from MinIO if exists (editedPath ใช้เฉพาะตอน OCR เท่านั้น)
    if (file?.editedPath) {
      try {
        await this.minioService.deleteFile(file.editedPath);
      } catch (error) {
        console.error(`Failed to delete edited file after OCR: ${file.editedPath}`, error.message);
        // Continue even if delete fails
      }
    }

    await this.fileRepository.update(fileId, {
      processed: true,
      processedAt: new Date(),
      ocrProcessing: false,
      ocrCompletedAt: new Date(),
      ocrText,
      isBookmark,
      // Reset error state
      lastOcrError: null,
      // Clear edited file info (ใช้เฉพาะตอน OCR เท่านั้น)
      editedPath: null,
      hasEdited: false,
    });
  }

  /**
   * ⭐ Mark OCR ล้มเหลว (เพิ่ม failed count, unlock สำหรับ retry)
   */
  async markOcrFailed(fileId: number, error: string): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id: fileId } });
    if (!file) return;

    await this.fileRepository.update(fileId, {
      ocrProcessing: false, // Unlock สำหรับ retry
      ocrFailedCount: file.ocrFailedCount + 1,
      lastOcrError: error.substring(0, 1000), // เก็บ error message (limit 1000 chars)
    });
  }

  /**
   * ⭐ Reset jobs ที่ค้างไว้เกิน timeout (crashed worker)
   * เรียกตอน startup
   */
  async resetStuckOcrJobs(): Promise<number> {
    const OCR_TIMEOUT_MINUTES = 10;

    const result = await this.fileRepository
      .createQueryBuilder()
      .update(File)
      .set({ ocrProcessing: false })
      .where('ocrProcessing = true')
      .andWhere(
        `ocrStartedAt < NOW() - INTERVAL '${OCR_TIMEOUT_MINUTES} minutes'`
      )
      .execute();

    return result.affected || 0;
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
    // All groups are created as complete, so just check for unlabeled groups
    const groups = await this.groupRepository.find({
      where: { isAutoLabeled: false },
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

  /**
   * ⭐ NEW: หา BOOKMARK files ทั้งหมดที่ OCR เสร็จแล้ว (sorted by fileNumber)
   * ใช้สำหรับ BOOKMARK-based Grouping
   */
  async findBookmarks(): Promise<File[]> {
    return this.fileRepository.find({
      where: {
        processed: true,
        isBookmark: true,
      },
      order: { fileNumber: 'ASC' },
    });
  }

  /**
   * ⭐ NEW: หาไฟล์ระหว่าง start และ end (ไม่รวม BOOKMARK)
   * ใช้สำหรับสร้าง group จากช่วงระหว่าง BOOKMARK
   */
  async findFilesBetween(startFileNumber: number, endFileNumber: number): Promise<File[]> {
    return this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileNumber > :start', { start: startFileNumber })
      .andWhere('file.fileNumber < :end', { end: endFileNumber })
      .andWhere('file.isBookmark = false')  // ไม่เอา BOOKMARK files
      .orderBy('file.fileNumber', 'ASC')
      .getMany();
  }

  /**
   * ⭐ NEW: เช็คว่า group ที่ครอบคลุมไฟล์ใน range นี้ถูกสร้างแล้วหรือยัง
   * ใช้สำหรับป้องกันการสร้าง group ซ้ำ
   */
  async findGroupByRange(startFileNumber: number, endFileNumber: number): Promise<Group | null> {
    // หาไฟล์ใดก็ได้ใน range ที่มี groupId แล้ว
    const file = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.fileNumber > :start', { start: startFileNumber })
      .andWhere('file.fileNumber < :end', { end: endFileNumber })
      .andWhere('file.groupId IS NOT NULL')
      .getOne();

    if (!file?.groupId) {
      return null;
    }

    return this.groupRepository.findOne({ where: { id: file.groupId } });
  }

  /**
   * ⭐ นับไฟล์ที่ยังไม่ processed (รอ OCR)
   * ใช้สำหรับตัดสินใจว่ามีไฟล์รอ OCR อยู่หรือไม่
   */
  async countUnprocessedFiles(): Promise<number> {
    return this.fileRepository.count({
      where: { processed: false },
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


  async clearGroupedFiles(): Promise<void> {
    // NOTE: labeled_files are deleted via CASCADE when groups are deleted in Step 3

    // Step 0: Delete edited images from MinIO (Stage 00 revert)
    const filesWithEdits = await this.fileRepository.find({
      where: { hasEdited: true },
      select: ['id', 'editedPath'],
    });

    for (const file of filesWithEdits) {
      if (file.editedPath) {
        try {
          await this.minioService.deleteFile(file.editedPath);
        } catch (error) {
          console.error(`Failed to delete edited image: ${file.editedPath}`, error);
          // Continue even if delete fails
        }
      }
    }

    // Step 1: Clear ALL file data (grouping + Stage 00 review status)
    await this.fileRepository
      .createQueryBuilder()
      .update()
      .set({
        // Stage 00: Review status (REVERT UPLOAD STAGE)
        isReviewed: false,
        reviewedAt: null,
        editedPath: null,
        hasEdited: false,
        // Stage 01-02: Grouping info
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

  async getParsedGroups(
    userId?: number,
    userRole?: string,
  ): Promise<Array<{
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
    finalReview04: 'pending' | 'approved' | 'rejected';
    finalReview04Reviewer: string | null;
    finalReview04ReviewedAt: Date | null;
    extractDataNotes: string | null;
    finalReview04Notes: string | null;
  }>> {
    console.log('🔑 getParsedGroups called with:', {
      userId,
      userRole,
    });

    const groups = await this.groupRepository.find({
      where: { isParseData: true },
      relations: ['foundationInstrument', 'committeeMembers', 'lockedByUser'],
      order: { parseDataAt: 'DESC' },
      select: ['id', 'parseDataAt', 'isParseDataReviewed', 'parseDataReviewer', 'parseDataReviewerId', 'lockedBy', 'lockedAt', 'finalReview04', 'finalReview04Reviewer', 'finalReview04ReviewedAt', 'extractDataNotes', 'finalReview04Notes'],
    });

    console.log(`📦 Total parsed groups found: ${groups.length}`);

    const result = [];
    for (const group of groups) {
      // Filter logic (same as Stage 03):
      // 1. Admin → show all groups
      // 2. Non-admin → show unreviewed groups + groups reviewed by this user
      if (group.isParseDataReviewed) {
        // Group is already reviewed
        if (userRole === 'admin') {
          // Admin: show all reviewed groups
          console.log(`✅ Group ${group.id}: Including (admin, reviewed)`);
        } else {
          // Non-admin: show only if reviewed by this user
          if (group.parseDataReviewerId !== userId) {
            console.log(`⏭️  Group ${group.id}: Skipped (reviewed by another user, reviewerId=${group.parseDataReviewerId}, currentUserId=${userId})`);
            continue; // ❌ Skip - other user reviewed
          } else {
            console.log(`✅ Group ${group.id}: Including (reviewed by current user)`);
          }
        }
      }

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
        finalReview04: group.finalReview04 || 'pending',
        finalReview04Reviewer: group.finalReview04Reviewer || null,
        finalReview04ReviewedAt: group.finalReview04ReviewedAt || null,
        extractDataNotes: group.extractDataNotes || null,
        finalReview04Notes: group.finalReview04Notes || null,
      });
    }

    console.log(`📊 Returning ${result.length} groups to user ${userId}`);
    return result;
  }

  async getStage03Stats(): Promise<{
    totalGroups: number;
    pendingReview: number;
    reviewed: number;
    finalApproved: number;
    finalRejected: number;
    finalPending: number;
  }> {
    // Total groups that are labeled (from Stage 02)
    const totalGroups = await this.groupRepository.count({
      where: { isAutoLabeled: true },
    });

    // Pending review (not reviewed yet)
    const pendingReview = await this.groupRepository.count({
      where: { isAutoLabeled: true, isLabeledReviewed: false },
    });

    // Reviewed (Stage 03 done)
    const reviewed = await this.groupRepository.count({
      where: { isAutoLabeled: true, isLabeledReviewed: true },
    });

    // Final review: Approved
    const finalApproved = await this.groupRepository.count({
      where: { isAutoLabeled: true, finalReview03: 'approved' },
    });

    // Final review: Rejected
    const finalRejected = await this.groupRepository.count({
      where: { isAutoLabeled: true, finalReview03: 'rejected' },
    });

    // Final review: Pending (only count if already reviewed in Stage 03)
    const finalPending = await this.groupRepository.count({
      where: {
        isAutoLabeled: true,
        isLabeledReviewed: true,  // ต้อง reviewed แล้ว
        finalReview03: 'pending'  // และยังไม่ได้ final review
      },
    });

    return {
      totalGroups,
      pendingReview,
      reviewed,
      finalApproved,
      finalRejected,
      finalPending,
    };
  }

  async getStage04Stats(): Promise<{
    totalGroups: number;
    pendingReview: number;
    reviewed: number;
    finalApproved: number;
    finalRejected: number;
    finalPending: number;
  }> {
    // Total groups that are parsed (from Stage 03)
    const totalGroups = await this.groupRepository.count({
      where: { isParseData: true },
    });

    // Pending review (not reviewed yet)
    const pendingReview = await this.groupRepository.count({
      where: { isParseData: true, isParseDataReviewed: false },
    });

    // Reviewed (Stage 04 done)
    const reviewed = await this.groupRepository.count({
      where: { isParseData: true, isParseDataReviewed: true },
    });

    // Final review: Approved
    const finalApproved = await this.groupRepository.count({
      where: { isParseData: true, finalReview04: 'approved' },
    });

    // Final review: Rejected
    const finalRejected = await this.groupRepository.count({
      where: { isParseData: true, finalReview04: 'rejected' },
    });

    // Final review: Pending
    const finalPending = await this.groupRepository.count({
      where: { isParseData: true, finalReview04: 'pending' },
    });

    return {
      totalGroups,
      pendingReview,
      reviewed,
      finalApproved,
      finalRejected,
      finalPending,
    };
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
        parseDataReviewerId: userId || null,
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
    console.log('🔍 getFinalReviewGroups called with status:', status);
    const queryBuilder = this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.files', 'files')
      .leftJoinAndSelect('group.foundationInstrument', 'foundationInstrument')
      .leftJoinAndSelect('group.committeeMembers', 'committeeMembers')
      .where('group.isLabeledReviewed = :labelReviewed', { labelReviewed: true })
      .andWhere('group.isParseDataReviewed = :parseReviewed', { parseReviewed: true });

    // Apply status filter (based on finalReview03 and finalReview04)
    if (status === 'pending') {
      // Pending = อย่างน้อย 1 ใน 2 ยัง pending หรือ rejected
      // Use CAST to text to avoid enum comparison error
      queryBuilder.andWhere(
        '(CAST(group.finalReview03 AS TEXT) != :approved OR CAST(group.finalReview04 AS TEXT) != :approved)',
        { approved: 'approved' }
      );
    } else if (status === 'approved') {
      // Approved = ทั้ง 03 และ 04 ต้อง approved
      // Use CAST to text to avoid enum comparison error
      queryBuilder
        .andWhere('CAST(group.finalReview03 AS TEXT) = :approved', { approved: 'approved' })
        .andWhere('CAST(group.finalReview04 AS TEXT) = :approved', { approved: 'approved' });
    }
    // 'all' doesn't add any additional filter

    queryBuilder.orderBy('group.id', 'ASC');

    const groups = await queryBuilder.getMany();

    // NOTE: labeled_files stats are calculated in labeled-files module
    // Use group.files for page count here
    const groupsWithStats = groups.map((group) => {
      // Calculate if fully approved (both 03 and 04 must be approved)
      const isFinalApproved =
        group.finalReview03 === 'approved' &&
        group.finalReview04 === 'approved';

      // Use latest reviewer (prefer 04 if exists, fallback to 03)
      const finalReviewer = group.finalReview04Reviewer || group.finalReview03Reviewer || null;

      // Use latest approved timestamp (prefer 04 if exists, fallback to 03)
      const finalApprovedAt = group.finalReview04ReviewedAt || group.finalReview03ReviewedAt || null;

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

        // Stage 05 data (split 03 and 04)
        finalReview03: group.finalReview03 || 'pending',
        finalReview03Reviewer: group.finalReview03Reviewer || null,
        finalReview03ReviewedAt: group.finalReview03ReviewedAt || null,
        finalReview04: group.finalReview04 || 'pending',
        finalReview04Reviewer: group.finalReview04Reviewer || null,
        finalReview04ReviewedAt: group.finalReview04ReviewedAt || null,

        // Combined final approval status (for Frontend compatibility)
        isFinalApproved,
        finalReviewer,
        finalApprovedAt,

        // Portal upload status (for Stage 06)
        portalOrganizationId: group.portalOrganizationId || null,
        portalUploadedAt: group.portalUploadedAt || null,
        portalLogoUploaded: group.portalLogoUploaded || false,
        portalDocumentsUploaded: group.portalDocumentsUploaded || false,
      };
    });

    console.log('📊 Returning groups count:', groupsWithStats.length);
    console.log('📋 Groups:', groupsWithStats.map(g => ({ id: g.groupId, isFinalApproved: g.isFinalApproved })));
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
        remarks: group.labeledNotes || null, // ⭐ Remarks from Stage 03 review
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
        remarks: group.extractDataNotes || null, // ⭐ Remarks from Stage 04 review
      },

      // Stage 05 status (split 03 and 04)
      stage05: {
        finalReview03: group.finalReview03 || 'pending',
        finalReview03Reviewer: group.finalReview03Reviewer || null,
        finalReview03ReviewedAt: group.finalReview03ReviewedAt || null,
        finalReview03Notes: group.finalReview03Notes || null,
        finalReview04: group.finalReview04 || 'pending',
        finalReview04Reviewer: group.finalReview04Reviewer || null,
        finalReview04ReviewedAt: group.finalReview04ReviewedAt || null,
        finalReview04Notes: group.finalReview04Notes || null,
      },

      // Group metadata
      metadata: {
        districtOffice: group.districtOffice,
        registrationNumber: group.registrationNumber,
        logoUrl: group.logoUrl,
      },
    };
  }

  async reviewStage03(
    groupId: number,
    status: 'approved' | 'rejected',
    reviewerName: string,
    userId: number,
    notes?: string,
  ) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Verify prerequisite
    if (!group.isLabeledReviewed) {
      throw new BadRequestException('Group must be reviewed in Stage 03 first');
    }

    // Update group
    group.finalReview03 = status;
    group.finalReview03ReviewedAt = new Date();
    group.finalReview03Reviewer = reviewerName;
    group.finalReview03ReviewerId = userId;
    group.finalReview03Notes = notes || null;

    await this.groupRepository.save(group);

    // Log the review
    await this.activityLogsService.create({
      userId,
      userName: reviewerName,
      action: status === 'approved' ? ActivityAction.APPROVE : ActivityAction.REJECT,
      entityType: ActivityEntityType.GROUP,
      entityId: groupId,
      groupId,
      stage: ActivityStage.STAGE_05_REVIEW,
      description: `Stage 03 (PDF Labels) ${status}${notes ? `: ${notes}` : ''}`,
    });

    // Emit real-time event for Stage 03 review update
    this.emitEvent({
      type: 'FINAL_REVIEW_03_UPDATED',
      groupId,
      reviewer: reviewerName,
      status,
      stage: '03',
      timestamp: new Date().toISOString(),
    });

    // Auto-upload to Portal if both stages are approved
    if (status === 'approved') {
      await this.autoUploadToPortalIfFullyApproved(groupId, userId, reviewerName);
    }

    return {
      groupId: group.id,
      finalReview03: group.finalReview03,
      finalReview03Reviewer: group.finalReview03Reviewer,
      finalReview03ReviewedAt: group.finalReview03ReviewedAt,
    };
  }

  async reviewStage04(
    groupId: number,
    status: 'approved' | 'rejected',
    reviewerName: string,
    userId: number,
    notes?: string,
  ) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Verify prerequisite
    if (!group.isParseDataReviewed) {
      throw new BadRequestException('Group must be reviewed in Stage 04 first');
    }

    // Update group
    group.finalReview04 = status;
    group.finalReview04ReviewedAt = new Date();
    group.finalReview04Reviewer = reviewerName;
    group.finalReview04ReviewerId = userId;
    group.finalReview04Notes = notes || null;

    await this.groupRepository.save(group);

    // Log the review
    await this.activityLogsService.create({
      userId,
      userName: reviewerName,
      action: status === 'approved' ? ActivityAction.APPROVE : ActivityAction.REJECT,
      entityType: ActivityEntityType.GROUP,
      entityId: groupId,
      groupId,
      stage: ActivityStage.STAGE_05_REVIEW,
      description: `Stage 04 (Extract Data) ${status}${notes ? `: ${notes}` : ''}`,
    });

    // Emit real-time event for Stage 04 review update
    this.emitEvent({
      type: 'FINAL_REVIEW_04_UPDATED',
      groupId,
      reviewer: reviewerName,
      status,
      stage: '04',
      timestamp: new Date().toISOString(),
    });

    // Auto-upload to Portal if both stages are approved
    if (status === 'approved') {
      await this.autoUploadToPortalIfFullyApproved(groupId, userId, reviewerName);
    }

    return {
      groupId: group.id,
      finalReview04: group.finalReview04,
      finalReview04Reviewer: group.finalReview04Reviewer,
      finalReview04ReviewedAt: group.finalReview04ReviewedAt,
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

  // ========== STAGE 06: UPLOAD TO PORTAL ==========

  /**
   * Transform group data to Portal API format
   */
  async transformToPortalFormat(groupId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: [
        'files',
        'foundationInstrument',
        'foundationInstrument.charterSections',
        'foundationInstrument.charterSections.articles',
        'foundationInstrument.charterSections.articles.subItems',
        'committeeMembers',
      ],
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Check if group is fully approved
    if (group.finalReview03 !== 'approved' || group.finalReview04 !== 'approved') {
      throw new BadRequestException('Group must be approved in both Stage 03 and Stage 04');
    }

    const foundation = group.foundationInstrument;

    // Transform charter sections with nested articles and subItems
    const charterSections = foundation?.charterSections
      ?.sort((a, b) => a.orderIndex - b.orderIndex)
      .map((section, sectionIndex) => ({
        number: section.number,
        title: section.title,
        sortOrder: sectionIndex + 1,
        articles: section.articles
          ?.sort((a, b) => a.orderIndex - b.orderIndex)
          .map((article, articleIndex) => ({
            number: article.number,
            content: article.content,
            sortOrder: articleIndex + 1,
            subItems: article.subItems
              ?.sort((a, b) => a.orderIndex - b.orderIndex)
              .map((subItem, subIndex) => ({
                number: subItem.number,
                content: subItem.content,
                sortOrder: subIndex + 1,
              })) || [],
          })) || [],
      })) || [];

    // Transform committee members
    const committeeMembers = group.committeeMembers
      ?.sort((a, b) => a.orderIndex - b.orderIndex)
      .map((member, index) => ({
        name: member.name,
        address: member.address || null,
        phone: member.phone || null,
        position: member.position || null,
        sortOrder: index + 1,
      })) || [];

    // Build Portal API payload
    const portalPayload = {
      name: foundation?.name || `Group ${groupId}`,
      type: 'มูลนิธิ',
      isCancelled: foundation?.isCancelled || false,
      shortName: foundation?.shortName || null,
      address: foundation?.address || null,
      registrationNumber: group.registrationNumber || null,
      districtOffice: group.districtOffice || null,
      logoDescription: foundation?.logoDescription || null,
      charterSections,
      committeeMembers,
    };

    return {
      groupId,
      portalPayload,
      summary: {
        foundationName: foundation?.name,
        charterSectionsCount: charterSections.length,
        totalArticles: charterSections.reduce((sum, s) => sum + s.articles.length, 0),
        committeeMembersCount: committeeMembers.length,
      },
    };
  }

  /**
   * Upload group data to Portal API
   */
  async uploadToPortal(
    groupId: number,
    userId: number,
    userName: string,
  ) {
    // Get Portal API URL from environment
    const portalBaseUrl = process.env.PORTAL_API_URL;
    if (!portalBaseUrl) {
      throw new BadRequestException('PORTAL_API_URL is not configured in environment');
    }

    // Get transformed data
    const { portalPayload, summary } = await this.transformToPortalFormat(groupId);

    console.log(`📤 Uploading Group ${groupId} to Portal: ${portalBaseUrl}`);
    console.log(`📊 Summary:`, summary);
    console.log(`🔑 Registration Number: ${portalPayload.registrationNumber || 'N/A'}`);

    try {
      // Call Portal API to upsert organization (create or update based on registrationNumber)
      const response = await fetch(`${portalBaseUrl}/organizations/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portalPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Portal API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const action = result._isNew ? 'Created' : 'Updated';
      console.log(`✅ Successfully ${action.toLowerCase()} Group ${groupId} in Portal. Organization ID: ${result.id}`);

      // Update group with portal organization ID
      const group = await this.groupRepository.findOne({ where: { id: groupId } });
      if (group) {
        group.portalOrganizationId = result.id;
        group.portalUploadedAt = new Date();
        await this.groupRepository.save(group);
      }

      // Log the upload activity
      const isNew = result._isNew === true;
      await this.activityLogsService.create({
        userId,
        userName,
        action: ActivityAction.UPLOAD,
        entityType: ActivityEntityType.GROUP,
        entityId: groupId,
        groupId,
        stage: ActivityStage.STAGE_06_UPLOAD,
        description: `${isNew ? 'Created' : 'Updated'} in Portal. Organization ID: ${result.id}`,
      });

      // Emit real-time event
      this.emitEvent({
        type: 'PORTAL_UPLOAD_SUCCESS',
        groupId,
        portalOrganizationId: result.id,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        groupId,
        portalOrganizationId: result.id,
        isNew,
        summary,
        portalResponse: result,
      };
    } catch (error) {
      console.error(`❌ Failed to upload Group ${groupId} to Portal:`, error);

      // Log the failed upload
      await this.activityLogsService.create({
        userId,
        userName,
        action: ActivityAction.UPLOAD,
        entityType: ActivityEntityType.GROUP,
        entityId: groupId,
        groupId,
        stage: ActivityStage.STAGE_06_UPLOAD,
        description: `Upload failed: ${error.message}`,
      });

      // Emit error event
      this.emitEvent({
        type: 'PORTAL_UPLOAD_FAILED',
        groupId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw new BadRequestException(`Failed to upload to Portal: ${error.message}`);
    }
  }

  /**
   * Preview data that will be uploaded to Portal (without actually uploading)
   */
  async previewPortalUpload(groupId: number) {
    return this.transformToPortalFormat(groupId);
  }

  /**
   * Upload logo to Portal API
   */
  async uploadLogoToPortal(
    groupId: number,
    userId: number,
    userName: string,
  ) {
    const portalBaseUrl = process.env.PORTAL_API_URL;
    if (!portalBaseUrl) {
      throw new BadRequestException('PORTAL_API_URL is not configured in environment');
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Check if group has registrationNumber (required for upsert)
    if (!group.registrationNumber) {
      throw new BadRequestException('Group must have registrationNumber to upload logo to Portal');
    }

    // Check if group has logo
    if (!group.logoUrl) {
      return {
        success: true,
        groupId,
        registrationNumber: group.registrationNumber,
        message: 'No logo to upload',
        skipped: true,
      };
    }

    console.log(`📤 Uploading logo for Group ${groupId} to Portal (Registration: ${group.registrationNumber})`);
    console.log(`📁 Logo path: ${group.logoUrl}`);

    try {
      // Get the logo file from MinIO
      const logoBuffer = await this.minioService.getFile(group.logoUrl);

      // Detect content type from file extension
      const logoPath = group.logoUrl.toLowerCase();
      let contentType = 'image/png';
      let filename = 'logo.png';

      if (logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
        filename = 'logo.jpg';
      } else if (logoPath.endsWith('.gif')) {
        contentType = 'image/gif';
        filename = 'logo.gif';
      } else if (logoPath.endsWith('.webp')) {
        contentType = 'image/webp';
        filename = 'logo.webp';
      }

      console.log(`📦 Content-Type: ${contentType}, Filename: ${filename}, Size: ${logoBuffer.length} bytes`);

      // Create FormData using native Node.js 18+ FormData with Blob
      // Convert Buffer to Uint8Array for TypeScript compatibility
      const uint8Array = new Uint8Array(logoBuffer);
      const blob = new Blob([uint8Array], { type: contentType });
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('registrationNumber', group.registrationNumber);

      // Upload logo to Portal API using upsert endpoint (uses registrationNumber as key)
      const response = await fetch(`${portalBaseUrl}/organizations/upsert-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Portal API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Update group status and portalOrganizationId if not set
      group.portalLogoUploaded = true;
      if (result.id && !group.portalOrganizationId) {
        group.portalOrganizationId = result.id;
      }
      await this.groupRepository.save(group);

      // Log the upload
      await this.activityLogsService.create({
        userId,
        userName,
        action: ActivityAction.UPLOAD,
        entityType: ActivityEntityType.GROUP,
        entityId: groupId,
        groupId,
        stage: ActivityStage.STAGE_06_UPLOAD,
        description: `Logo uploaded to Portal (Registration: ${group.registrationNumber})`,
      });

      console.log(`✅ Logo uploaded for Group ${groupId} (Registration: ${group.registrationNumber})`);
      console.log(`📷 Logo storage path: ${result.logoStoragePath}`);

      return {
        success: true,
        groupId,
        registrationNumber: group.registrationNumber,
        portalOrganizationId: result.id,
        logoStoragePath: result.logoStoragePath,
        message: 'Logo uploaded successfully',
      };
    } catch (error) {
      console.error(`❌ Failed to upload logo for Group ${groupId}:`, error);
      throw new BadRequestException(`Failed to upload logo: ${error.message}`);
    }
  }

  /**
   * Upload documents to Portal API
   * - Merges JPEG pages into PDFs based on document labels
   * - Creates folder structure based on category
   * - Names files as {templateName}-{date}.pdf or {templateName}.pdf
   */
  async uploadDocumentsToPortal(
    groupId: number,
    userId: number,
    userName: string,
  ) {
    const portalBaseUrl = process.env.PORTAL_API_URL;
    if (!portalBaseUrl) {
      throw new BadRequestException('PORTAL_API_URL is not configured in environment');
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['files'],
    });

    if (!group) {
      throw new NotFoundException(`Group ${groupId} not found`);
    }

    // Check if registrationNumber exists (required for Portal)
    if (!group.registrationNumber) {
      throw new BadRequestException('Group must have registrationNumber to upload documents to Portal');
    }

    // Get all documents for this group
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { documentNumber: 'ASC' },
    });

    if (documents.length === 0) {
      return {
        success: true,
        groupId,
        registrationNumber: group.registrationNumber,
        message: 'No documents to upload',
        skipped: true,
      };
    }

    console.log(`📤 Uploading ${documents.length} documents for Group ${groupId} to Portal`);
    console.log(`📁 Registration Number: ${group.registrationNumber}`);

    try {
      const uploadedDocs = [];
      const failedDocs = [];
      const folderCache: Record<string, string> = {}; // category -> folderId

      // Get portal organization ID (if exists) or find by registrationNumber
      let portalOrgId = group.portalOrganizationId;
      if (!portalOrgId) {
        // Try to find organization by registrationNumber
        const searchRes = await fetch(`${portalBaseUrl}/organizations?search=${encodeURIComponent(group.registrationNumber)}`);
        if (searchRes.ok) {
          const orgs = await searchRes.json();
          const matchingOrg = orgs.find((o: any) => o.registrationNumber === group.registrationNumber);
          if (matchingOrg) {
            portalOrgId = matchingOrg.id;
          }
        }
      }

      if (!portalOrgId) {
        throw new BadRequestException('Organization not found in Portal. Please upload data first.');
      }

      for (const doc of documents) {
        try {
          console.log(`📄 Processing document ${doc.documentNumber}: ${doc.templateName} (pages ${doc.startPage}-${doc.endPage})`);

          // Get files for this document (orderInGroup between startPage and endPage)
          const docFiles = group.files
            .filter(f => !f.isBookmark && f.orderInGroup >= doc.startPage && f.orderInGroup <= doc.endPage)
            .sort((a, b) => a.orderInGroup - b.orderInGroup);

          if (docFiles.length === 0) {
            console.warn(`⚠️ No files found for document ${doc.documentNumber}`);
            continue;
          }

          // Create PDF from JPEG pages
          const pdfDoc = await PDFDocument.create();

          for (const file of docFiles) {
            try {
              // Get image from MinIO
              const imageBuffer = await this.minioService.getFile(file.storagePath);

              // Embed image in PDF (detect format)
              let image;
              const path = file.storagePath.toLowerCase();
              if (path.endsWith('.png')) {
                image = await pdfDoc.embedPng(imageBuffer);
              } else {
                // Default to JPEG
                image = await pdfDoc.embedJpg(imageBuffer);
              }

              // Add page with image dimensions
              const page = pdfDoc.addPage([image.width, image.height]);
              page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height,
              });
            } catch (imgError) {
              console.error(`❌ Failed to embed image ${file.storagePath}:`, imgError.message);
            }
          }

          // Generate PDF bytes
          const pdfBytes = await pdfDoc.save();

          // Generate filename: {templateName}-{date}.pdf or {templateName}.pdf
          let filename = doc.templateName || `document-${doc.documentNumber}`;
          if (doc.documentDate) {
            const dateStr = new Date(doc.documentDate).toISOString().split('T')[0]; // YYYY-MM-DD
            filename = `${filename}-${dateStr}`;
          }
          filename = `${filename}.pdf`;

          console.log(`📎 Generated PDF: ${filename} (${pdfBytes.length} bytes, ${docFiles.length} pages)`);

          // Create folder if category exists and not cached
          let parentId: string | null = null;
          if (doc.category && doc.category.trim()) {
            const category = doc.category.trim();
            if (!folderCache[category]) {
              // Create folder in Portal
              const folderRes = await fetch(`${portalBaseUrl}/organizations/${portalOrgId}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  organizationId: portalOrgId,
                  name: category,
                  parentId: null,
                }),
              });

              if (folderRes.ok) {
                const folderData = await folderRes.json();
                folderCache[category] = folderData.id;
                console.log(`📁 Created folder: ${category} (${folderData.id})`);
              } else {
                // Folder might already exist, try to list and find it
                const listRes = await fetch(`${portalBaseUrl}/organizations/${portalOrgId}/documents`);
                if (listRes.ok) {
                  const items = await listRes.json();
                  const existingFolder = items.find((item: any) => item.isFolder && item.name === category);
                  if (existingFolder) {
                    folderCache[category] = existingFolder.id;
                    console.log(`📁 Found existing folder: ${category} (${existingFolder.id})`);
                  }
                }
              }
            }
            parentId = folderCache[category] || null;
          }

          // Upload PDF to Portal
          const uint8Array = new Uint8Array(pdfBytes);
          const blob = new Blob([uint8Array], { type: 'application/pdf' });
          const formData = new FormData();
          formData.append('file', blob, filename);
          if (parentId) {
            formData.append('parentId', parentId);
          }

          const uploadRes = await fetch(`${portalBaseUrl}/organizations/${portalOrgId}/documents`, {
            method: 'POST',
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            uploadedDocs.push({
              documentNumber: doc.documentNumber,
              templateName: doc.templateName,
              filename,
              pageCount: docFiles.length,
              portalDocumentId: uploadData.id,
              folderId: parentId,
            });
            console.log(`✅ Uploaded: ${filename}`);
          } else {
            const errorText = await uploadRes.text();
            failedDocs.push({
              documentNumber: doc.documentNumber,
              templateName: doc.templateName,
              error: `Upload failed: ${uploadRes.status} - ${errorText}`,
            });
            console.error(`❌ Failed to upload ${filename}: ${uploadRes.status}`);
          }
        } catch (docError) {
          failedDocs.push({
            documentNumber: doc.documentNumber,
            templateName: doc.templateName,
            error: docError.message,
          });
          console.error(`❌ Failed to process document ${doc.documentNumber}:`, docError.message);
        }
      }

      // Update group status
      group.portalDocumentsUploaded = failedDocs.length === 0 && uploadedDocs.length > 0;
      if (!group.portalOrganizationId && portalOrgId) {
        group.portalOrganizationId = portalOrgId;
      }
      await this.groupRepository.save(group);

      // Log the upload
      await this.activityLogsService.create({
        userId,
        userName,
        action: ActivityAction.UPLOAD,
        entityType: ActivityEntityType.GROUP,
        entityId: groupId,
        groupId,
        stage: ActivityStage.STAGE_06_UPLOAD,
        description: `${uploadedDocs.length}/${documents.length} documents uploaded to Portal as PDFs`,
      });

      console.log(`✅ Documents uploaded for Group ${groupId}: ${uploadedDocs.length}/${documents.length}`);

      return {
        success: failedDocs.length === 0,
        groupId,
        registrationNumber: group.registrationNumber,
        portalOrganizationId: portalOrgId,
        message: `${uploadedDocs.length}/${documents.length} documents uploaded`,
        uploadedCount: uploadedDocs.length,
        failedCount: failedDocs.length,
        uploadedDocs,
        failedDocs,
        foldersCreated: Object.keys(folderCache),
      };
    } catch (error) {
      console.error(`❌ Failed to upload documents for Group ${groupId}:`, error);
      throw new BadRequestException(`Failed to upload documents: ${error.message}`);
    }
  }

  /**
   * Auto-upload to Portal when both Stage 03 and 04 are approved
   * Called from reviewStage03 and reviewStage04
   * Uploads: 1) Data, 2) Logo, 3) Documents
   */
  async autoUploadToPortalIfFullyApproved(
    groupId: number,
    userId: number,
    userName: string,
  ) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      return null;
    }

    // Check if both stages are approved
    if (group.finalReview03 === 'approved' && group.finalReview04 === 'approved') {
      // Skip if already uploaded
      if (group.portalOrganizationId) {
        console.log(`⏭️ Group ${groupId} already uploaded to Portal (${group.portalOrganizationId})`);
        return { skipped: true, groupId, portalOrganizationId: group.portalOrganizationId };
      }

      console.log(`✅ Group ${groupId} fully approved, auto-uploading to Portal...`);

      try {
        // 1. Upload Data (creates organization in Portal)
        const dataResult = await this.uploadToPortal(groupId, userId, userName);
        console.log(`✅ Data uploaded for Group ${groupId}`);

        // 2. Upload Logo (if exists)
        try {
          await this.uploadLogoToPortal(groupId, userId, userName);
          console.log(`✅ Logo uploaded for Group ${groupId}`);
        } catch (logoError) {
          console.warn(`⚠️ Logo upload failed for Group ${groupId}:`, logoError.message);
        }

        // 3. Upload Documents
        try {
          await this.uploadDocumentsToPortal(groupId, userId, userName);
          console.log(`✅ Documents uploaded for Group ${groupId}`);
        } catch (docsError) {
          console.warn(`⚠️ Documents upload failed for Group ${groupId}:`, docsError.message);
        }

        // Emit success event
        this.emitEvent({
          type: 'AUTO_PORTAL_UPLOAD_SUCCESS',
          groupId,
          portalOrganizationId: dataResult.portalOrganizationId,
          timestamp: new Date().toISOString(),
        });

        return dataResult;
      } catch (error) {
        console.error(`❌ Auto-upload failed for Group ${groupId}:`, error);

        // Emit error event
        this.emitEvent({
          type: 'AUTO_PORTAL_UPLOAD_FAILED',
          groupId,
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        return null;
      }
    }

    return null;
  }
}
