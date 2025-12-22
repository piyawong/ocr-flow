'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { DocumentDatePicker } from '@/components/DocumentDatePicker';
import { fetchWithAuth, API_URL } from '@/lib/api';
import { RightPanelContent } from './components/RightPanelContent';
import { TemplateSelectionModal } from './components/TemplateSelectionModal';
import { ReviewNotesModal } from './components/ReviewNotesModal';
import { MissingDatesModal } from './components/MissingDatesModal';
import { OverlapWarningModal } from './components/OverlapWarningModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LabeledFile {
  id: number;
  groupId: number;
  orderInGroup: number;
  groupedFileId: number;
  originalName: string;
  storagePath: string;
  ocrText: string;
  templateName: string | null;
  category: string | null;
  labelStatus: 'start' | 'continue' | 'end' | 'single' | 'unmatched';
  matchReason: string;
  documentId: number | null;
  pageInDocument: number | null;
  documentDate: string | null;
}

interface Template {
  name: string;
  category: string;
}

interface PageLabel {
  id: number;
  groupedFileId: number;
  orderInGroup: number;
  originalName: string;
  storagePath: string;
  ocrText: string;
  templateName: string | null;
  category: string | null;
  labelStatus: 'start' | 'continue' | 'end' | 'single' | 'unmatched';
  matchReason: string | null;
  documentId: number | null;
  pageInDocument: number | null;
  isModified: boolean;
}

interface DocumentWithMissingDate {
  documentId: number;
  templateName: string;
  pageRange: {
    start: number; // 0-indexed
    end: number;   // 0-indexed
  };
  pageCount: number;
}

// API_URL removed - using fetchWithAuth from @/lib/api instead

// ⚠️ Note: This fuzzy matching is for CLIENT-SIDE OCR text search only (Manual Label UI)
// It is NOT used in auto-label logic (backend uses Exact Match only)
// Fuzzy matching helper for UI search (similar to Levenshtein distance)
function fuzzyMatch(text: string, pattern: string, threshold: number = 75): { match: boolean; score: number; indices: number[] } {
  if (!pattern || !text) return { match: false, score: 0, indices: [] };

  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match
  const exactIndex = textLower.indexOf(patternLower);
  if (exactIndex !== -1) {
    const indices: number[] = [];
    for (let i = exactIndex; i < exactIndex + pattern.length; i++) {
      indices.push(i);
    }
    return { match: true, score: 100, indices };
  }

  // Levenshtein distance for fuzzy matching
  const levenshtein = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i-1] === a[j-1]
          ? matrix[i-1][j-1]
          : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  };

  // Sliding window fuzzy match
  const windowSize = patternLower.length;
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i <= textLower.length - windowSize; i++) {
    const window = textLower.substring(i, i + windowSize);
    const distance = levenshtein(window, patternLower);
    const maxLen = Math.max(window.length, patternLower.length);
    const score = ((maxLen - distance) / maxLen) * 100;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore >= threshold && bestIndex !== -1) {
    const indices: number[] = [];
    for (let i = bestIndex; i < bestIndex + windowSize; i++) {
      indices.push(i);
    }
    return { match: true, score: Math.round(bestScore), indices };
  }

  return { match: false, score: Math.round(bestScore), indices: [] };
}

// Generate consistent color based on template name
const TEMPLATE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#84cc16', // lime
  '#ef4444', // red
  '#6366f1', // indigo
];

function getTemplateColor(templateName: string | null): string | null {
  if (!templateName) return null;

  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < templateName.length; i++) {
    const char = templateName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % TEMPLATE_COLORS.length;
  return TEMPLATE_COLORS[index];
}

// Sortable Page Item Component
interface SortablePageItemProps {
  page: PageLabel;
  idx: number;
  isSelected: boolean;
  isMatched: boolean;
  status: string | null;
  sidebarCollapsed: boolean;
  imageCacheBuster: number;
  tempRotations: Record<number, number>;
  documentDates: Record<string, string | null>;
  onSelect: () => void;
}

