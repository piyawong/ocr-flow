import React from 'react';
import { Button } from '@/components/ui/Button';

interface TopBarProps {
  currentIndex: number;
  totalFiles: number;
  reviewedCount: number;
  unreviewedCount: number;
  progress: number;
  onGoBack: () => void;
  onGoToNextUnreviewed: () => void;
}

export function TopBar({
  currentIndex,
  totalFiles,
  reviewedCount,
  unreviewedCount,
  progress,
  onGoBack,
  onGoToNextUnreviewed,
}: TopBarProps) {
  return (
    <div className="sticky top-0 z-[100] bg-card-bg border-b border-border-color px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors text-text-secondary hover:text-text-primary"
          title="Back to list (ESC)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-medium">Back</span>
        </button>
        <div className="h-5 w-px bg-border-color"></div>
        <div className="text-sm">
          <span className="text-text-secondary">Image Review</span>
          <span className="mx-2 text-text-secondary/50">•</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">{currentIndex + 1}/{totalFiles}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Statistics Badges */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{reviewedCount}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Reviewed</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{unreviewedCount}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400">Unreviewed</span>
          </div>

          <div className="h-6 w-px bg-border-color"></div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-border-color/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(progress)}%</span>
          </div>
        </div>

        <button
          onClick={onGoToNextUnreviewed}
          disabled={unreviewedCount === 0}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
          title="Next Unreviewed (N)"
        >
          <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          Next Unreviewed
        </button>
      </div>
    </div>
  );
}
