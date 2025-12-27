import React from 'react';
import { DrawMode } from '../types';

interface ModeIndicatorProps {
  mode: DrawMode;
  hasUnsavedDrawing: boolean;
  textElementsCount: number;
}

export function ModeIndicator({ mode, hasUnsavedDrawing, textElementsCount }: ModeIndicatorProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent backdrop-blur-sm rounded-lg border border-accent text-white text-sm font-semibold shadow-lg flex items-center gap-2">
      {mode === 'mouse' && (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          Mouse Mode
        </>
      )}
      {mode === 'brush' && (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Brush Mode
        </>
      )}
      {mode === 'eraser' && (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Eraser Mode
        </>
      )}
      {hasUnsavedDrawing && <span className="text-yellow-300">*</span>}
      {textElementsCount > 0 && <span className="text-blue-200">({textElementsCount} text)</span>}
    </div>
  );
}
