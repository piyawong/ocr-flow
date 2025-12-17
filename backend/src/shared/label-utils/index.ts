/**
 * Shared Label Utilities
 * Export all types and functions for label processing
 */

// Types
export * from './types';

// Pattern matching functions
export {
  extractOcrText,
  containsPattern,
  checkPatternVariant,
  checkPatterns,
  checkNegativePatterns,
  findFirstPageTemplate,
  checkLastPage,
  processFilesForLabeling,
} from './pattern-matcher';
