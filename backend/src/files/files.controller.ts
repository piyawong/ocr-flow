import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
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
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/user.entity';
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

  // ========== SPECIFIC ROUTES FIRST (must be before generic :id route) ==========

  @Public()
  @Get(':id/preview')
  async getPreview(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const file = await this.filesService.findOne(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Use edited image if available, otherwise use original
    const imagePath = file.hasEdited && file.editedPath ? file.editedPath : file.storagePath;

    const buffer = await this.filesService.getFileBuffer(imagePath);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache', // Don't cache edited images
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

  @Patch(':id/review')
  async markAsReviewed(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isReviewed: boolean },
  ) {
    const file = await this.filesService.markAsReviewed(id, body.isReviewed);
    return {
      message: `File ${body.isReviewed ? 'marked as reviewed' : 'unmarked as reviewed'}`,
      file,
    };
  }

  @Post(':id/save-edited')
  @UseInterceptors(FilesInterceptor('file', 1))
  async saveEditedImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; originalname: string; size: number }>,
  ) {
    if (!files || files.length === 0) {
      throw new NotFoundException('No file provided');
    }

    const file = await this.filesService.saveEditedImage(id, files[0]);
    return {
      message: 'Edited image saved successfully',
      file,
    };
  }

  @Delete(':id/reset-edited')
  async resetEditedImage(@Param('id', ParseIntPipe) id: number) {
    const file = await this.filesService.resetEditedImage(id);
    return {
      message: 'Edited image removed, reset to original',
      file,
    };
  }

  // ========== GENERIC ROUTES (must be after specific routes) ==========

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const file = await this.filesService.findOne(id);
    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }
    return file;
  }

  @Delete(':id')
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    await this.filesService.deleteFile(id);
    return { message: 'File deleted' };
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

  // ========== ACTION ENDPOINTS ==========

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
  async getGroupsMetadata(@CurrentUser() user?: User) {
    const groups = await this.filesService.getGroupMetadata(
      user?.id,
      user?.role,
    );
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
    @CurrentUser() user?: User,
  ) {
    return this.filesService.markExtractDataReviewed(
      groupId,
      body.reviewer,
      body.notes,
      user?.id,
    );
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
    @CurrentUser() user?: User,
  ) {
    await this.filesService.updateParsedGroupData(
      groupId,
      data,
      user?.id,
      user?.name,
    );
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

  @Public()
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

  @Put('charter-sections/reorder')
  async reorderCharterSections(
    @Body() body: { items: Array<{ id: number; orderIndex: number }> },
  ) {
    await this.filesService.reorderCharterSections(body.items);
    return { message: 'Charter sections reordered successfully' };
  }

  @Put('charter-articles/reorder')
  async reorderCharterArticles(
    @Body() body: { items: Array<{ id: number; orderIndex: number }> },
  ) {
    await this.filesService.reorderCharterArticles(body.items);
    return { message: 'Charter articles reordered successfully' };
  }

  @Put('charter-sub-items/reorder')
  async reorderCharterSubItems(
    @Body() body: { items: Array<{ id: number; orderIndex: number }> },
  ) {
    await this.filesService.reorderCharterSubItems(body.items);
    return { message: 'Charter sub items reordered successfully' };
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
    @CurrentUser() user?: User,
  ) {
    const group = await this.filesService.approveFinalReview(
      groupId,
      body.reviewerName,
      body.notes,
      user?.id,
    );
    return {
      success: true,
      message: 'Group approved successfully',
      group,
    };
  }

  // ========== GROUP LOCKING ENDPOINTS ==========

  /**
   * Lock a group for editing
   * Prevents other users from accessing the group
   */
  @Post('group/:groupId/lock')
  async lockGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: User,
  ) {
    const result = await this.filesService.lockGroup(groupId, user.id);
    return {
      success: true,
      message: 'Group locked successfully',
      ...result,
    };
  }

  /**
   * Unlock a group
   * Called when user leaves the page or saves
   */
  @Delete('group/:groupId/lock')
  async unlockGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: User,
  ) {
    await this.filesService.unlockGroup(groupId, user.id);
    return {
      success: true,
      message: 'Group unlocked successfully',
    };
  }

  /**
   * Renew group lock (heartbeat)
   * Extends the lock timeout
   */
  @Put('group/:groupId/lock/renew')
  async renewGroupLock(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: User,
  ) {
    await this.filesService.renewGroupLock(groupId, user.id);
    return {
      success: true,
      message: 'Lock renewed successfully',
    };
  }

  // ========== SSE EVENTS ==========

  @Public()
  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.filesService.getEventObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }
}
