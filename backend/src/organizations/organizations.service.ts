import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import axios from 'axios';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  private readonly ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://ocr-service:8000';

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Create new organization
   */
  async create(createDto: CreateOrganizationDto): Promise<Organization> {
    // Check if districtOfficeName already exists
    const existing = await this.organizationRepository.findOne({
      where: { districtOfficeName: createDto.districtOfficeName },
    });

    if (existing) {
      throw new ConflictException(`Organization "${createDto.districtOfficeName}" already exists`);
    }

    const organization = this.organizationRepository.create(createDto);
    return this.organizationRepository.save(organization);
  }

  /**
   * Find all organizations
   */
  async findAll(isActive?: boolean): Promise<Organization[]> {
    const query = this.organizationRepository.createQueryBuilder('organization');

    if (isActive !== undefined) {
      query.where('organization.isActive = :isActive', { isActive });
    }

    return query.orderBy('organization.displayOrder', 'ASC')
      .addOrderBy('organization.districtOfficeName', 'ASC')
      .getMany();
  }

  /**
   * Find one organization by ID
   */
  async findOne(id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({ where: { id } });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: number, updateDto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);

    // Check if new districtOfficeName conflicts with existing
    if (updateDto.districtOfficeName && updateDto.districtOfficeName !== organization.districtOfficeName) {
      const existing = await this.organizationRepository.findOne({
        where: { districtOfficeName: updateDto.districtOfficeName },
      });

      if (existing) {
        throw new ConflictException(`Organization "${updateDto.districtOfficeName}" already exists`);
      }
    }

    await this.organizationRepository.update(id, updateDto);
    return this.findOne(id);
  }

  /**
   * Delete organization
   */
  async delete(id: number): Promise<void> {
    const organization = await this.findOne(id);
    await this.organizationRepository.delete(id);
  }

  /**
   * Sync organizations to OCR service
   * ดึง organizations ทั้งหมด (active only) แล้วส่งชื่อไปยัง OCR service
   */
  async syncToOcrService(): Promise<{ success: boolean; count: number; message: string }> {
    try {
      // ดึง organizations ที่ active เท่านั้น
      const organizations = await this.findAll(true);

      // แปลงเป็น array ของชื่อ (name field)
      const organizationNames = organizations.map(org => org.name);

      this.logger.log(`Syncing ${organizationNames.length} organizations to OCR service...`);

      // ยิง POST ไป ocr-service
      const response = await axios.post(
        `${this.ocrServiceUrl}/organizations/sync`,
        { organizations: organizationNames },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000, // 10 seconds timeout
        }
      );

      this.logger.log(`OCR service sync successful: ${(response.data as any).message}`);

      return {
        success: true,
        count: organizationNames.length,
        message: `Successfully synced ${organizationNames.length} organization(s) to OCR service`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to sync to OCR service: ${error.message}`);
      throw new Error(`Failed to sync to OCR service: ${error.message}`);
    }
  }
}
