'use client';

import React from 'react';

interface Template {
  name: string;
  category: string;
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  startPage: number | null;
  endPage: number | null;
  templateSearch: string;
  setTemplateSearch: (value: string) => void;
  filteredTemplates: Template[];
  handleTemplateSelect: (template: Template) => void;
}

export function TemplateSelectionModal({
  isOpen,
  onClose,
  startPage,
  endPage,
  templateSearch,
  setTemplateSearch,
  filteredTemplates,
  handleTemplateSelect,
}: TemplateSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-card-bg rounded-xl w-[500px] max-h-[70vh] overflow-hidden shadow-2xl border border-border-color">
        <div className="p-4 border-b border-border-color">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Select Template</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 bg-success/20 text-success rounded">
              {(startPage ?? 0) + 1}
            </span>
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="px-2 py-1 bg-danger/20 text-danger rounded">
              {(endPage ?? 0) + 1}
            </span>
            <span className="text-text-secondary">
              ({(endPage ?? 0) - (startPage ?? 0) + 1} pages)
            </span>
          </div>
        </div>

        <div className="p-3 border-b border-border-color">
          <input
            type="text"
            placeholder="Search templates..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 bg-bg-secondary border border-border-color rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
          />
        </div>

        <div className="max-h-[350px] overflow-y-auto p-2">
          {filteredTemplates.map((template, idx) => (
            <div
              key={template.name}
              onClick={() => handleTemplateSelect(template)}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent/20 transition-colors"
            >
              <span className="w-6 h-6 bg-hover-bg rounded flex items-center justify-center text-xs text-text-secondary">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary">{template.name.replace('.pdf', '')}</div>
                {template.category && (
                  <div className="text-xs text-text-secondary">{template.category}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-border-color bg-bg-secondary">
          <p className="text-xs text-text-secondary text-center">
            Press <kbd className="px-1.5 py-0.5 bg-hover-bg rounded">1-9</kbd> for quick select
          </p>
        </div>
      </div>
    </div>
  );
}
