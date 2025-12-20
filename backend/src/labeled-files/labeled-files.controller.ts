import { Controller, Get, Param, ParseIntPipe, Post, Patch, Body, Res, NotFoundException, Query } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { LabeledFilesService } from './labeled-files.service';
import { LabelStatus } from './labeled-file.entity';

@Controller('labeled-files')
export class LabeledFilesController {
  constructor(private readonly labeledFilesService: LabeledFilesService) {}

  @Get()
  async findAll() {
    const files = await this.labeledFilesService.findAll();
    return { files };
  }

  @Get('processed-groups')
  async getProcessedGroups() {
    const groups = await this.labeledFilesService.getProcessedGroups();
    return { processedGroups: groups };
  }

  @Get('summary')
  async getAllSummary(@Query('includeReviewed') includeReviewed?: string) {
    const options = {
      includeReviewed: includeReviewed === 'true',
    };
    return this.labeledFilesService.getAllGroupsSummary(options);
  }

  @Get('group/:groupNumber')
  async findByGroup(@Param('groupNumber', ParseIntPipe) groupNumber: number) {
    return this.labeledFilesService.findByGroup(groupNumber);
  }

  @Get('group/:groupNumber/summary')
  async getGroupSummary(
    @Param('groupNumber', ParseIntPipe) groupNumber: number,
  ) {
    return this.labeledFilesService.getGroupSummary(groupNumber);
  }

  @Post('clear')
  async clearAll() {
    await this.labeledFilesService.clearAll();
    return { message: 'All labeled files cleared' };
  }

  // Get all available templates from database
  @Get('templates')
  async getTemplates() {
    return this.labeledFilesService.getTemplates();
  }

  // Get labeled files by template name for a specific group
  @Get('group/:groupId/by-template')
  async findByGroupAndTemplate(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('name') templateName: string,
  ) {
    const files = await this.labeledFilesService.findByGroupAndTemplate(
      groupId,
      templateName,
    );
    return { files };
  }

  // Preview a labeled file by ID
  @Public()
  @Get(':id/preview')
  async getPreview(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const file = await this.labeledFilesService.findById(id);
    if (!file) {
      throw new NotFoundException('Labeled file not found');
    }

    const buffer = await this.labeledFilesService.getFileBuffer(file.storagePath);
    const mimeType = file.originalName.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : file.originalName.match(/\.(jpg|jpeg)$/i)
        ? 'image/jpeg'
        : file.originalName.match(/\.(png)$/i)
          ? 'image/png'
          : 'application/octet-stream';

    res.set({
      'Content-Type': mimeType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(buffer);
  }

  // Manual Label: Update page labels for a group
  @Patch('group/:groupId/pages')
  async updatePageLabels(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: {
      updates: {
        id: number;
        templateName?: string;
        category?: string;
        labelStatus?: LabelStatus;
        matchReason?: string;
        documentId?: number;
        pageInDocument?: number;
      }[];
      documents?: {
        documentNumber: number;
        templateName: string;
        documentDate: string | null;
      }[];
    },
  ) {
    return this.labeledFilesService.updatePageLabels(
      groupId,
      body.updates,
      body.documents, // NEW: Pass document dates
    );
  }

  // Mark all files in a group as reviewed by a user
  @Post('group/:groupId/mark-reviewed')
  async markGroupAsReviewed(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { reviewer: string; notes?: string; markAsReviewed?: boolean },
  ) {
    return this.labeledFilesService.markGroupAsReviewed(
      groupId,
      body.reviewer,
      body.notes,
      body.markAsReviewed ?? true, // Default to true for backward compatibility
    );
  }
}
