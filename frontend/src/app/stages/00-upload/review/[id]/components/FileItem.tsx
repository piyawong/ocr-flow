import React from 'react';
import { RawFile } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface FileItemProps {
  file: RawFile;
  idx: number;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onSelect: () => void;
}

export const FileItem = React.memo(function FileItem({
  file,
  idx,
  isActive,
  sidebarCollapsed,
  onSelect,
}: FileItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-all border-l-4
        ${isActive
          ? 'bg-green-700 border-accent'
          : file.isReviewed
            ? 'border-emerald-500/50 hover:bg-emerald-500/5'
            : 'border-transparent hover:bg-accent/5'}
      `}
    >
      {/* Thumbnail */}
      {!sidebarCollapsed && (
        <div className="relative flex-shrink-0">
          <img
            src={`${API_URL}/files/${file.id}/preview`}
            alt={file.originalName}
            className="w-10 h-10 object-cover rounded border border-border-color/50"
            loading="lazy"
          />
          {file.isReviewed && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      )}

      {!sidebarCollapsed && (
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-text-primary truncate">#{file.fileNumber}</div>
          <div className="text-[0.65rem] text-text-secondary truncate leading-tight">{file.originalName}</div>
        </div>
      )}

      {sidebarCollapsed && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          isActive ? 'bg-accent text-white' : file.isReviewed ? 'bg-emerald-500 text-white' : 'bg-border-color text-text-secondary'
        }`}>
          {idx + 1}
        </div>
      )}
    </div>
  );
});
