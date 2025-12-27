import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/user.entity';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Create new organization
   * Admin only
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateOrganizationDto) {
    const organization = await this.organizationsService.create(createDto);

    return {
      message: 'Organization created successfully',
      organization,
    };
  }

  /**
   * Get all organizations (with optional filter)
   */
  @Get()
  async findAll(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;

    const organizations = await this.organizationsService.findAll(isActive);

    return {
      total: organizations.length,
      organizations,
    };
  }

  /**
   * Get single organization by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const organization = await this.organizationsService.findOne(id);
    return { organization };
  }

  /**
   * Update organization
   * Admin only
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateOrganizationDto,
  ) {
    const organization = await this.organizationsService.update(id, updateDto);

    return {
      message: 'Organization updated successfully',
      organization,
    };
  }

  /**
   * Delete organization
   * Admin only
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.organizationsService.delete(id);

    return {
      message: 'Organization deleted successfully',
    };
  }

  /**
   * Sync organizations to OCR service
   * ดึง active organizations จาก DB แล้วส่งไปยัง OCR service
   * Admin only
   */
  @Post('sync-to-ocr')
  @Roles(UserRole.ADMIN)
  async syncToOcrService() {
    const result = await this.organizationsService.syncToOcrService();
    return result;
  }
}
