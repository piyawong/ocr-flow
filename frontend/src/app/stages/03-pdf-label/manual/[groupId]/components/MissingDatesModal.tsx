'use client';

import React, { useState } from 'react';

interface DocumentWithMissingDate {
  documentId: number;
  templateName: string;
  pageRange: {
    start: number;
    end: number;
  };
  pageCount: number;
}

interface MissingDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentsWithMissingDates: DocumentWithMissingDate[];
  setDocumentsWithMissingDates: React.Dispatch<React.SetStateAction<DocumentWithMissingDate[]>>;
  documentDates: Record<string, string | null>;
  setDocumentDates: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  onSaveAnyway: () => void;
}

export function MissingDatesModal({
  isOpen,
  onClose,
  documentsWithMissingDates,
  setDocumentsWithMissingDates,
  documentDates,
  setDocumentDates,
  onSaveAnyway,
}: MissingDatesModalProps) {
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState('');

  if (!isOpen || documentsWithMissingDates.length === 0) return null;

  const handleSetDate = (documentId: number, date: string) => {
    const doc = documentsWithMissingDates.find(d => d.documentId === documentId);
    if (doc) {
      const key = `${documentId}_${doc.templateName}`;
      setDocumentDates(prev => ({
        ...prev,
        [key]: date,
      }));
      // Remove from missing dates list
      setDocumentsWithMissingDates(prev => prev.filter(d => d.documentId !== documentId));
    }
    setEditingDocId(null);
    setTempDate('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000]">
      <div className="bg-card-bg rounded-2xl max-w-[520px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-color bg-warning/5 relative">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-semibold text-text-primary">
              Missing Document Dates
            </h2>
          </div>
          <button
            onClick={() => {
              onClose();
              setDocumentsWithMissingDates([]);
            }}
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
            The following documents are missing dates:
          </p>

          {/* Document List */}
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {documentsWithMissingDates.map((doc) => (
              <div
                key={doc.documentId}
                className="flex items-center p-3 bg-bg-secondary border border-border-color rounded-xl hover:border-warning hover:bg-warning/5 transition-all"
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="flex-1 ml-3 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {doc.templateName.replace('.pdf', '')}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Pages {doc.pageRange.start + 1}-{doc.pageRange.end + 1} ({doc.pageCount} pages)
                  </div>
                </div>

                {/* Action */}
                {editingDocId === doc.documentId ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={tempDate}
                      onChange={(e) => setTempDate(e.target.value)}
                      autoFocus
                      className="w-[130px] px-2 py-1.5 text-xs bg-bg-primary border border-accent rounded text-text-primary"
                    />
                    <button
                      onClick={() => {
                        if (tempDate) handleSetDate(doc.documentId, tempDate);
                      }}
                      className="px-2 py-1.5 text-xs font-medium text-white bg-success rounded hover:bg-success/90 transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingDocId(null);
                        setTempDate('');
                      }}
                      className="px-2 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingDocId(doc.documentId);
                      setTempDate('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-warning bg-warning/10 border border-warning/30 rounded-lg hover:bg-warning/20 hover:border-warning transition-all"
                  >
                    Set Date
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-bg-tertiary rounded-lg border-l-[3px] border-l-info flex items-start gap-2.5">
            <svg className="w-4 h-4 text-info flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              You can set dates now or save without them. Documents without dates may need manual correction later.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border-color bg-bg-secondary flex gap-3">
          <button
            onClick={() => {
              onClose();
              setDocumentsWithMissingDates([]);
            }}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-text-primary bg-transparent border-2 border-border-color rounded-lg hover:bg-bg-tertiary hover:border-text-secondary transition-all duration-200"
          >
            Go Back
          </button>
          <button
            onClick={onSaveAnyway}
            className="flex-1 py-3 px-5 text-[15px] font-semibold text-white bg-gradient-to-br from-warning to-[#d97706] rounded-lg shadow-[0_2px_8px_rgba(245,158,11,0.25)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(245,158,11,0.4)] transition-all duration-200"
          >
            Save Without Dates
          </button>
        </div>
      </div>
    </div>
  );
}
