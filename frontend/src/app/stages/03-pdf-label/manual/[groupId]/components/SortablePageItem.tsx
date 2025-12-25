'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

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

interface SortablePageItemProps {
  page: PageLabel;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  sidebarCollapsed: boolean;
  imageCacheBuster: number;
  tempRotations: Record<number, number>;
  documentDates: Record<string, string | null>;
  onSelect: () => void;
}

export const SortablePageItem = React.memo(function SortablePageItem({
  page,
  index,
  isSelected,
  isDragging,
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
    isDragging: isSortableDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const rotation = tempRotations[page.groupedFileId] || 0;
  const thumbnailUrl = `${API_URL}/files/${page.groupedFileId}/thumbnail?cb=${imageCacheBuster}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`group relative p-2 rounded-lg transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-accent/20 ring-2 ring-accent'
          : 'hover:bg-hover-bg'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Page Number Badge */}
      <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
        {index + 1}
      </div>

      {/* Status Badge */}
      {page.labelStatus && page.labelStatus !== 'unmatched' && (
        <div className={`absolute top-1 right-1 z-10 px-1.5 py-0.5 text-[9px] font-bold rounded ${
          page.labelStatus === 'start' ? 'bg-green-500 text-white' :
          page.labelStatus === 'continue' ? 'bg-blue-500 text-white' :
          page.labelStatus === 'end' ? 'bg-orange-500 text-white' :
          page.labelStatus === 'single' ? 'bg-purple-500 text-white' :
          'bg-gray-500 text-white'
        }`}>
          {page.labelStatus === 'start' && 'START'}
          {page.labelStatus === 'continue' && 'CONT'}
          {page.labelStatus === 'end' && 'END'}
          {page.labelStatus === 'single' && 'SINGLE'}
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-full aspect-[1/1.414] bg-bg-tertiary rounded overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={`Page ${index + 1}`}
          className="w-full h-full object-contain"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease',
          }}
          loading="lazy"
        />
      </div>

      {/* Template Label (Collapsed Sidebar) */}
      {sidebarCollapsed && page.templateName && (
        <div className="mt-1 px-1 py-0.5 bg-accent/10 rounded text-[8px] text-accent text-center truncate font-medium">
          {page.templateName.replace('.pdf', '') || 'Unmatched'}
        </div>
      )}

      {/* Template Label + Document Date (Expanded Sidebar) */}
      {!sidebarCollapsed && (
        <div className="mt-1.5 space-y-1">
          {/* Template name */}
          {page.templateName ? (
            <div className="px-1.5 py-1 bg-success/10 rounded text-[9px] text-success text-center truncate font-medium">
              {page.templateName.replace('.pdf', '')}
            </div>
          ) : (
            <div className="px-1.5 py-1 bg-danger/10 rounded text-[9px] text-danger text-center font-medium">
              Unmatched
            </div>
          )}

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
  // Custom comparison for React.memo
  if (
    prevProps.page.id !== nextProps.page.id ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isDragging !== nextProps.isDragging ||
    prevProps.sidebarCollapsed !== nextProps.sidebarCollapsed ||
    prevProps.imageCacheBuster !== nextProps.imageCacheBuster ||
    prevProps.page.templateName !== nextProps.page.templateName
  ) {
    return false;
  }

  // Check rotation
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
    prevRotation === nextRotation &&
    prevDate === nextDate
  );
});
