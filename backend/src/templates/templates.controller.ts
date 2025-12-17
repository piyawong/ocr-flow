import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { Template } from './template.entity';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(): Promise<Template[]> {
    return this.templatesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Template> {
    return this.templatesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto): Promise<Template> {
    return this.templatesService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ): Promise<Template> {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.templatesService.remove(id);
    return { success: true };
  }

  @Post(':id/toggle')
  async toggleActive(@Param('id', ParseIntPipe) id: number): Promise<Template> {
    return this.templatesService.toggleActive(id);
  }
}
