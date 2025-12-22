import { Controller, Get, Param, ParseIntPipe, Post, Body, Query } from '@nestjs/common';
import { LabeledFilesService } from './labeled-files.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/user.entity';

@Controller('labeled-files')
export class LabeledFilesController {
  constructor(private readonly labeledFilesService: LabeledFilesService) {}

  // ❌ DEPRECATED: Use getGroupPagesWithLabels() instead
  // @Get()
  // async findAll() {
  //   const files = await this.labeledFilesService.findAll();
  //   return { files };
  // }

  @Get('processed-groups')
  async getProcessedGroups() {
    const groups = await this.labeledFilesService.getProcessedGroups();
    return { processedGroups: groups };
  }

  @Get('summary')
  async getAllSummary(
    @Query('includeReviewed') includeReviewed?: string,
    @CurrentUser() user?: User,
  ) {
    console.log('📊 getAllSummary called with user:', {
      userId: user?.id,
      userRole: user?.role,
      userName: user?.name,
    });

    const options = {
      includeReviewed: includeReviewed === 'true',
      userId: user?.id,
      userRole: user?.role,
    };
    return this.labeledFilesService.getAllGroupsSummary(options);
  }

  @Get('group/:groupNumber')
  async findByGroup(@Param('groupNumber', ParseIntPipe) groupNumber: number) {
    // Get group pages with labels (merges files + documents)
    return this.labeledFilesService.getGroupPagesWithLabels(groupNumber);
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

  // NOTE: findByGroupAndTemplate removed - use getGroupPagesWithLabels() and filter client-side

  // NOTE: Preview endpoint removed - use files API /files/:id/preview instead

  // ❌ DEPRECATED: Use POST /group/:groupId/documents instead
  // @Patch('group/:groupId/pages')
  // async updatePageLabels(
  //   @Param('groupId', ParseIntPipe) groupId: number,
  //   @Body() body: {
  //     updates: {
  //       id: number;
  //       templateName?: string;
  //       category?: string;
  //       labelStatus?: LabelStatus;
  //       matchReason?: string;
  //       documentId?: number;
  //       pageInDocument?: number;
  //     }[];
  //     documents?: {
  //       documentNumber: number;
  //       templateName: string;
  //       documentDate: string | null;
  //     }[];
  //   },
  // ) {
  //   return this.labeledFilesService.updatePageLabels(
  //     groupId,
  //     body.updates,
  //     body.documents,
  //   );
  // }

  // Mark all files in a group as reviewed by a user
  @Post('group/:groupId/mark-reviewed')
  async markGroupAsReviewed(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { reviewer: string; notes?: string; markAsReviewed?: boolean },
    @CurrentUser() user?: User,
  ) {
    return this.labeledFilesService.markGroupAsReviewed(
      groupId,
      body.reviewer,
      body.notes,
      body.markAsReviewed ?? true, // Default to true for backward compatibility
      user?.id,
    );
  }

  // ========================================================================
  // DOCUMENT-BASED LABELING ENDPOINTS (NEW)
  // ========================================================================

  /**
   * Get all documents for a group (with page ranges)
   */
  @Get('group/:groupId/documents')
  async getGroupDocuments(@Param('groupId', ParseIntPipe) groupId: number) {
    const documents = await this.labeledFilesService.getDocumentsByGroup(groupId);
    return { documents };
  }

  /**
   * Check if new documents overlap with existing documents
   * Returns list of existing documents that will be affected/deleted
   */
  @Post('group/:groupId/check-overlap')
  async checkDocumentOverlap(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body()
    body: {
      documents: {
        templateName: string;
        category: string;
        startPage: number;
        endPage: number;
      }[];
    },
  ) {
    const result = await this.labeledFilesService.checkDocumentOverlap(
      groupId,
      body.documents,
    );

    return result;
  }

  /**
   * Update documents for a group (document-based labeling)
   * Clears existing labels and creates new documents with pages
   */
  @Post('group/:groupId/documents')
  async updateGroupDocuments(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body()
    body: {
      documents: {
        id?: number; // null = create new, มีค่า = update existing (not implemented yet)
        templateName: string;
        category: string;
        startPage: number;
        endPage: number;
        documentDate?: string;
      }[];
    },
    @CurrentUser() user?: User,
  ) {
    // Use service method to update documents
    const result = await this.labeledFilesService.updateGroupDocuments(
      groupId,
      body.documents,
      user?.id,
      user?.name,
    );

    return result;
  }
}
