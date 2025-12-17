import { Injectable } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';
import { FilesService } from '../files/files.service';
import { LabeledFilesService } from '../labeled-files/labeled-files.service';
import { LabelStatus } from '../labeled-files/labeled-file.entity';
import { TemplatesService } from '../templates/templates.service';
import {
  Template,
  LogCallback,
  processFilesForLabeling,
} from '../shared/label-utils';

export interface LogMessage {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

@Injectable()
export class LabelRunnerService {
  private isRunning = false;
  private logSubject = new ReplaySubject<LogMessage>(100);
  private logHistory: LogMessage[] = [];
  private readonly MAX_LOGS = 500;
  private templates: Template[] = [];

  constructor(
    private filesService: FilesService,
    private labeledFilesService: LabeledFilesService,
    private templatesService: TemplatesService,
  ) {
    this.loadTemplates();
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

  private log(message: string, type: LogMessage['type'] = 'info') {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
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

  private async loadTemplates() {
    try {
      this.templates = await this.templatesService.getTemplatesForLabeling();
      this.log(`Loaded ${this.templates.length} active templates for auto-labeling`);
    } catch (error) {
      this.log(`Error loading templates: ${error.message}`, 'error');
      this.templates = [];
    }
  }

  async reloadTemplates() {
    await this.loadTemplates();
  }

  async startLabelTask(): Promise<void> {
    if (this.isRunning) {
      this.log('Label task is already running', 'warning');
      return;
    }

    this.isRunning = true;
    this.log('=== ∞ Infinite Label Worker Loop Started ===', 'info');
    await this.reloadTemplates();

    try {
      // Infinite loop - runs until stopped
      while (this.isRunning) {
        // Get groups that are ready to label (isComplete = true AND isAutoLabeled = false)
        const groupsToProcess = await this.filesService.getGroupsReadyToLabel();

        if (groupsToProcess.length === 0) {
          this.log('⏳ No groups ready to label. Waiting for new groups...', 'info');
          await this.sleep(5000); // Wait 5 seconds
          continue;
        }

        this.log(`📦 Found ${groupsToProcess.length} group(s) ready to label: ${groupsToProcess.join(', ')}`, 'info');

        // Process each group
        for (const gNum of groupsToProcess) {
          if (!this.isRunning) break; // Check if stopped during processing

          await this.processGroup(gNum);
        }

        // Wait before next loop iteration
        if (this.isRunning) {
          await this.sleep(2000);
        }
      }

      this.log('=== ∞ Infinite Label Worker Loop Stopped ===', 'warning');
    } catch (error) {
      this.log(`Label worker loop error: ${error.message}`, 'error');
      this.isRunning = false;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Re-label a specific group (public method for API)
  async relabelGroup(groupId: number): Promise<{ success: boolean; matched: number; total: number; message: string }> {
    this.log(`=== Re-labeling Group ${groupId} ===`, 'info');
    await this.reloadTemplates();

    try {
      // 1. Delete existing labeled files and reset group's isAutoLabeled flag
      await this.labeledFilesService.clearByGroup(groupId);
      this.log(`Deleted existing labels for group ${groupId}`, 'info');

      // 2. Re-process the group
      await this.processGroup(groupId);

      // 3. Get stats
      const labeledFiles = await this.labeledFilesService.findByGroup(groupId);
      const matched = labeledFiles.filter(f => f.labelStatus !== 'unmatched').length;
      const total = labeledFiles.length;

      return {
        success: true,
        matched,
        total,
        message: `Re-labeled group ${groupId}: ${matched}/${total} pages matched`,
      };
    } catch (error) {
      this.log(`Error re-labeling group ${groupId}: ${error.message}`, 'error');
      return {
        success: false,
        matched: 0,
        total: 0,
        message: `Error: ${error.message}`,
      };
    }
  }

  private async processGroup(groupId: number): Promise<void> {
    this.log(`--- Processing Group ${groupId} ---`);

    const files = await this.filesService.findByGroup(groupId);
    if (files.length === 0) {
      this.log(`Group ${groupId}: No files found`, 'warning');
      return;
    }

    this.log(`Group ${groupId}: Found ${files.length} files`);

    // Create log callback for shared utility
    const logCallback: LogCallback = (message, type) => this.log(message, type);

    // Use shared utility to process files
    const result = processFilesForLabeling(
      files.map(f => ({
        id: f.id,
        orderInGroup: f.orderInGroup,
        originalName: f.originalName,
        storagePath: f.storagePath,
        ocrText: f.ocrText,
      })),
      this.templates,
      logCallback,
    );

    // Save labels to database
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const label = result.pageLabels[i];

      await this.labeledFilesService.createLabeledFile({
        groupId,
        orderInGroup: file.orderInGroup,
        groupedFileId: file.id,
        originalName: file.originalName,
        storagePath: file.storagePath,
        ocrText: file.ocrText,
        templateName: label.templateName || undefined,
        category: label.category || undefined,
        labelStatus: label.status as LabelStatus,
        matchReason: label.matchReason,
        documentId: label.documentId || undefined,
        pageInDocument: label.pageInDocument || undefined,
      });
    }

    // Summary
    this.log(
      `Group ${groupId}: ${result.matched}/${result.total} pages matched (${result.percentage.toFixed(1)}%)`,
      result.matched === result.total ? 'success' : 'warning',
    );

    // Mark group as labeled
    await this.filesService.markGroupLabeled(groupId);

    // Emit GROUP_PROCESSED event for realtime frontend update
    this.log(`GROUP_PROCESSED:${groupId}:${result.matched}:${result.total}`, 'info');
  }

  stopTask(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.log('Label task stopped by user', 'warning');
    }
  }
}
