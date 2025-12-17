import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { Template as TemplateInterface } from '../shared/label-utils/types';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templateRepository: Repository<Template>,
  ) {}

  async findAll(): Promise<Template[]> {
    return this.templateRepository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findActive(): Promise<Template[]> {
    return this.templateRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Template> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template #${id} not found`);
    }
    return template;
  }

  async create(dto: CreateTemplateDto): Promise<Template> {
    const template = this.templateRepository.create({
      name: dto.name,
      firstPagePatterns: dto.firstPagePatterns || null,
      lastPagePatterns: dto.lastPagePatterns || null,
      firstPageNegativePatterns: dto.firstPageNegativePatterns || null,
      lastPageNegativePatterns: dto.lastPageNegativePatterns || null,
      category: dto.category || null,
      isSinglePage: dto.isSinglePage ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.templateRepository.save(template);
  }

  async update(id: number, dto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(id);

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.firstPagePatterns !== undefined) template.firstPagePatterns = dto.firstPagePatterns;
    if (dto.lastPagePatterns !== undefined) template.lastPagePatterns = dto.lastPagePatterns;
    if (dto.firstPageNegativePatterns !== undefined) template.firstPageNegativePatterns = dto.firstPageNegativePatterns;
    if (dto.lastPageNegativePatterns !== undefined) template.lastPageNegativePatterns = dto.lastPageNegativePatterns;
    if (dto.category !== undefined) template.category = dto.category;
    if (dto.isSinglePage !== undefined) template.isSinglePage = dto.isSinglePage;
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) template.sortOrder = dto.sortOrder;
    if (dto.contextRules !== undefined) template.contextRules = dto.contextRules;

    return this.templateRepository.save(template);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepository.remove(template);
  }

  async toggleActive(id: number): Promise<Template> {
    const template = await this.findOne(id);
    template.isActive = !template.isActive;
    return this.templateRepository.save(template);
  }

  /**
   * Get templates in format for label processing (shared/label-utils)
   */
  async getTemplatesForLabeling(): Promise<TemplateInterface[]> {
    const templates = await this.findActive();
    return templates.map(t => ({
      name: t.name,
      first_page_patterns: t.firstPagePatterns || [],
      last_page_patterns: t.lastPagePatterns || undefined,
      first_page_negative_patterns: t.firstPageNegativePatterns || undefined,
      last_page_negative_patterns: t.lastPageNegativePatterns || undefined,
      category: t.category || undefined,
      is_single_page: t.isSinglePage,
      context_rules: t.contextRules || undefined,
    }));
  }

  /**
   * Clear all templates
   */
  async clearAll(): Promise<void> {
    await this.templateRepository.clear();
  }
}
