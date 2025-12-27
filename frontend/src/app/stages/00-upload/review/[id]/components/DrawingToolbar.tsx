import React from 'react';

interface DrawingToolbarProps {
  historyIndex: number;
  historyLength: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function DrawingToolbar({
  historyIndex,
  historyLength,
  onUndo,
  onRedo,
  onClear,
}: DrawingToolbarProps) {
  return (
    <div className="absolute bottom-4 left-4 flex gap-2">
      <button
        onClick={onUndo}
        disabled={historyIndex <= 0}
        className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-text-primary"
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={historyIndex >= historyLength - 1}
        className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-text-primary"
        title="Redo (Ctrl+Y)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>
      <button
        onClick={onClear}
        className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-red-500/20 transition-all text-text-primary"
        title="Clear All"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
