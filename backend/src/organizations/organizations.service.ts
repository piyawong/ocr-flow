import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
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
}
