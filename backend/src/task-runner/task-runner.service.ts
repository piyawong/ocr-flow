import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from '../files/files.service';
import { ReplaySubject } from 'rxjs';

export interface LogMessage {
  timestamp: string;
  thread: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

// ⭐ ลบ TaskQueue และ OcrResult - ใช้ Database แทน

@Injectable()
export class TaskRunnerService {
  private apiKeys: string[] = [];
  private ocrServiceUrl: string;
  private isRunning = false;
  private logSubject = new ReplaySubject<LogMessage>(100);
  private logHistory: LogMessage[] = [];
  private readonly MAX_LOGS = 500;

  constructor(
    private configService: ConfigService,
    private filesService: FilesService,
  ) {
    // OCR Service URL (Python microservice)
    this.ocrServiceUrl = this.configService.get('OCR_SERVICE_URL', 'http://localhost:8000');

    // API Keys (all 16 keys - sent as array to OCR service for multi-key load balancing)
    this.apiKeys = [
      this.configService.get('TYPHOON_OCR_API_KEY_1', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_2', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_3', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_4', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_5', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_6', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_7', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_8', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_9', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_10', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_11', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_12', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_13', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_14', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_15', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_16', ''),
    ].filter((key) => key.length > 0);
  }

  getLogObservable() {
    return this.logSubject.asObservable();
  }

  getLogHistory(): LogMessage[] {
    return this.logHistory;
  }

  clearLogs() {
    this.logHistory = [];
  }

  isTaskRunning(): boolean {
    return this.isRunning;
  }

  private log(thread: number, message: string, type: LogMessage['type'] = 'info') {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      thread,
      message,
      type,
    };
    this.logSubject.next(logMessage);
    this.logHistory.push(logMessage);

    // Keep only last MAX_LOGS entries
    if (this.logHistory.length > this.MAX_LOGS) {
      this.logHistory = this.logHistory.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Call Python OCR microservice.
   *
   * The Python service uses typhoon-ocr library with:
   * - Multi-key load balancing (4 API keys per worker)
   * - figure_language="Thai" (Thai language optimization)
   * - task_type="v1.5" (faster, single-prompt architecture)
   * - Multi-Scale OCR + PaddleOCR + 2-Step LLM Ensemble
   *
   * @param imageBuffer - Image data as Buffer
   * @param apiKeys - Array of API keys (4 keys per worker)
   * @returns OCR text result
   */
  private async callOcrService(
    imageBuffer: Buffer,
    apiKeys: string[],
  ): Promise<string> {
    const base64Image = imageBuffer.toString('base64');

    // ⭐ ขยาย timeout เป็น 5 นาที (300,000ms) สำหรับไฟล์ใหญ่
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    try {
      const response = await fetch(`${this.ocrServiceUrl}/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64Image,
          api_key: apiKeys,  // Send worker-specific keys (4 keys) for multi-key load balancing
          task_type: 'v1.5',        // Faster, single-prompt architecture
          figure_language: 'Thai',   // Thai language optimization
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR Service error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`OCR failed: ${data.error || 'Unknown error'}`);
      }

      return data.text;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('OCR request timeout (5 minutes exceeded)');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isBookmarkText(text: string): boolean {
    // Simple check: มีคำว่า "BOOKMARK" อยู่ในข้อความหรือไม่
    const normalizedText = text.toUpperCase();
    return normalizedText.includes('BOOKMARK');
  }

  /**
   * ⭐ OCR Worker แบบใหม่ - Stateless, Database-backed Queue
   *
   * Logic:
   * 1. Loop ตลอดไป (ไม่หยุดเมื่อ retry ล้มเหลว)
   * 2. getNextOcrJob() จาก database (with lock)
   * 3. ไม่มีงาน → รอ 2 วินาที → loop ใหม่
   * 4. มีงาน → ทำ OCR (retry 3 ครั้ง)
   * 5. สำเร็จ → markOcrCompleted()
   * 6. ล้มเหลว → markOcrFailed() (unlock สำหรับ retry โดย worker อื่น)
   * 7. Loop ต่อ (ไม่หยุด worker)
   */
  private async runOcrWorker(
    threadNum: number,
    workerKeys: string[],
  ): Promise<void> {
    this.log(threadNum, `OCR Worker ${threadNum} started (Database queue)`, 'info');

    while (this.isRunning) {
      try {
        // ⭐ ดึงงานจาก database queue (with transaction + lock)
        const file = await this.filesService.getNextOcrJob();

        if (!file) {
          // ไม่มีงาน - รอ 2 วินาที แล้ว loop ใหม่
          await this.sleep(2000);
          continue;
        }

        // มีงาน - ทำ OCR (retry 3 ครั้ง)
        let lastError: Error | null = null;
        let success = false;
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (!this.isRunning) break;

          try {
            this.log(
              threadNum,
              `Processing file #${file.fileNumber}: ${file.originalName}${
                attempt > 1 ? ` (retry ${attempt}/${maxRetries})` : ''
              }${file.ocrFailedCount > 0 ? ` [prev fails: ${file.ocrFailedCount}]` : ''}`,
              'info',
            );

            const startTime = Date.now();

            // ⭐ Priority: Use editedPath if reviewed and edited (from Stage 00)
            const pathToOcr =
              file.isReviewed && file.editedPath
                ? file.editedPath
                : file.storagePath;
            const isUsingEditedPath = !!(file.isReviewed && file.editedPath);

            if (isUsingEditedPath) {
              this.log(
                threadNum,
                `Using edited image for #${file.fileNumber}`,
                'info',
              );
            }

            const buffer = await this.filesService.getFileBuffer(pathToOcr);
            const ocrText = await this.callOcrService(buffer, workerKeys);
            const isBookmark = this.isBookmarkText(ocrText);
            const elapsedSeconds = (Date.now() - startTime) / 1000;

            // ✅ สำเร็จ - mark completed
            await this.filesService.markOcrCompleted(
              file.id,
              ocrText,
              isBookmark,
            );

            this.log(
              threadNum,
              `✅ OCR complete for #${file.fileNumber} in ${elapsedSeconds.toFixed(2)}s${isBookmark ? ' [BOOKMARK DETECTED]' : ''}`,
              isBookmark ? 'warning' : 'success',
            );

            // Emit file processed event
            this.log(threadNum, `FILE_PROCESSED:${file.id}`, 'info');

            success = true;
            break; // ออกจาก retry loop
          } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
              this.log(
                threadNum,
                `⚠️ Error processing #${file.fileNumber}, retrying... (${error.message})`,
                'warning',
              );
              await this.sleep(1000 * attempt); // Backoff: 1s, 2s, 3s
            }
          }
        }

        // ❌ ล้มเหลบหลัง retry ครบ - mark failed (unlock สำหรับ worker อื่น retry)
        if (!success && lastError) {
          await this.filesService.markOcrFailed(file.id, lastError.message);
          this.log(
            threadNum,
            `❌ Failed to process #${file.fileNumber} after ${maxRetries} attempts (total fails: ${file.ocrFailedCount + 1}): ${lastError.message}`,
            'error',
          );
          this.log(
            threadNum,
            `🔄 File #${file.fileNumber} returned to queue for retry`,
            'warning',
          );
        }

        // ⭐ ไม่หยุด worker - loop ต่อเพื่อดึงงานถัดไป
      } catch (error) {
        // Unexpected error - log แล้ว loop ต่อ
        this.log(
          threadNum,
          `Unexpected error in OCR worker: ${error.message}`,
          'error',
        );
        await this.sleep(2000); // รอก่อน retry
      }
    }

    this.log(threadNum, `OCR Worker ${threadNum} stopped`, 'info');
  }

  /**
   * ⭐ NEW: BOOKMARK-based Grouping Worker
   *
   * Logic:
   * 1. หา BOOKMARK files ทั้งหมดที่ OCR เสร็จแล้ว (sorted by fileNumber)
   * 2. Process แบบ sequential pairs: [B1-B7], [B7-B12], ...
   * 3. สร้าง group จากไฟล์ระหว่าง BOOKMARK
   * 4. ถ้าไฟล์ใดยัง OCR ไม่เสร็จ → รอ (ห้ามข้าม)
   * 5. Last group (ไม่มี ending BOOKMARK) → auto-complete ถ้าไม่มีไฟล์รอ OCR
   */
  private async runGroupingWorker(): Promise<void> {
    this.log(0, `🔄 Grouping worker started (BOOKMARK-based)`, 'info');

    while (this.isRunning) {
      try {
        // 1️⃣ หา BOOKMARK ทั้งหมดที่ OCR เสร็จแล้ว (sorted)
        const bookmarks = await this.filesService.findBookmarks();

        if (bookmarks.length === 0) {
          this.log(0, `⏳ No BOOKMARKs found, waiting...`, 'info');
          await this.sleep(3000);
          continue;
        }

        const bookmarkNumbers = bookmarks.map(b => `#${b.fileNumber}`).join(', ');
        this.log(0, `📖 Found ${bookmarks.length} BOOKMARK(s): ${bookmarkNumbers}`, 'info');

        // 2️⃣ Process แบบ sequential pairs
        let groupsCreated = 0;
        for (let i = 0; i < bookmarks.length; i++) {
          if (!this.isRunning) break;

          const startBookmark = bookmarks[i];
          const endBookmark = bookmarks[i + 1] || null;

          this.log(
            0,
            `🔍 Processing pair: BOOKMARK #${startBookmark.fileNumber} → ${endBookmark ? `#${endBookmark.fileNumber}` : 'END'}`,
            'info',
          );

          // ถ้าไม่มี ending BOOKMARK → เช็คว่าไม่มี pending files
          if (!endBookmark) {
            const pendingCount = await this.filesService.countUnprocessedFiles();
            if (pendingCount > 0) {
              this.log(
                0,
                `⏳ Last group: waiting for ${pendingCount} file(s) to complete OCR`,
                'warning',
              );
              break; // ยังมีไฟล์รอ OCR → ข้าม group นี้ไปก่อน
            }
          }

          // 3️⃣ หาไฟล์ระหว่าง startBookmark ถึง endBookmark
          const startFileNumber = startBookmark.fileNumber;
          const endFileNumber = endBookmark?.fileNumber || 999999;

          const filesInRange = await this.filesService.findFilesBetween(
            startFileNumber,
            endFileNumber,
          );

          if (filesInRange.length === 0) {
            this.log(0, `ℹ️ No files between #${startFileNumber} and #${endFileNumber}`, 'info');
            continue;
          }

          const fileNumbersList = filesInRange.map(f => `#${f.fileNumber}`).join(', ');
          this.log(
            0,
            `📦 Found ${filesInRange.length} file(s) in range [${startFileNumber+1}...${endFileNumber-1}]: ${fileNumbersList}`,
            'info',
          );

          // 4️⃣ เช็คว่าไฟล์ทุกตัว OCR เสร็จหรือยัง
          const unprocessedFiles = filesInRange.filter(f => !f.processed);
          if (unprocessedFiles.length > 0) {
            const unprocessedList = unprocessedFiles.map(f => `#${f.fileNumber}`).join(', ');
            this.log(
              0,
              `⏳ Waiting for ${unprocessedFiles.length} file(s) to complete OCR: ${unprocessedList}`,
              'warning',
            );
            continue; // ยังมีไฟล์รอ OCR → ข้าม group นี้ไปก่อน (ห้ามข้าม BOOKMARK!)
          }

          // ✅ ทุกไฟล์ OCR เสร็จแล้ว
          this.log(
            0,
            `✓ All ${filesInRange.length} files in range [${startFileNumber+1}...${endFileNumber-1}] are processed`,
            'success',
          );

          // 5️⃣ เช็คว่า group นี้ถูกสร้างแล้วหรือยัง
          const existingGroup = await this.filesService.findGroupByRange(
            startFileNumber,
            endFileNumber,
          );

          if (existingGroup) {
            this.log(
              0,
              `✓ Group already exists (ID=${existingGroup.id}) for range [${startFileNumber+1}...${endFileNumber-1}]`,
              'info',
            );
            continue; // สร้างแล้ว → ข้าม
          }

          // 6️⃣ สร้าง group ใหม่ (with Transaction + Lock)
          await this.createGroupFromRange(
            filesInRange,
            startFileNumber,
            endFileNumber,
          );

          groupsCreated++;
          this.log(
            0,
            `✅ Group created for files [${startFileNumber+1}...${endFileNumber-1}] (${filesInRange.length} files)`,
            'success',
          );
        }

        if (groupsCreated === 0) {
          this.log(0, `⏳ No new groups created, waiting...`, 'info');
        }

        // รอสักครู่ก่อน loop รอบถัดไป
        await this.sleep(2000);
      } catch (error) {
        this.log(
          0,
          `Grouping worker error: ${error.message}`,
          'error',
        );
        await this.sleep(3000);
      }
    }

    this.log(0, `✅ Grouping worker stopped`, 'success');
  }

  /**
   * ⭐ NEW: สร้าง group จากไฟล์ระหว่าง BOOKMARK (with Transaction + Lock)
   */
  private async createGroupFromRange(
    filesInRange: any[],
    startFileNumber: number,
    endFileNumber: number,
  ): Promise<void> {
    const GROUPING_LOCK_KEY = 88888;

    await this.filesService.dataSource.transaction(async (manager) => {
      // Acquire advisory lock (ป้องกัน race condition)
      await manager.query('SELECT pg_advisory_xact_lock($1)', [GROUPING_LOCK_KEY]);

      // Double-check: เช็คว่า files ยังไม่ได้ group
      const alreadyGroupedCount = await manager
        .getRepository('files')
        .createQueryBuilder('file')
        .where('file.fileNumber > :start', { start: startFileNumber })
        .andWhere('file.fileNumber < :end', { end: endFileNumber })
        .andWhere('file.groupId IS NOT NULL')
        .getCount();

      if (alreadyGroupedCount > 0) {
        this.log(
          0,
          `⏭️ Some files already grouped, skipping range [${startFileNumber+1}...${endFileNumber-1}]`,
          'warning',
        );
        return;
      }

      // สร้าง group ใหม่ (created as complete atomically)
      const group = await manager.getRepository('groups').save({});

      // Assign ไฟล์ทั้งหมดเข้า group
      for (let i = 0; i < filesInRange.length; i++) {
        const file = filesInRange[i];
        await manager.getRepository('files').update(file.id, {
          groupId: group.id,
          orderInGroup: i + 1,
        });
      }

      this.log(
        0,
        `📦 Group ID=${group.id} created with ${filesInRange.length} files`,
        'success',
      );

      // Emit GROUP_COMPLETE event
      this.filesService.emitEvent({
        type: 'GROUP_COMPLETE',
        groupId: group.id,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async startTask(): Promise<void> {
    if (this.isRunning) {
      this.log(0, 'Task is already running', 'warning');
      return;
    }

    if (this.apiKeys.length === 0) {
      this.log(0, 'No API keys configured', 'error');
      return;
    }

    this.isRunning = true;
    this.log(0, '=== ∞ Infinite Worker Pool Started ===', 'info');
    this.log(0, `Using 4 OCR workers × 4 keys = ${this.apiKeys.length} total API keys`, 'info');

    try {
      // ⭐ Step 1: Reset stuck OCR jobs (crashed workers)
      const resetCount = await this.filesService.resetStuckOcrJobs();
      if (resetCount > 0) {
        this.log(0, `Reset ${resetCount} stuck OCR job(s) from previous run`, 'warning');
      }

      // ⭐ Step 2: Setup worker pool (4 OCR workers + 1 Grouping worker)
      const NUM_WORKERS = 4;
      const KEYS_PER_WORKER = 4;
      const workerKeyGroups: string[][] = [];

      for (let i = 0; i < NUM_WORKERS; i++) {
        const startIdx = i * KEYS_PER_WORKER;
        const endIdx = startIdx + KEYS_PER_WORKER;
        const workerKeys = this.apiKeys.slice(startIdx, endIdx);
        if (workerKeys.length > 0) {
          workerKeyGroups.push(workerKeys);
        }
      }

      this.log(0, `Starting ${workerKeyGroups.length} OCR workers + 1 Grouping worker`, 'info');

      // ⭐ Step 4: Start OCR Workers (infinite loop - ไม่หยุดเมื่อ retry ล้มเหลว)
      const ocrWorkers = workerKeyGroups.map((workerKeys, index) => {
        const threadNum = index + 1;
        this.log(0, `OCR Worker ${threadNum}: Using ${workerKeys.length} API keys`, 'info');
        return this.runOcrWorker(threadNum, workerKeys);
      });

      // ⭐ Step 5: Start Grouping Worker (infinite loop - skip files ที่ยัง processing)
      const groupingWorker = this.runGroupingWorker();

      // ⭐ รอให้ workers ทำงานต่อไป (จนกว่าจะ stop)
      // ถ้า worker ใดหยุด (error) → Promise.all จะ resolve
      await Promise.all([...ocrWorkers, groupingWorker]);

      this.log(0, '=== ∞ All workers stopped ===', 'warning');
    } catch (error) {
      this.log(0, `Worker pool error: ${error.message}`, 'error');
    } finally {
      this.isRunning = false;
    }
  }

  stopTask(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.log(0, 'Task stopped by user', 'warning');
    }
  }
}
