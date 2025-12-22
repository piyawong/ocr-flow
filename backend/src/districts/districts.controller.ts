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
import { DistrictsService } from './districts.service';
import { CreateDistrictOfficeDto } from './dto/create-district-office.dto';
import { UpdateDistrictOfficeDto } from './dto/update-district-office.dto';

@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  /**
   * Create new district office
   * Admin only
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateDistrictOfficeDto) {
    const districtOffice = await this.districtsService.create(createDto);

    return {
      message: 'District office created successfully',
      districtOffice,
    };
  }

  /**
   * Get all district offices (with optional filter)
   */
  @Get()
  async findAll(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;

    const districtOffices = await this.districtsService.findAll(isActive);

    return {
      total: districtOffices.length,
      districtOffices,
    };
  }

  /**
   * Get single district office by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const districtOffice = await this.districtsService.findOne(id);
    return { districtOffice };
  }

  /**
   * Update district office
   * Admin only
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDistrictOfficeDto,
  ) {
    const districtOffice = await this.districtsService.update(id, updateDto);

    return {
      message: 'District office updated successfully',
      districtOffice,
    };
  }

  /**
   * Delete district office
   * Admin only
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.districtsService.delete(id);

    return {
      message: 'District office deleted successfully',
    };
  }
}
