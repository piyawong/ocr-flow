export class CreateTemplateDto {
  name: string;
  firstPagePatterns?: string[][] | null;
  lastPagePatterns?: string[][] | null;
  firstPageNegativePatterns?: string[][] | null;
  lastPageNegativePatterns?: string[][] | null;
  category?: string | null;
  isSinglePage?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}
