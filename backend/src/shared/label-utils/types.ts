/**
 * Shared types for label processing
 */

export interface ContextRules {
  requirePreviousCategory?: string;
  blockPreviousCategory?: string;
}

export interface Template {
  name: string;
  first_page_patterns: string | string[][];
  last_page_patterns?: string | string[][];
  first_page_negative_patterns?: string | string[][];
  last_page_negative_patterns?: string | string[][];
  category?: string;
  is_single_page?: boolean;
  context_rules?: ContextRules | null;
}

export interface TemplatesConfig {
  templates: Template[];
}

export interface MatchResult {
  matched: boolean;
  reason: string;
  matchedPatterns?: string[];
}

export interface PatternCheckResult {
  found: boolean;
  score: number;
  strategy?: 'exact' | 'partial' | 'prefix' | 'suffix' | 'fuzzy' | 'ngram' | 'none';
  matchedText?: string;
}

export interface NegativeCheckResult {
  blocked: boolean;
  reason: string;
}

export interface TemplateMatchResult {
  template: Template | null;
  matchReason: string;
}

export type LabelStatus = 'start' | 'continue' | 'end' | 'single' | 'unmatched';

export interface PageLabel {
  templateName: string | null;
  category: string;
  status: LabelStatus;
  matchReason: string;
  documentId: number | null;
  pageInDocument: number | null;
}

export interface LabelProcessResult {
  pageLabels: PageLabel[];
  matched: number;
  total: number;
  percentage: number;
}

/**
 * Callback for logging during label processing
 */
export type LogCallback = (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;

/**
 * File data needed for labeling
 */
export interface FileForLabeling {
  id: number;
  orderInGroup: number;
  originalName: string;
  storagePath: string;
  ocrText: string | null;
}

/**
 * Document range for document-based labeling
 */
export interface DocumentRange {
  templateName: string;
  category: string;
  startPage: number;  // orderInGroup of first page
  endPage: number;    // orderInGroup of last page
  pageCount: number;
  documentDate?: Date | null;
}
