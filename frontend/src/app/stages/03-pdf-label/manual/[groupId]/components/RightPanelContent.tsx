'use client';

import React from 'react';
import { DocumentDatePicker } from '@/components/DocumentDatePicker';
import { fetchWithAuth } from '@/lib/api';

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

interface Template {
  name: string;
  category: string;
}

interface LabeledDocument {
  documentId: number;
  templateName: string;
  pageRange: { start: number; end: number };
  pageCount: number;
  hasDate: boolean;
  date: string | null;
}

interface RightPanelContentProps {
  rightPanelTab: 'info' | 'templates' | 'ocr' | 'documents';
  setRightPanelTab: (tab: 'info' | 'templates' | 'ocr' | 'documents') => void;
  currentPage: PageLabel | undefined;
  selectedPageIndex: number;
  documentDates: Record<string, string | null>;
  setDocumentDates: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  setHasUnsavedChanges: (value: boolean) => void;
  matchedCount: number;
  pages: PageLabel[];
  templateSearch: string;
  setTemplateSearch: (value: string) => void;
  filteredTemplates: Template[];
  startPage: number | null;
  endPage: number | null;
  handleTemplateSelect: (template: Template) => void;
  setStartPage: (value: number) => void;
  setEndPage: (value: number) => void;
  setIsTemplateModalOpen: (value: boolean) => void;
  setSelectedPageIndex: (value: number) => void;
  groupId: number;
  ocrSearch: string;
  setOcrSearch: (value: string) => void;
  findAllMatches: (text: string, pattern: string) => Array<{ start: number; end: number; score: number; matchedText: string }>;
  getLabeledDocuments: () => LabeledDocument[];
  getDocumentsWithMissingDates: () => Array<{ documentId: number; templateName: string; pageRange: { start: number; end: number }; pageCount: number }>;
}

