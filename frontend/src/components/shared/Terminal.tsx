'use client';

import { forwardRef, useEffect, useRef, useState, useCallback, HTMLAttributes } from 'react';

export interface LogMessage {
  timestamp: string;
  thread: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface TerminalProps extends HTMLAttributes<HTMLDivElement> {
  logs: LogMessage[];
  title?: string;
  isRunning?: boolean;
  lastActivityTime?: Date | null;
  compact?: boolean;
  onCompactChange?: (compact: boolean) => void;
  onClear?: () => void;
  autoScroll?: boolean;
  maxHeight?: string;
  showControls?: boolean;
  showTimestamp?: boolean;
  showThread?: boolean;
}

const Terminal = forwardRef<HTMLDivElement, TerminalProps>(
  (
    {
      logs,
      title = 'Terminal',
      isRunning = false,
      lastActivityTime = null,
      compact: controlledCompact,
      onCompactChange,
      onClear,
      autoScroll = true,
      maxHeight = '300px',
      showControls = true,
      showTimestamp = true,
      showThread = true,
      className = '',
      ...props
    },
    ref
  ) => {
    const [internalCompact, setInternalCompact] = useState(true);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);

    // Use controlled or internal compact state
    const isCompact = controlledCompact !== undefined ? controlledCompact : internalCompact;
    const setCompact = onCompactChange || setInternalCompact;

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
      if (isAutoScrollEnabled && bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    }, [logs, isAutoScrollEnabled]);

    // Handle scroll - disable auto-scroll if user scrolls up
    const handleScroll = useCallback(() => {
      if (!bodyRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAutoScrollEnabled(isAtBottom);
    }, []);

    const getLogTypeStyles = (type: LogMessage['type']) => {
      switch (type) {
        case 'success':
          return 'text-success';
        case 'error':
          return 'text-danger';
        case 'warning':
          return 'text-warning';
        default:
          return 'text-text-secondary';
      }
    };

    const formatTimestamp = (timestamp: string) => {
      try {
        return new Date(timestamp).toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return timestamp;
      }
    };

    const formatLastActivity = () => {
      if (!lastActivityTime) return null;
      const seconds = Math.floor((Date.now() - lastActivityTime.getTime()) / 1000);
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    };

    return (
      <div
        ref={ref}
        className={`
          bg-[#1a1a2e] rounded-xl overflow-hidden border border-border-color
          ${className}
        `}
        {...props}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#16162a] border-b border-border-color">
          <div className="flex items-center gap-3">
            {/* Traffic lights */}
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <span className="text-sm font-medium text-gray-400">{title}</span>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-success/20 text-success text-xs rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Running
              </span>
            )}
          </div>

          {showControls && (
            <div className="flex items-center gap-2">
              {lastActivityTime && (
                <span className="text-xs text-gray-500">
                  Last: {formatLastActivity()}
                </span>
              )}
              {onClear && (
                <button
                  onClick={onClear}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title="Clear logs"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setCompact(!isCompact)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                {isCompact ? 'Expand' : 'Collapse'}
              </button>
            </div>
          )}
        </div>

        {/* Terminal Body */}
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          className="overflow-y-auto scrollbar-thin font-mono text-sm"
          style={{ maxHeight: isCompact ? maxHeight : '500px' }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-gray-500">
              No logs yet...
            </div>
          ) : (
            <div className="p-3 space-y-1">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`flex gap-2 leading-relaxed ${getLogTypeStyles(log.type)}`}
                >
                  {showTimestamp && (
                    <span className="text-gray-600 flex-shrink-0">
                      [{formatTimestamp(log.timestamp)}]
                    </span>
                  )}
                  {showThread && log.thread > 0 && (
                    <span className="text-gray-500 flex-shrink-0">
                      [T{log.thread}]
                    </span>
                  )}
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-scroll indicator */}
        {!isAutoScrollEnabled && logs.length > 0 && (
          <div className="px-3 py-1.5 bg-[#16162a] border-t border-border-color">
            <button
              onClick={() => {
                setIsAutoScrollEnabled(true);
                if (bodyRef.current) {
                  bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
                }
              }}
              className="text-xs text-accent hover:underline"
            >
              ↓ Scroll to bottom
            </button>
          </div>
        )}
      </div>
    );
  }
);

Terminal.displayName = 'Terminal';

export { Terminal };
