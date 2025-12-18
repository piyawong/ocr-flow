import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  Res,
  NotFoundException,
  Sse,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ========== STAGE 01: UPLOAD ENDPOINTS ==========

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 100))
  async uploadFiles(@UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>) {
    const uploaded = await this.filesService.uploadFiles(files);
    return {
      message: `Uploaded ${uploaded.length} files`,
      files: uploaded,
    };
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('processed') processed?: 'all' | 'true' | 'false',
  ) {
    // If pagination params are provided, use paginated query
    if (page || limit || sortBy || sortOrder || processed) {
      return this.filesService.findAllPaginated({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        sortBy,
        sortOrder,
        processed,
      });
    }

    // Otherwise, return all files (legacy behavior)
    const files = await this.filesService.findAll();
    const count = await this.filesService.getFileCount();
    return {
      count,
      files,
    };
  }

  @Get(':id/preview')
  async getPreview(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const file = await this.filesService.findOne(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const buffer = await this.filesService.getFileBuffer(file.storagePath);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(buffer);
  }

  @Post(':id/rotate')
  async rotateImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { degrees: number },
  ) {
    const degrees = body.degrees || 90;
    const file = await this.filesService.rotateImage(id, degrees);
    return {
      message: `Image rotated ${degrees} degrees`,
      file,
    };
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    await this.filesService.deleteFile(id);
    return { message: 'File deleted' };
  }

  @Post('clear')
  async clearAll() {
    await this.filesService.clearAll();
    return { message: 'All files cleared' };
  }

  @Post('reset-processed')
  async resetProcessed() {
    const count = await this.filesService.resetProcessed();
    return {
      message: `Reset ${count} files to unprocessed`,
      count
    };
  }

  @Post('validate-storage')
  async validateStorage() {
    const result = await this.filesService.validateAndCleanupStorage();
    return {
      message: `Validation complete: ${result.validated} files OK, ${result.removed} orphaned files removed, ${result.orphanedLabelsRemoved} orphaned labels removed, ${result.orphanedGroupsRemoved} orphaned groups removed`,
      ...result
    };
  }

  // ========== STAGE 02: GROUPING ENDPOINTS (formerly grouped-files) ==========

  @Get('groups-metadata')
  async getGroupsMetadata() {
    const groups = await this.filesService.getGroupMetadata();
    return { groups };
  }

  @Get('parsed-groups')
  async getParsedGroups() {
    const groups = await this.filesService.getParsedGroups();
    return { groups };
  }

  @Get('parsed-group/:groupId')
  async getParsedGroupDetail(@Param('groupId', ParseIntPipe) groupId: number) {
    const detail = await this.filesService.getParsedGroupDetail(groupId);
    if (!detail) {
      throw new NotFoundException(`Parsed group ${groupId} not found`);
    }
    return detail;
  }

  @Post('parsed-group/:groupId/mark-reviewed')
  async markExtractDataReviewed(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { reviewer: string; notes?: string },
  ) {
    return this.filesService.markExtractDataReviewed(groupId, body.reviewer, body.notes);
  }

  @Put('parsed-group/:groupId/update')
  async updateParsedGroupData(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() data: {
      foundationInstrument?: any;
      committeeMembers?: any;
      districtOffice?: string | null;
      registrationNumber?: string | null;
    },
  ) {
    await this.filesService.updateParsedGroupData(groupId, data);
    return { message: 'Parsed group data updated successfully' };
  }

  @Post('parsed-group/:groupId/upload-logo')
  async uploadGroupLogo(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { imageData: string },
  ) {
    const logoUrl = await this.filesService.uploadGroupLogo(groupId, body.imageData);
    return { message: 'Logo uploaded successfully', logoUrl };
  }

  @Get('logo/:path(*)')
  async getLogo(@Param('path') path: string, @Res() res: Response) {
    try {
      const buffer = await this.filesService.getFileBuffer(path);
      const ext = path.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/png';
      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.send(buffer);
    } catch (error) {
      throw new NotFoundException('Logo not found');
    }
  }

  @Get('ready-to-label')
  async getGroupsReadyToLabel() {
    const groups = await this.filesService.getGroupsReadyToLabel();
    return { groups };
  }

  @Get('group/:groupId')
  async findByGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    const files = await this.filesService.findByGroup(groupId);
    return { files };
  }

  @Put('group/:groupId/parse-data')
  async updateGroupParseData(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() data: { foundationInstrument?: any; committeeMembers?: any },
  ) {
    await this.filesService.updateGroupParseData(groupId, data);
    return { message: 'Group parse data updated' };
  }

  @Put('group/:groupId/reorder')
  async reorderGroupFiles(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { reorderedFiles: Array<{ id: number; newOrder: number }> },
  ) {
    await this.filesService.reorderGroupFiles(groupId, body.reorderedFiles);
    return { message: 'Files reordered successfully' };
  }

  @Post('clear-grouping')
  async clearGrouping() {
    await this.filesService.clearGroupedFiles();
    return { message: 'All grouping data cleared' };
  }

  // ========== STAGE 05: FINAL REVIEW ENDPOINTS ==========

  @Get('final-review-groups')
  async getFinalReviewGroups(
    @Query('status') status?: 'pending' | 'approved' | 'all',
  ) {
    const groups = await this.filesService.getFinalReviewGroups(status || 'pending');
    return { groups };
  }

  @Get('final-review-groups/:groupId')
  async getFinalReviewGroupDetail(@Param('groupId', ParseIntPipe) groupId: number) {
    const detail = await this.filesService.getFinalReviewGroupDetail(groupId);
    return detail;
  }

  @Post('final-review-groups/:groupId/approve')
  async approveFinalReview(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: { notes?: string; reviewerName: string },
  ) {
    const group = await this.filesService.approveFinalReview(
      groupId,
      body.reviewerName,
      body.notes,
    );
    return {
      success: true,
      message: 'Group approved successfully',
      group,
    };
  }

  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.filesService.getEventObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }
}
