'use client';

import React from 'react';

interface OverlappedDocument {
  id: number;
  documentNumber: number;
  templateName: string;
  category: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  overlapType: 'full' | 'partial';
  overlapPages: { start: number; end: number };
}

interface Template {
  name: string;
  category: string;
}

interface OverlapWarningModalProps {
  isOpen: boolean;
  overlappedDocuments: OverlappedDocument[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function OverlapWarningModal({
  isOpen,
  overlappedDocuments,
  onCancel,
  onConfirm,
}: OverlapWarningModalProps) {
  if (!isOpen || overlappedDocuments.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1001]">
      <div className="bg-card-bg rounded-2xl max-w-[600px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-color bg-danger/5 relative">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-danger flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-semibold text-text-primary">
              Document Overlap Detected
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-text-secondary mb-4">
            The label you're creating overlaps with existing documents. If you continue, the following documents will be <strong className="text-danger">removed</strong>:
          </p>

          {/* Document List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {overlappedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-danger/5 border border-danger/30 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-danger/15 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary mb-1">
                      {doc.templateName}
                    </div>
                    <div className="text-sm text-text-secondary space-y-1">
                      <div>Pages {doc.startPage}-{doc.endPage} ({doc.pageCount} pages)</div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.overlapType === 'full'
                            ? 'bg-danger/20 text-danger'
                            : 'bg-warning/20 text-warning'
                        }`}>
                          {doc.overlapType === 'full' ? 'Full Overlap' : 'Partial Overlap'}
                        </span>
                        <span className="text-xs">
                          Overlaps: pages {doc.overlapPages.start}-{doc.overlapPages.end}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning Box */}
          <div className="mt-4 p-4 bg-danger/10 rounded-lg border-l-[3px] border-l-danger">
            <div className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-danger mb-1">Warning</p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  The existing documents will be removed when you save. You can cancel now to keep the existing labels, or continue to replace them with the new label.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border-color bg-bg-secondary flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-text-primary bg-transparent border-2 border-border-color rounded-lg hover:bg-bg-tertiary hover:border-text-secondary transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-white bg-gradient-to-br from-danger to-[#dc2626] rounded-lg shadow-[0_2px_8px_rgba(239,68,68,0.25)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(239,68,68,0.4)] transition-all duration-200"
          >
            Continue & Replace
          </button>
        </div>
      </div>
    </div>
  );
}