export function RightPanelContent({
  rightPanelTab,
  setRightPanelTab,
  currentPage,
  selectedPageIndex,
  documentDates,
  setDocumentDates,
  setHasUnsavedChanges,
  matchedCount,
  pages,
  templateSearch,
  setTemplateSearch,
  filteredTemplates,
  startPage,
  endPage,
  handleTemplateSelect,
  setStartPage,
  setEndPage,
  setIsTemplateModalOpen,
  setSelectedPageIndex,
  groupId,
  ocrSearch,
  setOcrSearch,
  findAllMatches,
  getLabeledDocuments,
  getDocumentsWithMissingDates,
}: RightPanelContentProps) {
  const missingDocsCount = getDocumentsWithMissingDates().length;

  return (
    <div className="w-64 bg-card-bg border-l border-border-color flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border-color">
        {[
          { id: 'info', label: 'Info' },
          { id: 'templates', label: 'Templates' },
          { id: 'ocr', label: 'OCR' },
          { id: 'documents', label: 'Documents' },
        ].map(tab => {
          const hasWarning = tab.id === 'documents' && missingDocsCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id as typeof rightPanelTab)}
              className={`relative flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                rightPanelTab === tab.id
                  ? 'text-text-primary border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {/* Warning Dot */}
              {hasWarning && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-warning rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {rightPanelTab === 'info' && currentPage && (
          <div className="space-y-4">
            {/* Current Page Info */}
            <div>
              <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">Current Page</div>
              <div className="p-3 bg-bg-secondary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-text-primary">Page {selectedPageIndex + 1}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    currentPage.labelStatus === 'unmatched'
                      ? 'bg-danger/20 text-danger'
                      : 'bg-success/20 text-success'
                  }`}>
                    {currentPage.labelStatus}
                  </span>
                </div>
                {/* Template Name with Inline Date Picker */}
                {currentPage.templateName && (
                  <div className="space-y-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary font-medium">{currentPage.templateName}</div>
                      {currentPage.category && (
                        <div className="text-xs text-text-secondary mt-1">{currentPage.category}</div>
                      )}
                    </div>
                    {/* Inline Document Date Picker */}
                    {currentPage.documentId !== null && (() => {
                      const dateKey = `${currentPage.documentId}_${currentPage.templateName}`;
                      return (
                        <div className="pt-2 border-t border-border-color">
                          <DocumentDatePicker
                            value={documentDates[dateKey] || ''}
                            onChange={(newDate) => {
                              setDocumentDates(prev => ({
                                ...prev,
                                [dateKey]: newDate,
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            documentNumber={currentPage.documentId!}
                            templateName={currentPage.templateName!}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-primary">
                        {currentPage.matchReason === 'manual' ? 'Manual Label' :
                         currentPage.labelStatus === 'continue' ? 'Continue from previous' :
                         currentPage.labelStatus === 'single' ? 'Single Page Match' :
                         currentPage.labelStatus === 'start' ? 'First Page Match' :
                         currentPage.labelStatus === 'end' ? 'Last Page Match' :
                         'Pattern Match'}
                      </div>
                    </div>
                  </div>

                  {/* Raw match reason - selectable */}
                  {currentPage.matchReason && (
                    <div className="mb-2 p-2 bg-bg-primary rounded border border-border-color">
                      <div className="text-[10px] text-text-secondary uppercase mb-1">Match Data</div>
                      <code className="text-xs text-accent break-all block leading-relaxed" style={{ userSelect: 'text' }}>
                        {currentPage.matchReason}
                      </code>
                    </div>
                  )}

                  {/* Detailed reason */}
                  <div className="pt-2 border-t border-border-color">
                    <div className="text-xs text-text-secondary space-y-1 leading-relaxed" style={{ userSelect: 'text' }}>
                      {currentPage.matchReason === 'manual' && (
                        <p>Label ด้วยมือโดยผู้ใช้ในหน้า Manual Label</p>
                      )}
                      {currentPage.labelStatus === 'continue' && currentPage.matchReason !== 'manual' && (
                        <p>หน้าต่อเนื่องจากหน้าก่อนหน้า (ไม่ใช่หน้าแรกหรือหน้าสุดท้าย)</p>
                      )}
                      {currentPage.labelStatus === 'single' && currentPage.matchReason !== 'manual' && (
                        <p>เอกสารหน้าเดียว - match ทั้ง first และ last pattern</p>
                      )}
                      {currentPage.labelStatus === 'start' && currentPage.matchReason !== 'manual' && (
                        <p>Match first_page_patterns ของ template</p>
                      )}
                      {currentPage.labelStatus === 'end' && currentPage.matchReason !== 'manual' && (
                        <p>Match last_page_patterns ของ template</p>
                      )}
                      {currentPage.matchReason && currentPage.matchReason.includes('exact') && (
                        <p className="text-success">Exact Match - พบคำตรงทั้งหมด (normalized)</p>
                      )}
                      {currentPage.matchReason && !currentPage.matchReason.includes('exact') && currentPage.matchReason !== 'manual' && (
                        <p className="text-info">Match: {currentPage.matchReason}</p>
                      )}
                      {currentPage.labelStatus === 'continue' && currentPage.matchReason === 'manual' && (
                        <p>หน้าต่อเนื่องที่ถูก label ด้วยมือ</p>
                      )}
                      {currentPage.labelStatus === 'start' && currentPage.matchReason === 'manual' && (
                        <p>หน้าแรกของเอกสารที่ถูก label ด้วยมือ</p>
                      )}
                      {currentPage.labelStatus === 'end' && currentPage.matchReason === 'manual' && (
                        <p>หน้าสุดท้ายของเอกสารที่ถูก label ด้วยมือ</p>
                      )}
                      {currentPage.labelStatus === 'single' && currentPage.matchReason === 'manual' && (
                        <p>เอกสารหน้าเดียวที่ถูก label ด้วยมือ</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div>
              <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">Quick Actions</div>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setStartPage(0);
                    setEndPage(pages.length - 1);
                    setIsTemplateModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 p-2 bg-bg-secondary hover:bg-accent/10 rounded-lg text-sm text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Label All Pages
                </button>
                <button
                  onClick={() => {
                    const unmatchedIdx = pages.findIndex(p => p.labelStatus === 'unmatched');
                    if (unmatchedIdx !== -1) {
                      setSelectedPageIndex(unmatchedIdx);
                      setStartPage(unmatchedIdx);
                    }
                  }}
                  className="w-full flex items-center gap-2 p-2 bg-bg-secondary hover:bg-danger/10 rounded-lg text-sm text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Go to Unmatched
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Re-run auto-label for this group? This will reset all manual changes.')) return;
                    try {
                      const res = await fetchWithAuth(`/label-runner/relabel/${groupId}`, { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        alert(`Re-labeled: ${data.matched}/${data.total} pages matched`);
                        window.location.reload();
                      } else {
                        alert(`Error: ${data.message}`);
                      }
                    } catch (err) {
                      alert('Error re-labeling group');
                    }
                  }}
                  className="w-full flex items-center gap-2 p-2 bg-bg-secondary hover:bg-accent/10 rounded-lg text-sm text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-Auto-Label
                </button>
              </div>
            </div>

            {/* Stats */}
            <div>
              <div className="text-xs text-text-secondary uppercase tracking-wider mb-2">Statistics</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-bg-secondary rounded-lg text-center">
                  <div className="text-lg font-semibold text-success">{matchedCount}</div>
                  <div className="text-[10px] text-text-secondary">Matched</div>
                </div>
                <div className="p-2 bg-bg-secondary rounded-lg text-center">
                  <div className="text-lg font-semibold text-danger">{pages.length - matchedCount}</div>
                  <div className="text-[10px] text-text-secondary">Unmatched</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {rightPanelTab === 'templates' && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-lg text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
            />
            <div className="space-y-1">
              {filteredTemplates.slice(0, 15).map((template, idx) => (
                <div
                  key={template.name}
                  onClick={() => {
                    if (startPage !== null && endPage !== null) {
                      handleTemplateSelect(template);
                    }
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    startPage !== null && endPage !== null
                      ? 'cursor-pointer hover:bg-accent/20'
                      : 'opacity-50'
                  } bg-bg-secondary`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-hover-bg rounded text-xs flex items-center justify-center text-text-secondary">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{template.name.replace('.pdf', '')}</div>
                      {template.category && (
                        <div className="text-[10px] text-text-secondary truncate">{template.category}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rightPanelTab === 'ocr' && currentPage?.ocrText && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="ค้นหาข้อความ (รองรับ fuzzy match)..."
                value={ocrSearch}
                onChange={(e) => setOcrSearch(e.target.value)}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-lg text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
              />

              {/* Search Results Summary */}
              {ocrSearch.length >= 2 && (() => {
                const matches = findAllMatches(currentPage.ocrText, ocrSearch);
                const exactCount = matches.filter(m => m.score === 100).length;
                const fuzzyCount = matches.filter(m => m.score < 100).length;

                return (
                  <div className="flex items-center gap-2 text-xs">
                    {matches.length > 0 ? (
                      <>
                        <span className="px-2 py-1 bg-success/20 text-success rounded-full">
                          พบ {matches.length} รายการ
                        </span>
                        {exactCount > 0 && (
                          <span className="px-2 py-1 bg-accent/20 text-accent rounded-full">
                            Exact: {exactCount}
                          </span>
                        )}
                        {fuzzyCount > 0 && (
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">
                            Fuzzy: {fuzzyCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="px-2 py-1 bg-danger/20 text-danger rounded-full">
                        ไม่พบข้อความ
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* OCR Text with Highlighting */}
            <div className="p-3 bg-bg-secondary rounded-lg">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-[calc(100vh-380px)] overflow-y-auto">
                {ocrSearch.length >= 2 ? (() => {
                  const matches = findAllMatches(currentPage.ocrText, ocrSearch);
                  if (matches.length === 0) return currentPage.ocrText;

                  // Sort matches by start index
                  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

                  // Build highlighted text
                  const parts: React.ReactNode[] = [];
                  let lastIndex = 0;

                  sortedMatches.forEach((match, idx) => {
                    // Add text before match
                    if (match.start > lastIndex) {
                      parts.push(currentPage.ocrText.substring(lastIndex, match.start));
                    }

                    // Add highlighted match
                    const isExact = match.score === 100;
                    parts.push(
                      <span
                        key={idx}
                        className={`relative group cursor-pointer rounded px-0.5 ${
                          isExact
                            ? 'bg-accent/40 text-accent'
                            : 'bg-amber-500/40 text-amber-300'
                        }`}
                        title={`${isExact ? 'Exact Match' : `Fuzzy Match (${match.score}%)`}: "${match.matchedText}"`}
                      >
                        {currentPage.ocrText.substring(match.start, match.end)}
                        <span className={`absolute -top-5 left-0 px-1.5 py-0.5 text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 ${
                          isExact ? 'bg-accent text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {isExact ? '100%' : `${match.score}%`}
                        </span>
                      </span>
                    );

                    lastIndex = match.end;
                  });

                  // Add remaining text
                  if (lastIndex < currentPage.ocrText.length) {
                    parts.push(currentPage.ocrText.substring(lastIndex));
                  }

                  return parts;
                })() : currentPage.ocrText}
              </pre>
            </div>

            {/* Help Text */}
            <div className="text-[10px] text-text-secondary p-2 bg-bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded bg-accent/40"></span>
                <span>Exact Match (100%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500/40"></span>
                <span>Fuzzy Match (≥75%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {rightPanelTab === 'documents' && (() => {
          const allDocs = getLabeledDocuments();
          const missingDatesCount = allDocs.filter(d => !d.hasDate).length;

          return (
            <div className="space-y-3">
              {/* Header */}
              <div>
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Labeled Documents
                </h3>
                <p className="text-[10px] text-text-secondary mt-1">
                  {allDocs.length} document{allDocs.length !== 1 ? 's' : ''}
                  {missingDatesCount > 0 && (
                    <span className="text-warning ml-1">
                      | {missingDatesCount} missing date{missingDatesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>

              {/* Document List */}
              {allDocs.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-xs">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No labeled documents yet</p>
                  <p className="text-[10px] mt-1">Apply templates to label documents</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allDocs.map((doc) => {
                    const dateKey = `${doc.documentId}_${doc.templateName}`;
                    const currentDate = doc.date || '';

                    return (
                      <div
                        key={dateKey}
                        className={`relative bg-bg-secondary border rounded-lg p-3 overflow-hidden ${
                          doc.hasDate
                            ? 'border-border-color'
                            : 'border-warning bg-warning/[0.03]'
                        }`}
                      >
                        {/* Color Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>

                        {/* Content */}
                        <div className="pl-2">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-medium text-text-primary truncate">
                                {doc.templateName.replace('.pdf', '')}
                              </h4>
                              {!doc.hasDate && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-warning bg-warning/15 rounded-full uppercase mt-1">
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  No Date
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Page Info */}
                          <p className="text-[10px] text-text-secondary mb-2">
                            Pages {doc.pageRange.start + 1}-{doc.pageRange.end + 1} ({doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''})
                          </p>

                          {/* Date Input */}
                          <div className="space-y-2">
                            <DocumentDatePicker
                              value={currentDate}
                              onChange={(date) => {
                                setDocumentDates(prev => ({
                                  ...prev,
                                  [dateKey]: date || null,
                                }));
                                setHasUnsavedChanges(true);
                              }}
                              documentNumber={doc.documentId}
                              templateName={doc.templateName}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Missing Summary Banner */}
              {missingDatesCount > 0 && (
                <div className="p-2.5 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-[10px] font-medium text-warning flex-1">
                    {missingDatesCount} document{missingDatesCount !== 1 ? 's' : ''} missing date{missingDatesCount !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
