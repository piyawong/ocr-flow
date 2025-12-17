/**
 * Pattern Matching Utilities for Label Processing
 * Exact Match Only - No fuzzy matching
 */

import {
  Template,
  MatchResult,
  PatternCheckResult,
  NegativeCheckResult,
  TemplateMatchResult,
  PageLabel,
  LabelProcessResult,
  LogCallback,
  FileForLabeling,
} from './types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract text from OCR result (handles JSON format)
 */
export function extractOcrText(ocrText: string): string {
  if (!ocrText) return '';

  try {
    const parsed = JSON.parse(ocrText);
    if (parsed.natural_text) {
      return parsed.natural_text;
    }
    if (parsed.text) {
      return parsed.text;
    }
    return JSON.stringify(parsed);
  } catch {
    return ocrText;
  }
}

/**
 * Normalize text for comparison (lowercase, trim, collapse whitespace, convert Thai numerals to Arabic)
 */
function normalizeText(text: string): string {
  // Thai numerals mapping
  const thaiToArabic: { [key: string]: string } = {
    '๐': '0',
    '๑': '1',
    '๒': '2',
    '๓': '3',
    '๔': '4',
    '๕': '5',
    '๖': '6',
    '๗': '7',
    '๘': '8',
    '๙': '9',
  };

  // Replace Thai numerals with Arabic numerals
  let normalized = text;
  for (const [thai, arabic] of Object.entries(thaiToArabic)) {
    normalized = normalized.replace(new RegExp(thai, 'g'), arabic);
  }

  // Lowercase, trim, collapse whitespace
  return normalized.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// EXACT MATCH ONLY
// ============================================================================

/**
 * Exact Match Only
 * Check if text contains the exact pattern
 */
export function containsPattern(
  text: string,
  pattern: string,
): PatternCheckResult {
  const normalizedText = normalizeText(text);
  const normalizedPattern = normalizeText(pattern);

  if (normalizedText.includes(normalizedPattern)) {
    return {
      found: true,
      score: 1.0,
      strategy: 'exact',
      matchedText: pattern,
    };
  }

  return { found: false, score: 0, strategy: 'none' };
}

// ============================================================================
// PATTERN VARIANT CHECKING (AND/OR Logic)
// ============================================================================

/**
 * Check if all patterns in a variant match (AND logic)
 */
export function checkPatternVariant(
  text: string,
  patterns: string[],
): MatchResult {
  const matchedPatterns: string[] = [];

  for (const pattern of patterns) {
    const result = containsPattern(text, pattern);
    if (!result.found) {
      return { matched: false, reason: `missing:'${pattern}'` };
    }

    matchedPatterns.push(`exact:'${pattern}'`);
  }

  return {
    matched: true,
    reason: matchedPatterns.join(', '),
    matchedPatterns,
  };
}

/**
 * Check patterns (can be string or array of arrays - OR logic between variants)
 */
export function checkPatterns(
  text: string,
  patterns: string | string[][] | undefined,
): MatchResult {
  if (!patterns) {
    return { matched: false, reason: 'no patterns defined' };
  }

  // Single string pattern
  if (typeof patterns === 'string') {
    const result = containsPattern(text, patterns);
    if (result.found) {
      return { matched: true, reason: `exact:'${patterns}'` };
    }
    return { matched: false, reason: `missing:'${patterns}'` };
  }

  // Array of arrays (multiple variants with AND logic within each)
  for (const variant of patterns) {
    const result = checkPatternVariant(text, variant);
    if (result.matched) {
      return result;
    }
  }

  return { matched: false, reason: 'no variant matched' };
}

/**
 * Check negative patterns (patterns that should NOT match)
 * Uses exact matching only
 */
export function checkNegativePatterns(
  text: string,
  patterns: string | string[][] | undefined,
): NegativeCheckResult {
  if (!patterns) {
    return { blocked: false, reason: '' };
  }

  if (typeof patterns === 'string') {
    const result = containsPattern(text, patterns);
    if (result.found) {
      return { blocked: true, reason: `negative:'${patterns}'` };
    }
    return { blocked: false, reason: '' };
  }

  for (const variant of patterns) {
    const allMatch = variant.every(p => containsPattern(text, p).found);
    if (allMatch) {
      return { blocked: true, reason: `negative:${JSON.stringify(variant)}` };
    }
  }

  return { blocked: false, reason: '' };
}

// ============================================================================
// TEMPLATE MATCHING
// ============================================================================

/**
 * Find matching template for first page
 * @param text - OCR text to match
 * @param templates - List of templates to check
 * @param previousTemplate - Previous document's template (for context-based matching)
 */
export function findFirstPageTemplate(
  text: string,
  templates: Template[],
  previousTemplate?: Template | null,
): TemplateMatchResult {
  for (const template of templates) {
    // 1. Check first_page_patterns
    const matchResult = checkPatterns(text, template.first_page_patterns);
    if (!matchResult.matched) continue;

    // 2. Check first_page_negative_patterns
    const negativeResult = checkNegativePatterns(
      text,
      template.first_page_negative_patterns,
    );
    if (negativeResult.blocked) {
      continue;
    }

    // 3. NEW: Check context_rules (if defined)
    if (template.context_rules) {
      const { requirePreviousCategory, blockPreviousCategory } = template.context_rules;

      // If requirePreviousCategory is set, previous document must have this category
      if (requirePreviousCategory) {
        if (!previousTemplate || previousTemplate.category !== requirePreviousCategory) {
          continue; // Skip this template
        }
      }

      // If blockPreviousCategory is set, previous document must NOT have this category
      if (blockPreviousCategory) {
        if (previousTemplate && previousTemplate.category === blockPreviousCategory) {
          continue; // Skip this template
        }
      }
    }

    return { template, matchReason: matchResult.reason };
  }

  return { template: null, matchReason: 'no template matched' };
}

/**
 * Check if page matches last_page_patterns of a template
 */
export function checkLastPage(
  text: string,
  template: Template,
): MatchResult {
  if (!template.last_page_patterns) {
    return { matched: false, reason: 'no last_page_patterns defined' };
  }

  const matchResult = checkPatterns(text, template.last_page_patterns);
  if (!matchResult.matched) {
    return matchResult;
  }

  const negativeResult = checkNegativePatterns(
    text,
    template.last_page_negative_patterns,
  );
  if (negativeResult.blocked) {
    return { matched: false, reason: negativeResult.reason };
  }

  return matchResult;
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process a group of files and generate labels
 * This is the core labeling logic shared by both infinity loop and relabel
 */
export function processFilesForLabeling(
  files: FileForLabeling[],
  templates: Template[],
  log?: LogCallback,
): LabelProcessResult {
  const logFn = log || (() => {});

  let currentTemplate: Template | null = null;
  let previousTemplate: Template | null = null; // ✅ NEW: Track previous document
  let documentId = 0;
  let pageInDocument = 0;

  const pageLabels: PageLabel[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ocrText = extractOcrText(file.ocrText || '');

    let label: PageLabel;

    if (currentTemplate === null) {
      // Looking for a new document start
      const { template, matchReason } = findFirstPageTemplate(
        ocrText,
        templates,
        previousTemplate, // ✅ NEW: Pass previous template for context
      );

      if (template) {
        documentId++;
        pageInDocument = 1;
        currentTemplate = template;

        if (template.is_single_page) {
          // Single page document
          label = {
            templateName: template.name,
            category: template.category || '',
            status: 'single',
            matchReason,
            documentId,
            pageInDocument,
          };
          logFn(
            `  Page ${file.orderInGroup}: ${template.name} [SINGLE] - ${matchReason}`,
            'success',
          );
          previousTemplate = template; // ✅ NEW: Update previous template
          currentTemplate = null; // Reset for next document
        } else {
          // Multi-page document - BUT check if it ends on the same page
          const lastPageResult = checkLastPage(ocrText, currentTemplate);

          if (lastPageResult.matched) {
            // Both first and last patterns match in same page → single page document
            label = {
              templateName: template.name,
              category: template.category || '',
              status: 'single',
              matchReason: `${matchReason} + ${lastPageResult.reason}`,
              documentId,
              pageInDocument,
            };
            logFn(
              `  Page ${file.orderInGroup}: ${template.name} [SINGLE] - first+last in same page`,
              'success',
            );
            previousTemplate = template;
            currentTemplate = null; // Reset for next document
          } else {
            // Multi-page document start (no end pattern found)
            label = {
              templateName: template.name,
              category: template.category || '',
              status: 'start',
              matchReason,
              documentId,
              pageInDocument,
            };
            logFn(
              `  Page ${file.orderInGroup}: ${template.name} [START] - ${matchReason}`,
              'success',
            );
          }
        }
      } else {
        // No match - unmatched
        label = {
          templateName: null,
          category: '',
          status: 'unmatched',
          matchReason: 'no template matched',
          documentId: null,
          pageInDocument: null,
        };
        logFn(`  Page ${file.orderInGroup}: UNMATCHED`, 'warning');
      }
    } else {
      // Currently in a multi-page document
      pageInDocument++;

      // Check if this is the last page
      const lastPageResult = checkLastPage(ocrText, currentTemplate);

      if (lastPageResult.matched) {
        // End of document
        label = {
          templateName: currentTemplate.name,
          category: currentTemplate.category || '',
          status: 'end',
          matchReason: lastPageResult.reason,
          documentId,
          pageInDocument,
        };
        logFn(
          `  Page ${file.orderInGroup}: ${currentTemplate.name} [END] - ${lastPageResult.reason}`,
          'success',
        );
        previousTemplate = currentTemplate; // ✅ NEW: Update previous template
        currentTemplate = null; // Reset for next document
      } else {
        // Not end - treat as continuation (don't check for other template starts)
        label = {
          templateName: currentTemplate.name,
          category: currentTemplate.category || '',
          status: 'continue',
          matchReason: 'continuation',
          documentId,
          pageInDocument,
        };
        logFn(
          `  Page ${file.orderInGroup}: ${currentTemplate.name} [CONTINUE]`,
          'info',
        );
      }
    }

    pageLabels.push(label);
  }

  // ============================================================================
  // POST-PROCESSING: Handle incomplete multi-page documents
  // ============================================================================
  // If we're still in a multi-page document at the end (no END found),
  // mark all pages of that document as UNMATCHED
  if (currentTemplate !== null) {
    logFn(
      `  ⚠️ Multi-page document "${currentTemplate.name}" started but never ended - marking as UNMATCHED`,
      'warning',
    );

    // Find all pages belonging to the incomplete document
    for (let i = pageLabels.length - 1; i >= 0; i--) {
      const label = pageLabels[i];
      if (label.documentId === documentId) {
        // Mark as unmatched
        pageLabels[i] = {
          templateName: null,
          category: '',
          status: 'unmatched',
          matchReason: 'multi-page document incomplete (no END found)',
          documentId: null,
          pageInDocument: null,
        };
      } else {
        // Reached a different document, stop
        break;
      }
    }
  }

  // Calculate stats
  const matched = pageLabels.filter(l => l.status !== 'unmatched').length;
  const total = pageLabels.length;
  const percentage = total > 0 ? (matched / total) * 100 : 0;

  return {
    pageLabels,
    matched,
    total,
    percentage,
  };
}
