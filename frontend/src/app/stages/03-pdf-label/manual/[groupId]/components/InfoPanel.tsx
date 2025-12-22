'use client';

import { DocumentDatePicker } from '@/components/DocumentDatePicker';

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

interface InfoPanelProps {
  currentPage: PageLabel;
  selectedPageIndex: number;
  documentDates: Record<string, string | null>;
  setDocumentDates: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setHasUnsavedChanges: (value: boolean) => void;
}

export function InfoPanel({
  currentPage,
  selectedPageIndex,
  documentDates,
  setDocumentDates,
  setHasUnsavedChanges,
}: InfoPanelProps) {
  return (
    <div className="space-y-4">
      {/* Current Page Info */}
      <div>
        <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">Current Page</div>
        <div className="p-3 bg-bg-secondary rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-semibold text-text-primary">Page {selectedPageIndex + 1}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                currentPage.labelStatus === 'unmatched'
                  ? 'bg-danger/20 text-danger'
                  : 'bg-success/20 text-success'
              }`}
            >
              {currentPage.labelStatus}
            </span>
          </div>

          {/* Template Name */}
          {currentPage.templateName && (
            <div>
              <div className="text-sm text-text-primary font-medium">{currentPage.templateName}</div>
              {currentPage.category && (
                <div className="text-xs text-text-secondary mt-1">{currentPage.category}</div>
              )}
            </div>
          )}

          {/* Document Date Picker (INLINE POPOVER) */}
          {currentPage.documentId !== null && currentPage.templateName && (() => {
            const dateKey = `${currentPage.documentId}_${currentPage.templateName}`;

            return (
              <div className="mt-2 pt-2 border-t border-border-color">
                <DocumentDatePicker
                  value={documentDates[dateKey] || ''}
                  onChange={(date) => {
                    if (date !== null) {
                      setDocumentDates((prev) => ({
                        ...prev,
                        [dateKey]: date,
                      }));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  documentNumber={currentPage.documentId!}
                  templateName={currentPage.templateName}
                />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Match Reason */}
      {currentPage.labelStatus !== 'unmatched' && (
        <div>
          <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">Label Reason</div>
          <div className="p-3 bg-bg-secondary rounded-lg select-text" style={{ userSelect: 'text' }}>
            <div className="flex items-center gap-2 mb-2">
              {/* Icon based on reason */}
              {currentPage.matchReason === 'manual' ? (
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
              ) : currentPage.labelStatus === 'continue' ? (
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </div>
              ) : currentPage.labelStatus === 'single' ? (
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary capitalize">
                  {currentPage.matchReason?.replace('_', ' ') || 'Unknown'}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {currentPage.matchReason === 'manual' && 'Manually labeled by user'}
                  {currentPage.labelStatus === 'continue' && 'Continuation of previous document'}
                  {currentPage.labelStatus === 'single' && 'Single page document'}
                  {currentPage.labelStatus === 'start' && 'Start of new document'}
                  {currentPage.labelStatus === 'end' && 'End of document'}
                </div>
              </div>
            </div>

            {currentPage.matchReason && currentPage.matchReason !== 'manual' && (
              <div className="mt-2 pt-2 border-t border-border-color">
                <div className="text-xs text-text-secondary">
                  <pre className="whitespace-pre-wrap font-mono text-[10px] bg-bg-tertiary p-2 rounded">
                    {currentPage.matchReason}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
