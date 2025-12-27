import React from 'react';

interface PositionIndicatorProps {
  currentIndex: number;
  totalFiles: number;
}

export function PositionIndicator({ currentIndex, totalFiles }: PositionIndicatorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-card-bg/90 backdrop-blur-sm rounded-lg border border-border-color/50 text-sm font-medium text-text-primary shadow-lg">
      {currentIndex + 1} / {totalFiles}
    </div>
  );
}
