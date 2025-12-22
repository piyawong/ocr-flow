import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistrictOffice } from './entities/district-office.entity';
import { CreateDistrictOfficeDto } from './dto/create-district-office.dto';
import { UpdateDistrictOfficeDto } from './dto/update-district-office.dto';

@Injectable()
export class DistrictsService {
  constructor(
    @InjectRepository(DistrictOffice)
    private districtOfficeRepository: Repository<DistrictOffice>,
  ) {}

  /**
   * Create new district office
   */
  async create(createDto: CreateDistrictOfficeDto): Promise<DistrictOffice> {
    // Check if name already exists
    const existing = await this.districtOfficeRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException(`District office "${createDto.name}" already exists`);
    }

    const districtOffice = this.districtOfficeRepository.create(createDto);
    return this.districtOfficeRepository.save(districtOffice);
  }

  /**
   * Find all district offices
   */
  async findAll(isActive?: boolean): Promise<DistrictOffice[]> {
    const query = this.districtOfficeRepository.createQueryBuilder('district');

    if (isActive !== undefined) {
      query.where('district.isActive = :isActive', { isActive });
    }

    return query.orderBy('district.displayOrder', 'ASC')
      .addOrderBy('district.name', 'ASC')
      .getMany();
  }

  /**
   * Find one district office by ID
   */
  async findOne(id: number): Promise<DistrictOffice> {
    const districtOffice = await this.districtOfficeRepository.findOne({ where: { id } });

    if (!districtOffice) {
      throw new NotFoundException(`District office with ID ${id} not found`);
    }

    return districtOffice;
  }

  /**
   * Update district office
   */
  async update(id: number, updateDto: UpdateDistrictOfficeDto): Promise<DistrictOffice> {
    const districtOffice = await this.findOne(id);

    // Check if new name conflicts with existing
    if (updateDto.name && updateDto.name !== districtOffice.name) {
      const existing = await this.districtOfficeRepository.findOne({
        where: { name: updateDto.name },
      });

      if (existing) {
        throw new ConflictException(`District office "${updateDto.name}" already exists`);
      }
    }

    await this.districtOfficeRepository.update(id, updateDto);
    return this.findOne(id);
  }

  /**
   * Delete district office
   */
  async delete(id: number): Promise<void> {
    const districtOffice = await this.findOne(id);
    await this.districtOfficeRepository.delete(id);
  }
}
