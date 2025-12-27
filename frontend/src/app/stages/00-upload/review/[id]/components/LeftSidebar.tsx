import React from 'react';
import { RawFile } from '../types';
import { FileItem } from './FileItem';

interface LeftSidebarProps {
  allFiles: RawFile[];
  currentFile: RawFile | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  visibleFiles: Array<{ file: RawFile; originalIdx: number }>;
  sidebarScrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectFile: (fileId: number) => void;
}

export function LeftSidebar({
  allFiles,
  currentFile,
  sidebarCollapsed,
  setSidebarCollapsed,
  visibleFiles,
  sidebarScrollRef,
  onSelectFile,
}: LeftSidebarProps) {
  const reviewedCount = allFiles.filter(f => f.isReviewed).length;
  const unreviewedCount = allFiles.filter(f => !f.isReviewed).length;
  const progress = allFiles.length > 0 ? (reviewedCount / allFiles.length) * 100 : 0;

  return (
    <div
      className={`bg-card-bg border-r border-border-color transition-all duration-300 flex flex-col ${
        sidebarCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-border-color flex items-center justify-between flex-shrink-0">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="font-semibold text-sm text-text-primary">FILES</span>
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors text-text-secondary"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
      </div>

      {/* File List - Virtualized */}
      <div className="flex-1 overflow-y-auto" ref={sidebarScrollRef}>
        {/* Top spacer (for scroll position) */}
        {visibleFiles.length > 0 && visibleFiles[0].originalIdx > 0 && (
          <div style={{ height: `${visibleFiles[0].originalIdx * 50}px` }} />
        )}

        {/* Render visible range only (±50 items) */}
        {visibleFiles.map(({ file: f, originalIdx }) => (
          <FileItem
            key={f.id}
            file={f}
            idx={originalIdx}
            isActive={f.id === currentFile?.id}
            sidebarCollapsed={sidebarCollapsed}
            onSelect={() => onSelectFile(f.id)}
          />
        ))}

        {/* Bottom spacer (for scroll position) */}
        {visibleFiles.length > 0 && visibleFiles[visibleFiles.length - 1].originalIdx < allFiles.length - 1 && (
          <div style={{ height: `${(allFiles.length - 1 - visibleFiles[visibleFiles.length - 1].originalIdx) * 50}px` }} />
        )}
      </div>

      {/* Sidebar Footer - Stats */}
      {!sidebarCollapsed && (
        <div className="px-3 py-2.5 border-t border-border-color bg-bg-secondary/50">
          <div className="text-[0.65rem] text-text-secondary mb-1">Progress</div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1 bg-border-color/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[0.65rem] font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(progress)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[0.65rem]">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span className="text-text-secondary">{reviewedCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span className="text-text-secondary">{unreviewedCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
