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

interface OcrResult {
  rawFileId: number;
  fileNumber: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  ocrText: string;
  isBookmark: boolean;
}

class TaskQueue {
  private queue: any[] = [];
  private currentIndex = 0;

  constructor(items: any[]) {
    this.queue = [...items];
  }

  getNext(): any | null {
    if (this.currentIndex >= this.queue.length) return null;
    return this.queue[this.currentIndex++];
  }

  putBack(item: any): void {
    // คืนไฟล์กลับ queue ต่อท้าย
    this.queue.push(item);
  }

  hasMore(): boolean {
    return this.currentIndex < this.queue.length;
  }

  getProgress(): { current: number; total: number } {
    return { current: this.currentIndex, total: this.queue.length };
  }
}

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

    // API Keys (passed to OCR service per request for parallel processing)
    this.apiKeys = [
      this.configService.get('TYPHOON_OCR_API_KEY_1', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_2', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_3', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_4', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_5', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_6', ''),
      this.configService.get('TYPHOON_OCR_API_KEY_7', ''),
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
   * - figure_language="Thai" (Thai language optimization)
   * - task_type="v1.5" (faster, single-prompt architecture)
   * - Post-processing fixes for Thai OCR errors
   *
   * @param imageBuffer - Image data as Buffer
   * @param apiKey - Typhoon OCR API key (passed per request for parallel processing)
   * @returns OCR text result
   */
  private async callOcrService(
    imageBuffer: Buffer,
    apiKey: string,
  ): Promise<string> {
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(`${this.ocrServiceUrl}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: base64Image,
        api_key: apiKey,
        task_type: 'v1.5',        // Faster, single-prompt architecture
        figure_language: 'Thai',   // Thai language optimization
      }),
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
  }

  private isBookmarkText(text: string): boolean {
    const normalizedText = text.toUpperCase().trim();
    return normalizedText.includes('BOOKMARK') || normalizedText === 'BOOKMARK';
  }

  private async processFileWithRetry(
    file: any,
    apiKey: string,
    threadNum: number,
    maxRetries = 3,
  ): Promise<OcrResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (!this.isRunning) {
        throw new Error('Task stopped');
      }

      try {
        this.log(
          threadNum,
          `Processing file #${file.fileNumber}: ${file.originalName}${attempt > 1 ? ` (retry ${attempt}/${maxRetries})` : ''}`,
          'info',
        );

        const startTime = Date.now();
        const buffer = await this.filesService.getFileBuffer(file.storagePath);
        const ocrText = await this.callOcrService(buffer, apiKey);
        const isBookmark = this.isBookmarkText(ocrText);
        const elapsedSeconds = (Date.now() - startTime) / 1000;

        // Mark file as processed
        await this.filesService.markAsProcessed(file.id);

        this.log(
          threadNum,
          `OCR complete for #${file.fileNumber} in ${elapsedSeconds.toFixed(2)}s${isBookmark ? ' [BOOKMARK DETECTED]' : ''}`,
          isBookmark ? 'warning' : 'success',
        );

        // Emit file processed event
        this.log(threadNum, `FILE_PROCESSED:${file.id}`, 'info');

        return {
          rawFileId: file.id,
          fileNumber: file.fileNumber,
          originalName: file.originalName,
          storagePath: file.storagePath,
          mimeType: file.mimeType,
          size: file.size,
          ocrText,
          isBookmark,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.log(
            threadNum,
            `Error processing #${file.fileNumber}, retrying... (${error.message})`,
            'warning',
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries failed - throw error to stop worker
    this.log(
      threadNum,
      `❌ Failed to process #${file.fileNumber} after ${maxRetries} attempts: ${lastError?.message}`,
      'error',
    );
    this.log(
      threadNum,
      `⚠️ Thread ${threadNum} stopped. File #${file.fileNumber} returned to queue for other workers.`,
      'warning',
    );

    throw new Error(`Failed after ${maxRetries} retries: ${lastError?.message}`);
  }

  private async runOcrWorker(
    threadNum: number,
    apiKey: string,
    queue: TaskQueue,
    resultsMap: Map<number, OcrResult>,
  ): Promise<void> {
    while (queue.hasMore() && this.isRunning) {
      const file = queue.getNext();
      if (!file) break;

      try {
        const result = await this.processFileWithRetry(file, apiKey, threadNum);
        resultsMap.set(file.fileNumber, result);
        // ⭐ ไม่ทำ grouping ที่นี่ - ให้ grouping worker ทำ
      } catch (error) {
        // Retry failed - คืนไฟล์กลับ queue และหยุด worker นี้
        queue.putBack(file);
        this.log(
          threadNum,
          `🔄 File #${file.fileNumber} returned to queue. Thread ${threadNum} terminated.`,
          'warning',
        );
        break; // หยุด worker นี้
      }
    }

    this.log(threadNum, `OCR Thread ${threadNum} finished`, 'info');
  }

  private async runGroupingWorker(
    resultsMap: Map<number, OcrResult>,
    allFiles: any[],
  ): Promise<void> {
    const groupingState = {
      currentIndex: 0,
      currentGroupId: null as number | null,
      orderInGroup: 1,
    };

    this.log(0, `🔄 Grouping worker started`, 'info');

    // Loop จนกว่าจะ group ครบทุกไฟล์
    while (groupingState.currentIndex < allFiles.length && this.isRunning) {
      const expectedFile = allFiles[groupingState.currentIndex];
      const result = resultsMap.get(expectedFile.fileNumber);

      if (!result) {
        // ไฟล์ยังไม่พร้อม - รอ 100ms แล้วลองใหม่
        await this.sleep(100);
        continue;
      }

      // ⭐ ไฟล์พร้อมแล้ว - ทำ grouping ทันที (ไม่มี race condition)
      if (result.isBookmark) {
        // เจอ BOOKMARK → ปิด group ก่อนหน้า (ถ้ามีไฟล์)
        if (groupingState.currentGroupId && groupingState.orderInGroup > 1) {
          await this.filesService.markGroupComplete(groupingState.currentGroupId);
          this.log(
            0,
            `✅ Group ID=${groupingState.currentGroupId} completed (${groupingState.orderInGroup - 1} files)`,
            'success',
          );
        }

        // สร้าง Group ใหม่ (BOOKMARK เป็นแค่ตัวแบ่ง ไม่เก็บลง group)
        const newGroup = await this.filesService.createGroup();
        groupingState.currentGroupId = newGroup.id;
        groupingState.orderInGroup = 1;

        this.log(
          0,
          `File #${result.fileNumber} is BOOKMARK - created new Group ID=${newGroup.id}`,
          'warning',
        );

        // Mark BOOKMARK file ว่าเป็น bookmark แต่ไม่ assign groupId
        await this.filesService.updateFileGrouping(result.rawFileId, {
          groupId: null,
          orderInGroup: null,
          ocrText: result.ocrText,
          isBookmark: true,
        });
      } else {
        // สร้าง Group ถ้ายังไม่มี (กรณีไฟล์แรกไม่ใช่ BOOKMARK)
        if (!groupingState.currentGroupId) {
          const newGroup = await this.filesService.createGroup();
          groupingState.currentGroupId = newGroup.id;
          this.log(0, `Created initial Group ID=${newGroup.id}`, 'info');
        }

        // Add to group
        await this.filesService.updateFileGrouping(result.rawFileId, {
          groupId: groupingState.currentGroupId,
          orderInGroup: groupingState.orderInGroup,
          ocrText: result.ocrText,
          isBookmark: result.isBookmark,
        });

        this.log(
          0,
          `Grouped #${result.fileNumber} → Group ID=${groupingState.currentGroupId}, Order ${groupingState.orderInGroup}`,
          'success',
        );
        groupingState.orderInGroup++;
      }

      groupingState.currentIndex++;
    }

    // ปิด group สุดท้าย (ถ้ามีไฟล์)
    if (groupingState.currentGroupId && groupingState.orderInGroup > 1) {
      await this.filesService.markGroupComplete(groupingState.currentGroupId);
      this.log(
        0,
        `✅ Final group ID=${groupingState.currentGroupId} completed (${groupingState.orderInGroup - 1} files)`,
        'success',
      );
    }

    this.log(0, `✅ Grouping worker finished`, 'success');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async processBatch(rawFiles: any[]): Promise<void> {
    // Setup worker pool
    const queue = new TaskQueue(rawFiles);
    const resultsMap = new Map<number, OcrResult>();

    this.log(0, `📦 Processing ${rawFiles.length} file(s) with ${this.apiKeys.length} OCR workers + 1 grouping worker`, 'info');

    // ⭐ Create OCR workers (parallel processing)
    const ocrWorkers = this.apiKeys.map((apiKey, index) => {
      const threadNum = index + 1;
      return this.runOcrWorker(threadNum, apiKey, queue, resultsMap);
    });

    // ⭐ Create grouping worker (single worker - no race condition)
    const groupingWorker = this.runGroupingWorker(resultsMap, rawFiles);

    // รอให้ทั้ง OCR workers และ grouping worker เสร็จ
    await Promise.all([...ocrWorkers, groupingWorker]);

    // Check if all files were processed
    const processedCount = resultsMap.size;
    const totalCount = rawFiles.length;

    if (processedCount < totalCount) {
      const failedCount = totalCount - processedCount;
      this.log(
        0,
        `⚠️ Warning: ${failedCount} file(s) failed to process after all retries`,
        'warning',
      );
    } else {
      this.log(0, `✅ Batch complete: ${processedCount} file(s) processed and grouped`, 'success');
    }

    const groupCount = await this.filesService.getGroupCount();
    this.log(0, `Total groups created: ${groupCount}`, 'info');
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
    this.log(0, '=== ∞ Infinite Worker Loop Started ===', 'info');
    this.log(0, `Using ${this.apiKeys.length} workers with retry logic`, 'info');

    try {
      // Clear incomplete groups once at start
      await this.filesService.clearIncompleteGroups();
      this.log(0, 'Cleared incomplete grouped files', 'info');

      // Infinite loop - ทำงานจนกว่าจะถูก stop
      while (this.isRunning) {
        // Get file IDs that are already grouped
        const fileIdsInGroups = await this.filesService.getFileIdsInCompleteGroups();

        // Get unprocessed files
        const allUnprocessedFiles = await this.filesService.findUnprocessed();

        // Filter out files that are already grouped
        const rawFiles = allUnprocessedFiles.filter(
          file => !fileIdsInGroups.includes(file.id)
        );

        if (rawFiles.length === 0) {
          this.log(0, '⏳ No unprocessed files. Waiting for new files...', 'info');
          await this.sleep(5000); // รอ 5 วินาที
          continue;
        }

        this.log(0, `📦 Found ${rawFiles.length} unprocessed file(s) to process`, 'info');

        // ประมวลผล batch นี้
        await this.processBatch(rawFiles);

        // รอสักครู่ก่อน loop รอบถัดไป (ป้องกัน tight loop)
        if (this.isRunning) {
          await this.sleep(2000);
        }
      }

      this.log(0, '=== ∞ Infinite Worker Loop Stopped ===', 'warning');
    } catch (error) {
      this.log(0, `Worker loop error: ${error.message}`, 'error');
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