const SortablePageItem = React.memo(function SortablePageItem({
  page,
  idx,
  isSelected,
  isMatched,
  status,
  sidebarCollapsed,
  imageCacheBuster,
  tempRotations,
  documentDates,
  onSelect,
}: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms ease', // Faster transition
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // API_URL removed - using fetchWithAuth from @/lib/api instead

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on drag handle
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-page-index={idx}
      onClick={handleClick}
      className={`
        relative cursor-pointer transition-all duration-100 rounded-lg mb-1 overflow-hidden
        ${isSelected
          ? 'bg-blue-500/20 dark:bg-blue-400/25 ring-[3px] ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-card-bg shadow-xl shadow-blue-500/30 dark:shadow-blue-400/20 scale-[1.02]'
          : 'hover:bg-hover-bg'}
        ${status === 'start-pending' ? 'bg-success/20 ring-2 ring-success' : ''}
        ${status === 'start' ? 'bg-success/30 ring-2 ring-success' : ''}
        ${status === 'end' ? 'bg-danger/30 ring-2 ring-danger' : ''}
        ${status === 'middle' ? 'bg-blue-500/10 dark:bg-blue-400/10' : ''}
      `}
    >
      {sidebarCollapsed ? (
        <div className="p-2 flex items-center justify-center">
          <div className={`
            w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center transition-all
            ${isSelected
              ? 'bg-blue-500 dark:bg-blue-400 text-white shadow-lg ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1 ring-offset-card-bg'
              : isMatched
                ? 'bg-success text-white'
                : 'bg-hover-bg text-text-secondary'}
          `}>
            {idx + 1}
          </div>
        </div>
      ) : (
        <div className="p-2">
          {/* Drag Handle + Header with page number and status */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              {/* Drag Handle */}
              <div
                {...attributes}
                {...listeners}
                data-drag-handle="true"
                className="cursor-grab active:cursor-grabbing p-1 text-text-secondary hover:text-accent transition-colors"
                title="Drag to reorder"
                style={{
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3.5 h-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                </svg>
              </div>
              {/* Page number */}
              <div className={`
                flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold transition-all
                ${isSelected
                  ? 'bg-blue-500 dark:bg-blue-400 text-white shadow-md ring-1 ring-blue-400/50'
                  : 'bg-hover-bg text-text-secondary'}
              `}>
                {idx + 1}
              </div>
            </div>
            {isMatched ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-success/20 rounded-full">
                <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[9px] font-semibold text-success uppercase">Labeled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-danger/20 rounded-full">
                <svg className="w-3 h-3 text-danger" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-[9px] font-semibold text-danger uppercase">None</span>
              </div>
            )}
          </div>

          {/* Thumbnail with border indicator and center overlay */}
          <div className={`
            relative aspect-[3/4] rounded-md overflow-hidden mb-1.5 transition-all
            ${isSelected
              ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-md'
              : isMatched
                ? 'ring-1 ring-success/50'
                : 'ring-1 ring-danger/30'}
          `}>
            <img
              src={`${API_URL}/files/${page.groupedFileId}/preview?t=${imageCacheBuster}`}
              alt={`Page ${idx + 1}`}
              className="w-full h-full object-cover"
              loading="eager"
              style={{
                transform: `rotate(${tempRotations[page.groupedFileId] || 0}deg)`,
                transformOrigin: 'center center',
              }}
            />
            {/* Center overlay indicator */}
            <div className={`
              absolute inset-0 z-10 flex items-center justify-center
              transition-opacity duration-200 pointer-events-none
              ${isSelected ? 'opacity-0' : 'opacity-100'}
            `}>
              {isMatched ? (
                <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shadow-xl border-2 border-white">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-danger flex items-center justify-center shadow-xl border-2 border-white">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Template name */}
          <div className={`
            text-[10px] truncate font-medium px-1 py-0.5 rounded
            ${page.templateName
              ? 'text-success bg-success/10'
              : 'text-danger bg-danger/10'}
          `}>
            {page.templateName?.replace('.pdf', '') || 'Unmatched'}
          </div>

          {/* Document date (if exists) */}
          {page.documentId !== null && page.templateName && (() => {
            const dateKey = `${page.documentId}_${page.templateName}`;
            const docDate = documentDates[dateKey];

            if (docDate) {
              return (
                <div className="flex items-center gap-1 mt-1 px-1 py-0.5 bg-accent/10 rounded text-[9px] text-accent">
                  <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate font-medium">
                    {new Date(docDate).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  const prevRotation = prevProps.tempRotations[prevProps.page.groupedFileId] || 0;
  const nextRotation = nextProps.tempRotations[nextProps.page.groupedFileId] || 0;

  // Check if document date changed
  let prevDate = null;
  let nextDate = null;
  if (prevProps.page.documentId !== null && prevProps.page.templateName) {
    const dateKey = `${prevProps.page.documentId}_${prevProps.page.templateName}`;
    prevDate = prevProps.documentDates[dateKey];
  }
  if (nextProps.page.documentId !== null && nextProps.page.templateName) {
    const dateKey = `${nextProps.page.documentId}_${nextProps.page.templateName}`;
    nextDate = nextProps.documentDates[dateKey];
  }

  return (
    prevProps.page.id === nextProps.page.id &&
    prevProps.idx === nextProps.idx &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isMatched === nextProps.isMatched &&
    prevProps.status === nextProps.status &&
    prevProps.sidebarCollapsed === nextProps.sidebarCollapsed &&
    prevProps.imageCacheBuster === nextProps.imageCacheBuster &&
    prevProps.page.templateName === nextProps.page.templateName &&
    prevRotation === nextRotation &&
    prevDate === nextDate
  );
});

/**
 * Convert page labels to document ranges
 * Extracts document ranges from labeled pages
 */
function convertPagesToDocuments(
  pages: PageLabel[],
  documentDates: Record<string, string | null>
): Array<{
  templateName: string;
  category: string;
  startPage: number;
  endPage: number;
  documentDate?: string | null;
}> {
  type DocRange = {
    templateName: string;
    category: string;
    startPage: number;
    endPage: number;
    documentDate?: string | null;
  };

  type CurrentDoc = {
    templateName: string;
    category: string;
    startPage: number;
    endPage: number;
    documentNumber: number;
  };

  const documentRanges: DocRange[] = [];
  let currentDoc: CurrentDoc | null = null;

  pages.forEach((page, idx) => {
    if (page.labelStatus === 'start' || page.labelStatus === 'single') {
      // Close previous document
      if (currentDoc) {
        const { documentNumber, templateName, ...docWithoutNumber } = currentDoc;
        const dateKey = `${documentNumber}_${templateName}`;
        documentRanges.push({
          ...docWithoutNumber,
          templateName,
          documentDate: documentDates[dateKey] || null,
        });
      }

      // Start new document
      currentDoc = {
        templateName: page.templateName!,
        category: page.category || '',
        startPage: page.orderInGroup,
        endPage: page.orderInGroup,
        documentNumber: page.documentId || 0,
      };

      // Single page document -> close immediately
      if (page.labelStatus === 'single') {
        const { documentNumber, templateName, ...docWithoutNumber } = currentDoc;
        const dateKey = `${documentNumber}_${templateName}`;
        documentRanges.push({
          ...docWithoutNumber,
          templateName,
          documentDate: documentDates[dateKey] || null,
        });
        currentDoc = null;
      }
    } else if (page.labelStatus === 'continue' || page.labelStatus === 'end') {
      // Extend current document
      if (currentDoc) {
        currentDoc.endPage = page.orderInGroup;

        // End page -> close document
        if (page.labelStatus === 'end') {
          const { documentNumber, templateName, ...docWithoutNumber } = currentDoc;
          const dateKey = `${documentNumber}_${templateName}`;
          documentRanges.push({
            ...docWithoutNumber,
            templateName,
            documentDate: documentDates[dateKey] || null,
          });
          currentDoc = null;
        }
      }
    }
    // unmatched pages are not included in documents
  });

  // Close any remaining open document (shouldn't happen normally)
  if (currentDoc) {
    const doc = currentDoc as CurrentDoc; // Type assertion for destructuring
    const { documentNumber, templateName, ...docWithoutNumber } = doc;
    const dateKey = `${documentNumber}_${templateName}`;
    documentRanges.push({
      ...docWithoutNumber,
      templateName,
      documentDate: documentDates[dateKey] || null,
    });
  }

  return documentRanges;
}

// Find all matches in text
function findAllMatches(text: string, pattern: string, threshold: number = 75): Array<{ start: number; end: number; score: number; matchedText: string }> {
  if (!pattern || pattern.length < 2 || !text) return [];

  const matches: Array<{ start: number; end: number; score: number; matchedText: string }> = [];
  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Find exact matches first
  let searchIndex = 0;
  while (true) {
    const idx = textLower.indexOf(patternLower, searchIndex);
    if (idx === -1) break;
    matches.push({
      start: idx,
      end: idx + pattern.length,
      score: 100,
      matchedText: text.substring(idx, idx + pattern.length)
    });
    searchIndex = idx + 1;
  }

  // If no exact matches, try fuzzy on words
  if (matches.length === 0) {
    const words = text.split(/(\s+)/);
    let currentIndex = 0;

    for (const word of words) {
      if (word.trim().length >= pattern.length - 2) {
        const result = fuzzyMatch(word, pattern, threshold);
        if (result.match && result.score < 100) {
          matches.push({
            start: currentIndex,
            end: currentIndex + word.length,
            score: result.score,
            matchedText: word
          });
        }
      }
      currentIndex += word.length;
    }
  }

  return matches;
}

export default function ManualLabelPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { canAccessStage03 } = usePermission();
  const groupId = parseInt(params.groupId as string);

  const [pages, setPages] = useState<PageLabel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [endPage, setEndPage] = useState<number | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [ocrSearch, setOcrSearch] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [showOcrText, setShowOcrText] = useState(false);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'info' | 'templates' | 'ocr' | 'documents'>('info');
  const [showLabelOverlay, setShowLabelOverlay] = useState(true);
  const [allGroups, setAllGroups] = useState<Array<{ groupId: number; matchPercentage: number }>>([]);
  const [imageCacheBuster, setImageCacheBuster] = useState(() => Date.now()); // Force image reload after rotation
  const [activeId, setActiveId] = useState<number | null>(null);

  // Temp changes tracking (until Save is pressed)
  const [tempRotations, setTempRotations] = useState<Record<number, number>>({}); // { groupedFileId: degrees }
  const [originalOrder, setOriginalOrder] = useState<number[]>([]); // Original page IDs order

  // Document dates tracking (NEW!)
  const [documentDates, setDocumentDates] = useState<Record<string, string | null>>({}); // key = `${documentId}_${templateName}`
  const [pendingTemplateSelection, setPendingTemplateSelection] = useState<{
    template: Template;
    startPage: number;
    endPage: number;
  } | null>(null);

  // Missing Dates Warning Modal (NEW!)
  const [showMissingDatesModal, setShowMissingDatesModal] = useState(false);
  const [documentsWithMissingDates, setDocumentsWithMissingDates] = useState<DocumentWithMissingDate[]>([]);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState('');

  // Overlap detection states
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [overlappedDocuments, setOverlappedDocuments] = useState<Array<{
    id: number;
    documentNumber: number;
    templateName: string;
    category: string;
    startPage: number;
    endPage: number;
    pageCount: number;
    overlapType: 'full' | 'partial';
    overlapPages: { start: number; end: number };
  }>>([]);

  // Pending template assignment (for overlap confirmation)
  const [pendingAssignment, setPendingAssignment] = useState<{
    template: Template;
    startPage: number;
    endPage: number;
    documentNumber: number;
    date: string | null;
  } | null>(null);

  // Reset editing states when modal closes
  useEffect(() => {
    if (!showMissingDatesModal) {
      setEditingDocId(null);
      setTempDate('');
    }
  }, [showMissingDatesModal]);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const pageListRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop sensors with minimal constraints for smoothest experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Very small distance for immediate drag response
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use refs for pinch-to-zoom to avoid stale closure issues
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(100);
  const zoomRef = useRef<number>(100);
  const touchListenersInstalledRef = useRef<boolean>(false);

  // Sync zoom ref with zoom state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Auto scroll to selected page in sidebar
  useEffect(() => {
    if (pageListRef.current) {
      const selectedElement = pageListRef.current.querySelector(`[data-page-index="${selectedPageIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedPageIndex]);

  // Reset pan when changing pages
  useEffect(() => {
    setImagePan({ x: 0, y: 0 });
  }, [selectedPageIndex]);

  // Handle mouse wheel zoom - wait for DOM to be ready
  useEffect(() => {
    if (loading) return; // Wait for data to load first

    const imageContainer = imageContainerRef.current;
    if (!imageContainer) {
      console.warn('Wheel: imageContainer is null');
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoom(prev => Math.max(25, Math.min(300, prev + delta)));
    };

    imageContainer.addEventListener('wheel', handleWheel, { passive: false });
    console.log('✅ Wheel event listener installed');

    return () => imageContainer.removeEventListener('wheel', handleWheel);
  }, [loading]);

  // Handle touch events for pinch-to-zoom - wait for DOM to be ready
  useEffect(() => {
    if (loading) return; // Wait for data to load first

    const imageContainer = imageContainerRef.current;
    console.log('Touch useEffect running, loading:', loading, 'imageContainer:', imageContainer);

    if (!imageContainer) {
      console.warn('Touch: imageContainer is null, cannot attach touch listeners');
      return;
    }

    if (touchListenersInstalledRef.current) {
      console.log('Touch listeners already installed, skipping');
      return;
    }

    console.log('Installing touch event listeners on:', imageContainer);

    const handleTouchStartNative = (e: TouchEvent) => {
      console.log('TouchStart triggered, touches:', e.touches.length);
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        initialPinchDistanceRef.current = distance;
        initialZoomRef.current = zoomRef.current;

        console.log('Pinch start:', { distance, currentZoom: zoomRef.current });
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      console.log('TouchMove triggered, touches:', e.touches.length);
      if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const rawScale = currentDistance / initialPinchDistanceRef.current;

        // Reduce sensitivity: use a damping factor to make zoom less aggressive
        // Formula: 1 + (rawScale - 1) * sensitivity
        // sensitivity = 0.5 means half the zoom speed
        const sensitivity = 0.5;
        const scale = 1 + (rawScale - 1) * sensitivity;

        const newZoom = Math.max(25, Math.min(300, initialZoomRef.current * scale));

        console.log('Pinch move:', { currentDistance, rawScale, scale, newZoom });
        setZoom(newZoom);
      }
    };

    const handleTouchEndNative = () => {
      initialPinchDistanceRef.current = null;
      console.log('Pinch end');
    };

    const handleTouchCancelNative = () => {
      initialPinchDistanceRef.current = null;
      console.log('Pinch cancel');
    };

    // Add event listeners with options to prevent default browser behavior
    imageContainer.addEventListener('touchstart', handleTouchStartNative, { passive: false });
    imageContainer.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    imageContainer.addEventListener('touchend', handleTouchEndNative, { passive: false });
    imageContainer.addEventListener('touchcancel', handleTouchCancelNative, { passive: false });

    // Prevent context menu on long press
    imageContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    touchListenersInstalledRef.current = true;
    console.log('✅ Touch event listeners installed successfully');

    return () => {
      console.log('🧹 Cleaning up touch event listeners');
      imageContainer.removeEventListener('touchstart', handleTouchStartNative);
      imageContainer.removeEventListener('touchmove', handleTouchMoveNative);
      imageContainer.removeEventListener('touchend', handleTouchEndNative);
      imageContainer.removeEventListener('touchcancel', handleTouchCancelNative);
      touchListenersInstalledRef.current = false;
    };
  }, [loading]); // Re-run when loading changes

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setImagePan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    setZoom(100);
    setImagePan({ x: 0, y: 0 });
  };

  // Reset zoom handler
  const handleResetZoom = () => {
    setZoom(100);
    setImagePan({ x: 0, y: 0 });
  };

  // Rotate image handler (temp change only)
  const handleRotate = (degrees: number) => {
    if (!currentPage) return;

    const fileId = currentPage.groupedFileId;
    setTempRotations(prev => ({
      ...prev,
      [fileId]: (prev[fileId] || 0) + degrees
    }));
    setHasUnsavedChanges(true);
  };

  // Fetch data function (extracted to useCallback for reuse)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [filesRes, templatesRes, summaryRes] = await Promise.all([
        fetchWithAuth(`/labeled-files/group/${groupId}`),
        fetchWithAuth(`/labeled-files/templates`),
        fetchWithAuth(`/labeled-files/summary`),
      ]);

      const files: LabeledFile[] = await filesRes.json();
      const templatesList: Template[] = await templatesRes.json();
      const summaryData = await summaryRes.json();

      // Extract groups with their match percentages (API returns array directly)
      if (Array.isArray(summaryData)) {
        const groups = summaryData.map((g: { groupId: number; matchPercentage: number }) => ({
          groupId: g.groupId,
          matchPercentage: Math.round(g.matchPercentage),
        }));
        setAllGroups(groups.sort((a: { groupId: number }, b: { groupId: number }) => a.groupId - b.groupId));
      }

      const pagesData = files.map(f => ({
        id: f.id,
        groupedFileId: f.groupedFileId,
        orderInGroup: f.orderInGroup,
        originalName: f.originalName,
        storagePath: f.storagePath,
        ocrText: f.ocrText,
        templateName: f.templateName,
        category: f.category,
        labelStatus: f.labelStatus,
        matchReason: f.matchReason,
        documentId: f.documentId,
        pageInDocument: f.pageInDocument,
        isModified: false,
      }));

      // Extract document dates from response
      const dates: Record<string, string | null> = {};
      files.forEach(f => {
        if (f.documentId !== null && f.templateName) {
          const key = `${f.documentId}_${f.templateName}`;
          if (f.documentDate) {
            console.log(`📅 Found date for ${key}:`, f.documentDate);
            dates[key] = f.documentDate;
          } else {
            console.log(`⚠️ No date for ${key}`);
          }
        }
      });
      console.log('📅 Final documentDates:', dates);
      setDocumentDates(dates);

      setPages(pagesData);
      setOriginalOrder(pagesData.map(p => p.id)); // Save original order
      setTemplates(templatesList);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  }, [groupId]);

  // Fetch data on mount and when groupId changes
  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId, fetchData]);

  // ✅ Lock group on mount, unlock on unmount
  useEffect(() => {
    if (!groupId) return;

    let lockAcquired = false;

    // Try to lock the group
    const lockGroup = async () => {
      try {
        const res = await fetchWithAuth(`/files/group/${groupId}/lock`, {
          method: 'POST',
        });

        if (!res.ok) {
          const error = await res.json();
          if (res.status === 409) {
            // Group is locked by another user
            alert(
              `⚠️ This group is currently being edited by ${error.lockedByName}.\n\n` +
              `You cannot edit it until they finish.\n\n` +
              `Returning to group list...`
            );
            router.push('/stages/03-pdf-label');
            return;
          }
          throw new Error('Failed to lock group');
        }

        lockAcquired = true;
        console.log('✅ Group locked successfully');
      } catch (err) {
        console.error('Failed to lock group:', err);
        alert('Failed to lock group. Returning to list.');
        router.push('/stages/03-pdf-label');
      }
    };

    lockGroup();

    // Heartbeat: Renew lock every 5 minutes
    const heartbeatInterval = setInterval(async () => {
      if (lockAcquired) {
        try {
          await fetchWithAuth(`/files/group/${groupId}/lock/renew`, {
            method: 'PUT',
          });
          console.log('✅ Lock renewed');
        } catch (err) {
          console.error('Failed to renew lock:', err);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Unlock on unmount
    return () => {
      clearInterval(heartbeatInterval);

      if (lockAcquired) {
        // Unlock group (fire and forget)
        fetchWithAuth(`/files/group/${groupId}/lock`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to unlock group:', err));
      }
    };
  }, [groupId, router]);

  // Navigation functions
  const goToNextFolder = () => {
    const currentIndex = allGroups.findIndex(g => g.groupId === groupId);
    if (currentIndex !== -1 && currentIndex < allGroups.length - 1) {
      const nextGroup = allGroups[currentIndex + 1];
      router.push(`/stages/03-pdf-label/manual/${nextGroup.groupId}`);
    }
  };

  const goToPrevFolder = () => {
    const currentIndex = allGroups.findIndex(g => g.groupId === groupId);
    if (currentIndex > 0) {
      const prevGroup = allGroups[currentIndex - 1];
      router.push(`/stages/03-pdf-label/manual/${prevGroup.groupId}`);
    }
  };

  const goToNextIncompleteFolder = () => {
    const currentIndex = allGroups.findIndex(g => g.groupId === groupId);
    // Find next folder with < 100% match
    for (let i = currentIndex + 1; i < allGroups.length; i++) {
      if (allGroups[i].matchPercentage < 100) {
        router.push(`/stages/03-pdf-label/manual/${allGroups[i].groupId}`);
        return;
      }
    }
    // If not found after current, search from beginning
    for (let i = 0; i < currentIndex; i++) {
      if (allGroups[i].matchPercentage < 100) {
        router.push(`/stages/03-pdf-label/manual/${allGroups[i].groupId}`);
        return;
      }
    }
    alert('All folders are 100% labeled!');
  };

  // Save handler ref for keyboard shortcut
  const handleSaveRef = useRef<(() => void) | undefined>(undefined);
  handleSaveRef.current = () => {
    handleSave();
  };

  const currentGroupIndex = allGroups.findIndex(g => g.groupId === groupId);
  const hasNextFolder = currentGroupIndex !== -1 && currentGroupIndex < allGroups.length - 1;
  const hasPrevFolder = currentGroupIndex > 0;
  const hasIncompleteFolder = allGroups.some(g => g.matchPercentage < 100 && g.groupId !== groupId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setSelectedPageIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          setSelectedPageIndex(prev => Math.min(pages.length - 1, prev + 1));
          break;
        case ' ':
          e.preventDefault();
          handleSpacePress();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          if (startPage !== null && endPage !== null) {
            setIsTemplateModalOpen(true);
          }
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          setStartPage(null);
          setEndPage(null);
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          if (isTemplateModalOpen) {
            setIsTemplateModalOpen(false);
          } else if (startPage !== null || endPage !== null) {
            setStartPage(null);
            setEndPage(null);
          } else {
            setShowShortcuts(false);
          }
          break;
        case 's':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSaveRef.current?.();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (startPage !== null && endPage !== null) {
            e.preventDefault();
            const idx = parseInt(e.key) - 1;
            const filteredTemplates = templates.filter(t =>
              t.name.toLowerCase().includes(templateSearch.toLowerCase())
            );
            if (idx < filteredTemplates.length) {
              handleTemplateSelect(filteredTemplates[idx]);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pages, selectedPageIndex, startPage, endPage, isTemplateModalOpen, templateSearch, templates]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSpacePress = () => {
    if (startPage === null) {
      setStartPage(selectedPageIndex);
    } else if (endPage === null) {
      if (selectedPageIndex >= startPage) {
        setEndPage(selectedPageIndex);
        setIsTemplateModalOpen(true);
      }
    } else {
      setStartPage(selectedPageIndex);
      setEndPage(null);
    }
  };

  const handlePageClick = (idx: number) => {
    if (startPage === null) {
      setStartPage(idx);
      setSelectedPageIndex(idx);
    } else if (endPage === null) {
      if (idx >= startPage) {
        setEndPage(idx);
        setSelectedPageIndex(idx);
        setIsTemplateModalOpen(true);
      } else {
        setStartPage(idx);
        setSelectedPageIndex(idx);
      }
    } else {
      setStartPage(idx);
      setEndPage(null);
      setSelectedPageIndex(idx);
    }
  };

  // Helper: Get next document number
  const getNextDocumentNumber = (): number => {
    // Check if selected pages already have documentId
    const existingDocId = pages[startPage!]?.documentId;
    if (existingDocId) {
      return existingDocId;
    }

    // Find max documentId in current pages
    const maxDocId = Math.max(0, ...pages.map(p => p.documentId || 0));
    return maxDocId + 1;
  };

  // ✅ NEW: Check overlap from local state
  const checkOverlapLocal = (start: number, end: number): {
    hasOverlap: boolean;
    affectedDocuments: Array<{
      id: number;
      documentNumber: number;
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      pageCount: number;
      overlapType: 'full' | 'partial';
      overlapPages: { start: number; end: number };
    }>;
  } => {
    // Build list of existing documents from current pages state
    const documentsMap = new Map<string, {
      documentId: number;
      templateName: string;
      category: string;
      startIdx: number;
      endIdx: number;
    }>();

    pages.forEach((page, idx) => {
      if (page.documentId !== null && page.templateName) {
        const key = `${page.documentId}_${page.templateName}`;
        if (!documentsMap.has(key)) {
          documentsMap.set(key, {
            documentId: page.documentId,
            templateName: page.templateName,
            category: page.category || '',
            startIdx: idx,
            endIdx: idx,
          });
        } else {
          const doc = documentsMap.get(key)!;
          doc.endIdx = idx;
        }
      }
    });

    const affectedDocuments: Array<{
      id: number;
      documentNumber: number;
      templateName: string;
      category: string;
      startPage: number;
      endPage: number;
      pageCount: number;
      overlapType: 'full' | 'partial';
      overlapPages: { start: number; end: number };
    }> = [];

    // Check each existing document for overlap
    documentsMap.forEach((doc) => {
      // Check if ranges overlap
      const hasOverlap = !(end < doc.startIdx || start > doc.endIdx);

      if (hasOverlap) {
        // Calculate overlap range
        const overlapStart = Math.max(start, doc.startIdx);
        const overlapEnd = Math.min(end, doc.endIdx);

        // Determine overlap type
        const isFullOverlap = (
          overlapStart === doc.startIdx &&
          overlapEnd === doc.endIdx
        );

        affectedDocuments.push({
          id: doc.documentId,
          documentNumber: doc.documentId,
          templateName: doc.templateName,
          category: doc.category,
          startPage: doc.startIdx + 1, // Convert to 1-based
          endPage: doc.endIdx + 1,
          pageCount: doc.endIdx - doc.startIdx + 1,
          overlapType: isFullOverlap ? 'full' : 'partial',
          overlapPages: {
            start: overlapStart + 1, // Convert to 1-based
            end: overlapEnd + 1,
          },
        });
      }
    });

    return {
      hasOverlap: affectedDocuments.length > 0,
      affectedDocuments,
    };
  };

  const handleTemplateSelect = (template: Template) => {
    if (startPage === null || endPage === null) return;

    // ✅ Check overlap from local state (faster than API call)
    const overlapResult = checkOverlapLocal(startPage, endPage);

    if (overlapResult.hasOverlap) {
      // Show warning modal
      const documentNumber = getNextDocumentNumber();
      setOverlappedDocuments(overlapResult.affectedDocuments);
      setPendingAssignment({
        template,
        startPage,
        endPage,
        documentNumber,
        date: null,
      });
      setShowOverlapModal(true);
      setIsTemplateModalOpen(false);
      return; // Stop here, wait for user confirmation
    }

    // No overlap, proceed directly
    const documentNumber = getNextDocumentNumber();
    assignTemplateToPages(template, startPage, endPage, documentNumber, null);

    // Close template modal
    setIsTemplateModalOpen(false);
  };

  // Helper function to assign template to pages
  const assignTemplateToPages = useCallback((
    template: Template,
    start: number,
    end: number,
    documentNumber: number,
    date: string | null,
    clearAffectedDocumentIds?: number[], // ✅ NEW: IDs of documents to clear
  ) => {
    const pageCount = end - start + 1;
    const isSingle = pageCount === 1;

    // Save document date
    const key = `${documentNumber}_${template.name}`;
    setDocumentDates(prev => ({
      ...prev,
      [key]: date,
    }));

    // ✅ Apply template to pages (2 passes to handle overlap correctly)
    setPages(prev => {
      // Pass 1: Clear pages that belong to affected documents
      let updatedPages = prev;
      if (clearAffectedDocumentIds && clearAffectedDocumentIds.length > 0) {
        updatedPages = prev.map((page) => {
          if (page.documentId !== null && clearAffectedDocumentIds.includes(page.documentId)) {
            // Clear this page (remove template)
            return {
              ...page,
              templateName: null,
              category: null,
              labelStatus: 'unmatched',
              documentId: null,
              pageInDocument: null,
              isModified: true,
            };
          }
          return page;
        });
      }

      // Pass 2: Assign new template to selected pages
      return updatedPages.map((page, idx) => {
        if (idx >= start && idx <= end) {
          let status: PageLabel['labelStatus'];
          if (isSingle) {
            status = 'single';
          } else if (idx === start) {
            status = 'start';
          } else if (idx === end) {
            status = 'end';
          } else {
            status = 'continue';
          }

          return {
            ...page,
            templateName: template.name,
            category: template.category,
            labelStatus: status,
            documentId: documentNumber,
            pageInDocument: idx - start + 1,
            isModified: true,
          };
        }
        return page;
      });
    });

    setHasUnsavedChanges(true);
    setStartPage(null);
    setEndPage(null);
    setPendingTemplateSelection(null);
    // setDocumentDateModal(prev => ({ ...prev, isOpen: false })); // Commented out - using inline picker now
    setPendingAssignment(null);

    // ✅ Don't auto-jump to next unmatched page - keep focus on current page
  }, []);

  // ✅ REMOVED: handleDocumentDateConfirm() - no longer needed
  // Overlap check is now done in handleTemplateSelect() using checkOverlapLocal()
  // Date editing is done inline using DocumentDatePicker

  // Perform actual save (called after notes modal if needed)
  const performSave = useCallback(async (notes?: string) => {
    if (isSaving) return;

    const modifiedPages = pages.filter(p => p.isModified);
    const hasRotations = Object.keys(tempRotations).length > 0;
    const hasReorder = JSON.stringify(pages.map(p => p.id)) !== JSON.stringify(originalOrder);

    const reviewerName = user?.name;
    if (!reviewerName) return;

    setIsSaving(true);
    try {
      // 1. Save rotations first (to update actual files)
      if (hasRotations) {
        for (const [fileIdStr, totalDegrees] of Object.entries(tempRotations)) {
          const fileId = parseInt(fileIdStr);
          if (totalDegrees !== 0) {
            const res = await fetchWithAuth(`/files/${fileId}/rotate`, {
              method: 'POST',
              body: JSON.stringify({ degrees: totalDegrees }),
            });
            if (!res.ok) {
              throw new Error(`Failed to rotate file ${fileId}`);
            }
          }
        }
        // Clear rotation state and force image reload
        setTempRotations({});
        setImageCacheBuster(Date.now());
      }

      // 2. Save reorder (to update orderInGroup)
      if (hasReorder) {
        const reorderedFiles = pages.map((page, index) => ({
          id: page.groupedFileId,
          newOrder: index + 1,
        }));

        const res = await fetchWithAuth(`/files/group/${groupId}/reorder`, {
          method: 'PUT',
          body: JSON.stringify({ reorderedFiles }),
        });

        if (!res.ok) {
          throw new Error('Failed to save reorder');
        }

        // Update original order after successful save
        setOriginalOrder(pages.map(p => p.id));

        // Update orderInGroup in state
        setPages((prev) =>
          prev.map((page, idx) => ({
            ...page,
            orderInGroup: idx + 1,
          }))
        );
      }

      // 3. ✅ Save labels as documents (document-based)
      // Note: Overlap check is done at label time (handleTemplateSelect), not here
      if (modifiedPages.length > 0 || Object.keys(documentDates).length > 0) {
        // Convert page labels to document ranges
        const documentRanges = convertPagesToDocuments(pages, documentDates);

        const res = await fetchWithAuth(`/labeled-files/group/${groupId}/documents`, {
          method: 'POST',
          body: JSON.stringify({
            documents: documentRanges,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to save documents');
        }

        setPages(prev => prev.map(p => ({ ...p, isModified: false })));
      }

      // 4. ✅ Save notes and mark as reviewed (conditionally based on match %)
      const matchedCount = pages.filter(p => p.labelStatus !== 'unmatched').length;
      const totalCount = pages.length;
      const is100Matched = matchedCount === totalCount;

      // Always save notes, but mark as reviewed only when 100% matched
      const res = await fetchWithAuth(`/labeled-files/group/${groupId}/mark-reviewed`, {
        method: 'POST',
        body: JSON.stringify({
          reviewer: reviewerName,
          notes: notes || null,
          markAsReviewed: is100Matched, // Only mark as reviewed when 100% matched
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save notes');
      }

      // Success message
      const notesMessage = notes ? `\nNotes: ${notes}` : '';
      if (is100Matched) {
        // ✅ Unlock group before redirecting
        await fetchWithAuth(`/files/group/${groupId}/lock`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to unlock group:', err));

        alert(`✅ Changes saved successfully!\nReviewed by: ${reviewerName}\n100% matched (${matchedCount}/${totalCount} pages)${notesMessage}`);
        // Redirect back to 03-pdf-label after successful 100% save
        router.push('/stages/03-pdf-label');
      } else {
        alert(`✅ Changes saved successfully!${notesMessage}\n⚠️ Not marked as reviewed: Only ${matchedCount}/${totalCount} pages matched (${((matchedCount/totalCount)*100).toFixed(1)}%)\nPlease label all pages to 100% before marking as reviewed.`);

        // ✅ Reload data to reflect changes (since we're staying on this page)
        await fetchData();
      }

      setHasUnsavedChanges(false);
      setShowNotesModal(false);
      setReviewNotes('');
    } catch (err) {
      console.error('Error saving:', err);
      alert(`Failed to save changes: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, pages, tempRotations, originalOrder, groupId, documentDates, user, fetchData, router]);

  // Get all labeled documents (for Documents tab)
  const getLabeledDocuments = useCallback(() => {
    const documentsMap = new Map<string, DocumentWithMissingDate & { hasDate: boolean; date: string | null }>();

    pages.forEach((page, idx) => {
      if (page.documentId !== null && page.templateName) {
        const key = `${page.documentId}_${page.templateName}`;
        const dateKey = `${page.documentId}_${page.templateName}`;
        const date = documentDates[dateKey] || null;
        const hasDate = date !== null && date !== undefined;

        if (!documentsMap.has(key)) {
          // This is the first page we've seen for this document
          documentsMap.set(key, {
            documentId: page.documentId,
            templateName: page.templateName,
            pageRange: { start: idx, end: idx },
            pageCount: 1,
            hasDate,
            date,
          });
        } else {
          // Update page range and count
          const doc = documentsMap.get(key)!;
          doc.pageRange.end = idx;
          doc.pageCount++;
        }
      }
    });

    return Array.from(documentsMap.values());
  }, [pages, documentDates]);

  // Get documents with missing dates
  const getDocumentsWithMissingDates = useCallback((): DocumentWithMissingDate[] => {
    return getLabeledDocuments()
      .filter(doc => !doc.hasDate)
      .map(({ hasDate, date, ...rest }) => rest);
  }, [getLabeledDocuments]);

  const handleSave = useCallback(() => {
    // ✅ Check if user is logged in before saving
    if (!user?.name) {
      alert('Please log in to save changes.');
      return;
    }

    // ✅ Check for missing document dates
    const missingDates = getDocumentsWithMissingDates();
    if (missingDates.length > 0) {
      setDocumentsWithMissingDates(missingDates);
      setShowMissingDatesModal(true);
      return;
    }

    // ✅ If no missing dates, show notes modal (even without changes - acts as "approve")
    setShowNotesModal(true);
  }, [user, getDocumentsWithMissingDates]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/stages/03-pdf-label');
      }
    } else {
      router.push('/stages/03-pdf-label');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Update UI immediately (temp change)
    const newPages = arrayMove(pages, oldIndex, newIndex);
    setPages(newPages);

    // Update selected page index if needed
    if (selectedPageIndex === oldIndex) {
      setSelectedPageIndex(newIndex);
    } else if (oldIndex < selectedPageIndex && newIndex >= selectedPageIndex) {
      setSelectedPageIndex(selectedPageIndex - 1);
    } else if (oldIndex > selectedPageIndex && newIndex <= selectedPageIndex) {
      setSelectedPageIndex(selectedPageIndex + 1);
    }

    // Mark as unsaved (don't save yet)
    setHasUnsavedChanges(true);
  };

  const currentPage = pages[selectedPageIndex];
  const matchedCount = pages.filter(p => p.labelStatus !== 'unmatched').length;
  const progress = pages.length > 0 ? (matchedCount / pages.length) * 100 : 0;

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const isInSelection = (idx: number) => {
    if (startPage === null) return false;
    if (endPage === null) return idx === startPage;
    return idx >= startPage && idx <= endPage;
  };

  const getPageStatus = (idx: number) => {
    if (idx === startPage && endPage === null) return 'start-pending';
    if (idx === startPage) return 'start';
    if (idx === endPage) return 'end';
    if (isInSelection(idx)) return 'middle';
    return null;
  };

  // Permission check
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!canAccessStage03()) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Access Denied</h1>
          <p className="text-text-secondary">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading pages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card-bg border-b border-border-color">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="w-px h-5 bg-border-color"></div>
          <h1 className="text-base font-medium text-text-primary">Folder {groupId}</h1>

          {/* Progress Bar */}
          <div className="flex items-center gap-2 ml-2">
            <div className="w-32 h-1.5 bg-border-color rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-success transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className={`text-xs font-medium ${progress === 100 ? 'text-success' : 'text-text-secondary'}`}>
              {matchedCount}/{pages.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selection Mode Indicator */}
          {startPage !== null && (
            <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/30 rounded-lg">
              <span className="text-xs text-accent">
                {endPage === null
                  ? `Start: ${startPage + 1} → Select end page`
                  : `${startPage + 1} → ${endPage + 1} (${endPage - startPage + 1} pages)`
                }
              </span>
              <button
                onClick={() => { setStartPage(null); setEndPage(null); }}
                className="text-accent hover:text-accent/80"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            className="px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary border border-border-color rounded transition-colors"
          >
            <span className="hidden sm:inline">Shortcuts </span>?
          </button>

          {/* Folder Navigation */}
          <div className="flex items-center gap-1 border border-border-color rounded-lg overflow-hidden">
            <button
              onClick={goToPrevFolder}
              disabled={!hasPrevFolder}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs text-text-secondary px-1">
              {currentGroupIndex + 1}/{allGroups.length}
            </span>
            <button
              onClick={goToNextFolder}
              disabled={!hasNextFolder}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={goToNextIncompleteFolder}
            disabled={!hasIncompleteFolder}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              hasIncompleteFolder
                ? 'bg-warning/20 text-warning hover:bg-warning/30 border border-warning/30'
                : 'bg-hover-bg text-text-secondary cursor-not-allowed'
            }`}
            title="Go to next folder that is not 100% labeled"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Next Incomplete
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
              isSaving
                ? 'bg-hover-bg text-text-secondary cursor-not-allowed'
                : 'bg-success text-white hover:bg-success/90 shadow-lg shadow-success/30'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Page Thumbnails */}
        <div className={`${sidebarCollapsed ? 'w-12' : 'w-44'} bg-card-bg border-r border-border-color flex flex-col transition-all duration-200`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-2 border-b border-border-color">
            {!sidebarCollapsed && (
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Pages</span>
            )}
            <button
              onClick={() => setSidebarCollapsed(prev => !prev)}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Page List */}
          <div ref={pageListRef} className="flex-1 overflow-y-auto custom-scrollbar p-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pages.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {pages.map((page, idx) => {
                  const status = getPageStatus(idx);
                  const isSelected = idx === selectedPageIndex;
                  const isMatched = page.labelStatus !== 'unmatched';

                  return (
                    <SortablePageItem
                      key={page.id}
                      page={page}
                      idx={idx}
                      isSelected={isSelected}
                      isMatched={isMatched}
                      status={status}
                      sidebarCollapsed={sidebarCollapsed}
                      imageCacheBuster={imageCacheBuster}
                      tempRotations={tempRotations}
                      documentDates={documentDates}
                      onSelect={() => setSelectedPageIndex(idx)}
                    />
                  );
                })}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId ? (() => {
                  const activeIdx = pages.findIndex(p => p.id === activeId);
                  const activePage = pages[activeIdx];
                  if (!activePage) return null;

                  const tempRotation = tempRotations[activePage.groupedFileId] || 0;

                  return (
                    <div className="bg-card-bg rounded-lg shadow-2xl border-2 border-blue-500 dark:border-blue-400 p-2 w-44 opacity-90">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-500 dark:bg-blue-400 text-white rounded-md text-xs font-bold flex items-center justify-center">
                          {activeIdx + 1}
                        </div>
                        <div className="flex-1 text-xs font-medium text-text-primary truncate">
                          Dragging...
                        </div>
                      </div>
                      <div className="aspect-[3/4] rounded-md overflow-hidden ring-2 ring-blue-500 dark:ring-blue-400">
                        <img
                          src={`${API_URL}/files/${activePage.groupedFileId}/preview?t=${imageCacheBuster}`}
                          alt="Dragging"
                          className="w-full h-full object-cover"
                          style={{
                            transform: `rotate(${tempRotation}deg)`,
                            transformOrigin: 'center center',
                          }}
                        />
                      </div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        {/* Center - Document Preview */}
        <div className="flex-1 flex flex-col bg-bg-primary">
          {/* Preview Controls */}
          <div className="flex items-center justify-between px-3 py-2 bg-card-bg border-b border-border-color">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedPageIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedPageIndex === 0}
                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-text-primary min-w-[80px] text-center">
                {selectedPageIndex + 1} / {pages.length}
              </span>
              <button
                onClick={() => setSelectedPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                disabled={selectedPageIndex === pages.length - 1}
                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(prev => Math.max(25, prev - 25))}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                title="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-xs text-text-secondary min-w-[40px] text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(prev => Math.min(300, prev + 25))}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                title="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <div className="w-px h-4 bg-border-color mx-1"></div>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors"
                title="Reset zoom to 100%"
              >
                Reset
              </button>
              <div className="w-px h-4 bg-border-color mx-1"></div>
              {/* Rotate buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRotate(-90)}
                  className="group relative p-1.5 text-text-secondary hover:text-accent hover:bg-accent/10 rounded transition-all"
                >
                  {/* Rotate Left Icon - Counter-clockwise arrow */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  {/* Hover tooltip */}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    หมุนซ้าย 90°
                  </span>
                </button>
                <button
                  onClick={() => handleRotate(90)}
                  className="group relative p-1.5 text-text-secondary hover:text-accent hover:bg-accent/10 rounded transition-all"
                >
                  {/* Rotate Right Icon - Clockwise arrow */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                  </svg>
                  {/* Hover tooltip */}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    หมุนขวา 90°
                  </span>
                </button>
              </div>
              <div className="w-px h-4 bg-border-color mx-1"></div>
              <button
                onClick={() => setShowLabelOverlay(prev => !prev)}
                className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                  showLabelOverlay
                    ? 'bg-success/20 text-success hover:bg-success/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-hover-bg'
                }`}
                title={showLabelOverlay ? 'Hide label overlay' : 'Show label overlay'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showLabelOverlay ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  )}
                </svg>
                Label
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div
            ref={imageContainerRef}
            className={`flex-1 overflow-hidden flex items-center justify-center bg-bg-secondary relative ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              touchAction: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          >
            {currentPage && (() => {
              const tempRotation = tempRotations[currentPage.groupedFileId] || 0;
              return (
                <img
                  key={`main-${currentPage.groupedFileId}-${imageCacheBuster}`}
                  src={`${API_URL}/files/${currentPage.groupedFileId}/preview?t=${imageCacheBuster}`}
                  alt={`Page ${selectedPageIndex + 1}`}
                  className="max-w-none select-none shadow-2xl"
                  draggable={false}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `rotate(${tempRotation}deg) scale(${zoom / 100}) translate(${imagePan.x / (zoom / 100)}px, ${imagePan.y / (zoom / 100)}px)`,
                    transformOrigin: 'center center',
                  }}
                />
              );
            })()}

            {/* Bottom-Right Overlay - Label Status */}
            {currentPage && showLabelOverlay && (() => {
              // Calculate document info for multi-page documents
              const docPages = pages.filter(p =>
                p.templateName === currentPage.templateName &&
                p.documentId === currentPage.documentId
              );
              const totalPagesInDoc = docPages.length;
              const currentPageInDoc = currentPage.pageInDocument || 1;
              const isUnmatched = currentPage.labelStatus === 'unmatched';
              const overlayTemplateColor = getTemplateColor(currentPage.templateName);

              // Status config with icons
              const statusConfig: Record<string, { icon: React.JSX.Element; label: string }> = {
                start: {
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  ),
                  label: 'START',
                },
                continue: {
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  ),
                  label: 'CONTINUE',
                },
                end: {
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  ),
                  label: 'END',
                },
                single: {
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  ),
                  label: 'SINGLE',
                },
                unmatched: {
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ),
                  label: 'UNMATCHED',
                },
              };

              const config = statusConfig[currentPage.labelStatus] || statusConfig.unmatched;

              return (
                <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
                  <div
                    className="rounded-2xl shadow-2xl overflow-hidden"
                    style={{
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                      border: `2px solid ${overlayTemplateColor || '#374151'}`,
                    }}
                  >
                    {/* Template Name Header */}
                    <div
                      className="px-4 py-2 flex items-center gap-2"
                      style={{ backgroundColor: overlayTemplateColor || (isUnmatched ? '#dc2626' : '#1f2937') }}
                    >
                      <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white font-semibold text-sm truncate max-w-[200px]">
                        {currentPage.templateName?.replace('.pdf', '') || 'Unmatched'}
                      </span>
                    </div>
                    {/* Status Row */}
                    <div className="bg-gray-800/95 px-4 py-2.5 flex items-center gap-3">
                      <div className="flex items-center gap-2 text-white">
                        {config.icon}
                        <span className="font-bold text-sm tracking-wide">{config.label}</span>
                      </div>
                      <div className="w-px h-4 bg-white/30"></div>
                      <span className="text-white/90 text-xs font-medium">
                        Page {currentPageInDoc} of {totalPagesInDoc}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-card-bg border-t border-border-color">
            {startPage === null ? (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <kbd className="px-1.5 py-0.5 bg-hover-bg rounded">Space</kbd>
                <span>or click page to start selection</span>
              </div>
            ) : endPage === null ? (
              <div className="flex items-center gap-2 text-xs text-success">
                <kbd className="px-1.5 py-0.5 bg-success/20 rounded">Space</kbd>
                <span>on end page to complete</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-accent">
                <kbd className="px-1.5 py-0.5 bg-accent/20 rounded">T</kbd>
                <span>to select template</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Compact Info */}
        <RightPanelContent
          rightPanelTab={rightPanelTab}
          setRightPanelTab={setRightPanelTab}
          currentPage={currentPage}
          selectedPageIndex={selectedPageIndex}
          documentDates={documentDates}
          setDocumentDates={setDocumentDates}
          setHasUnsavedChanges={setHasUnsavedChanges}
          matchedCount={matchedCount}
          pages={pages}
          templateSearch={templateSearch}
          setTemplateSearch={setTemplateSearch}
          filteredTemplates={filteredTemplates}
          startPage={startPage}
          endPage={endPage}
          handleTemplateSelect={handleTemplateSelect}
          setStartPage={setStartPage}
          setEndPage={setEndPage}
          setIsTemplateModalOpen={setIsTemplateModalOpen}
          setSelectedPageIndex={setSelectedPageIndex}
          groupId={groupId}
          ocrSearch={ocrSearch}
          setOcrSearch={setOcrSearch}
          findAllMatches={findAllMatches}
          getLabeledDocuments={getLabeledDocuments}
          getDocumentsWithMissingDates={getDocumentsWithMissingDates}
        />
      </div>

      {/* Template Modal */}
      <TemplateSelectionModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        startPage={startPage}
        endPage={endPage}
        templateSearch={templateSearch}
        setTemplateSearch={setTemplateSearch}
        filteredTemplates={filteredTemplates}
        handleTemplateSelect={handleTemplateSelect}
      />

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed top-16 right-4 bg-card-bg rounded-xl p-4 shadow-2xl border border-border-color z-40 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Shortcuts</h3>
            <button onClick={() => setShowShortcuts(false)} className="text-text-secondary hover:text-text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {[
              ['Space', 'Select start/end'],
              ['Arrow keys', 'Navigate pages'],
              ['T', 'Open templates'],
              ['1-9', 'Quick select'],
              ['C', 'Clear selection'],
              ['Esc', 'Cancel/Close'],
              ['Cmd+S', 'Save changes'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <kbd className="px-1.5 py-0.5 bg-hover-bg rounded text-text-primary">{key}</kbd>
                <span className="text-text-secondary">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Notes Modal */}
      <ReviewNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        reviewNotes={reviewNotes}
        setReviewNotes={setReviewNotes}
        matchedCount={matchedCount}
        totalCount={pages.length}
        onSave={performSave}
      />

      {/* Missing Dates Warning Modal (NEW!) */}
      <MissingDatesModal
        isOpen={showMissingDatesModal}
        onClose={() => setShowMissingDatesModal(false)}
        documentsWithMissingDates={documentsWithMissingDates}
        setDocumentsWithMissingDates={setDocumentsWithMissingDates}
        documentDates={documentDates}
        setDocumentDates={setDocumentDates}
        onSaveAnyway={() => {
          setShowMissingDatesModal(false);
          setDocumentsWithMissingDates([]);
          setShowNotesModal(true);
        }}
      />

      {/* Overlap Warning Modal */}
      <OverlapWarningModal
        isOpen={showOverlapModal}
        overlappedDocuments={overlappedDocuments}
        onCancel={() => {
          setShowOverlapModal(false);
          setOverlappedDocuments([]);
          setPendingAssignment(null);
        }}
        onConfirm={() => {
          setShowOverlapModal(false);
          if (pendingAssignment) {
            const { template, startPage, endPage, documentNumber, date } = pendingAssignment;

            // ✅ Extract document IDs to clear (delete old documents)
            const affectedDocumentIds = overlappedDocuments.map(doc => doc.id);

            // ✅ Assign new template AND clear affected documents
            assignTemplateToPages(template, startPage, endPage, documentNumber, date, affectedDocumentIds);
          }
          setOverlappedDocuments([]);
          setPendingAssignment(null);
        }}
      />

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--hover-bg);
        }

        /* Prevent iOS Safari double-tap zoom and gestures */
        body {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        img {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
}
