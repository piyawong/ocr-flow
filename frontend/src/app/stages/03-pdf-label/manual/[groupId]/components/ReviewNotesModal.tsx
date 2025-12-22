'use client';

import React from 'react';

interface ReviewNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewNotes: string;
  setReviewNotes: (value: string) => void;
  matchedCount: number;
  totalCount: number;
  onSave: (notes: string) => void;
}

export function ReviewNotesModal({
  isOpen,
  onClose,
  reviewNotes,
  setReviewNotes,
  matchedCount,
  totalCount,
  onSave,
}: ReviewNotesModalProps) {
  if (!isOpen) return null;

  const is100Matched = matchedCount === totalCount;

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm"
      onClick={() => {
        onClose();
        setReviewNotes('');
      }}
    >
      <div
        className="bg-card-bg p-8 rounded-2xl max-w-[500px] w-[90%] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 mb-4 text-xl text-text-primary">Add Review Notes</h2>
        <p className="my-2 text-text-secondary text-[0.9rem]">
          {is100Matched ? (
            <>This group is <strong className="text-[#27ca40]">100% matched</strong> and will be marked as reviewed. You can add optional notes about this review.</>
          ) : (
            <>This group is <strong className="text-[#ffbd2e]">{((matchedCount/totalCount)*100).toFixed(1)}% matched</strong>. Add notes about your progress. It will <strong>not</strong> be marked as reviewed until 100% matched.</>
          )}
        </p>

        <div className="mt-4">
          <label className="block mb-2 text-[0.9rem] font-medium text-text-primary">
            Notes <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
                setReviewNotes('');
              } else if (e.key === 'Enter' && !e.shiftKey) {
                // Enter without Shift = Submit form
                e.preventDefault();
                onSave(reviewNotes);
              }
              // Shift+Enter = Allow new line (default behavior)
            }}
            placeholder="Enter any notes or comments about this review..."
            rows={4}
            className="w-full px-4 py-2.5 border border-border-color bg-bg-secondary text-text-primary rounded-md text-[0.95rem] transition-all duration-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.1)] resize-vertical"
            autoFocus
          />
        </div>

        <div className="flex gap-4 mt-6">
          <button
            className="flex-1 bg-transparent text-text-primary border-2 border-border-color px-6 py-3 rounded-lg text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-bg-tertiary hover:border-text-secondary"
            onClick={() => {
              onClose();
              setReviewNotes('');
            }}
          >
            Cancel
          </button>
          <button
            className="flex-1 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-none px-6 py-3 rounded-lg text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(59,130,246,0.25)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(59,130,246,0.4)]"
            onClick={() => onSave(reviewNotes)}
          >
            {is100Matched ? 'Save & Mark as Reviewed' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
