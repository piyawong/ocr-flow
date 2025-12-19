'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LogMessage } from '@/components/shared/Terminal';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import { StageBadge } from '@/components/shared/StageBadge';

interface LabeledFile {
  id: number;
  groupNumber: number;
  orderInGroup: number;
  groupedFileId: number;
  originalName: string;
  storagePath: string;
  ocrText: string;
  templateName: string | null;
  category: string | null;
  labelStatus: 'start' | 'continue' | 'end' | 'single' | 'unmatched';
  matchReason: string;
  documentId: number | null;
  pageInDocument: number | null;
  createdAt: string;
}

interface GroupSummary {
  groupId: number;
  totalPages: number;
  matchedPages: number;
  matchPercentage: number;
  status: 'matched' | 'has_unmatched' | 'all_unmatched';
  isParseData?: boolean;
  isReviewed: boolean;
  reviewer: string | null;
}

interface GroupDetail {
  groupId: number;
  files: LabeledFile[];
  summary: {
    totalPages: number;
    matchedPages: number;
    unmatchedPages: number;
    matchPercentage: number;
    documents: {
      templateName: string;
      category: string;
      pageCount: number;
    }[];
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Helper to group files by document
interface DocumentGroup {
  documentId: number | null;
  templateName: string | null;
  category: string | null;
  files: LabeledFile[];
  pageRange: { start: number; end: number };
}

const groupFilesByDocument = (files: LabeledFile[]): DocumentGroup[] => {
  const groups: Map<string, DocumentGroup> = new Map();

  files.forEach(file => {
    const key = file.documentId !== null ? `doc-${file.documentId}` : `unmatched-${file.id}`;

    if (!groups.has(key)) {
      groups.set(key, {
        documentId: file.documentId,
        templateName: file.templateName,
        category: file.category,
        files: [],
        pageRange: { start: file.orderInGroup, end: file.orderInGroup }
      });
    }

    const group = groups.get(key)!;
    group.files.push(file);
    group.pageRange.start = Math.min(group.pageRange.start, file.orderInGroup);
    group.pageRange.end = Math.max(group.pageRange.end, file.orderInGroup);
  });

  // Sort by first page order
  return Array.from(groups.values()).sort((a, b) => a.pageRange.start - b.pageRange.start);
};

export default function Stage03PdfLabel() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { canAccessStage03 } = usePermission();

  // All hooks must be called before any early returns
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [matchFilter, setMatchFilter] = useState<'all' | '100' | 'not100'>('all');
  const [reviewFilter, setReviewFilter] = useState<'unreviewed' | 'all'>('unreviewed');
  const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null);
  const documentRefs = useRef<Map<number | null, HTMLDivElement>>(new Map());

  // Label task state
  const [taskRunning, setTaskRunning] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [terminalCompact, setTerminalCompact] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const fetchGroups = useCallback(async () => {
    try {
      // Fetch summary with isParseData flag
      const includeReviewed = reviewFilter === 'all';
      const res = await fetch(`${API_URL}/labeled-files/summary?includeReviewed=${includeReviewed}`);
      const data: GroupSummary[] = await res.json();

      // Filter: show only groups that are NOT yet parsed (isParseData = false or undefined)
      // For admin with "All Groups" filter, show everything including parsed groups
      const isAdminShowAll = user?.role === 'admin' && reviewFilter === 'all';
      const filteredGroups = isAdminShowAll
        ? data
        : data.filter(g => !g.isParseData);
      setGroups(filteredGroups);
    } catch (err) {
      console.error('Error fetching label summary:', err);
    }
  }, [reviewFilter, user?.role]);

  const fetchLogsHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/label-runner/logs-history`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs history:', err);
    }
  }, []);

  const connectToLogs = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/label-runner/logs`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);

        // Update last activity time
        lastActivityTimeRef.current = Date.now();
        setLastActivityTime(new Date());

        // Check for GROUP_PROCESSED event
        if (log.message.startsWith('GROUP_PROCESSED:')) {
          const parts = log.message.split(':');
          const groupNum = parseInt(parts[1]);
          const matched = parseInt(parts[2]);
          const total = parseInt(parts[3]);
          const percentage = (matched / total) * 100;

          // Add success log to terminal
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            thread: 0,
            message: `✅ Group ${groupNum} labeled: ${matched}/${total} pages matched (${percentage.toFixed(1)}%)`,
            type: 'success'
          }]);

          // Refresh groups after label complete
          setTimeout(() => fetchGroups(), 500);
          return;
        }

        setLogs((prev) => [...prev, log]);
      } catch (e) {
        console.error('Error parsing log:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };
  }, [fetchGroups]);

  const startTask = async () => {
    try {
      await fetch(`${API_URL}/label-runner/start`, { method: 'POST' });
      setTaskRunning(true);
      connectToLogs();
    } catch (err) {
      console.error('Error starting task:', err);
    }
  };

  const stopTask = async () => {
    try {
      await fetch(`${API_URL}/label-runner/stop`, { method: 'POST' });
      setTaskRunning(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping task:', err);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch(`${API_URL}/label-runner/clear-logs`, { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchLogsHistory();

    // Cleanup SSE connection on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Permission check - redirect if no permission
  useEffect(() => {
    if (!isLoading && user && !canAccessStage03()) {
      router.push('/');
    }
  }, [user, isLoading, canAccessStage03, router]);

  const handleGroupClick = async (group: GroupSummary) => {
    try {
      const [filesRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/labeled-files/group/${group.groupId}`),
        fetch(`${API_URL}/labeled-files/group/${group.groupId}/summary`),
      ]);

      const files: LabeledFile[] = await filesRes.json();
      const summary = await summaryRes.json();

      setSelectedGroup({
        groupId: group.groupId,
        files,
        summary,
      });
    } catch (err) {
      console.error('Error fetching group detail:', err);
    }
  };

  const closeModal = () => {
    setSelectedGroup(null);
    setExpandedOcrId(null);
    documentRefs.current.clear();
  };

  const scrollToDocument = (documentId: number | null) => {
    const ref = documentRefs.current.get(documentId);
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getStatusBadge = (status: GroupSummary['status']) => {
    switch (status) {
      case 'matched':
        return <><span className="w-2.5 h-2.5 bg-success rounded-full"></span> All Matched</>;
      case 'has_unmatched':
        return <><span className="w-2.5 h-2.5 bg-warning rounded-full"></span> Partial</>;
      case 'all_unmatched':
        return <><span className="w-2.5 h-2.5 bg-error rounded-full"></span> No Match</>;
    }
  };

  const getLabelStatusText = (status: LabeledFile['labelStatus']) => {
    switch (status) {
      case 'start': return 'START';
      case 'end': return 'END';
      case 'single': return 'SINGLE';
      case 'continue': return 'CONT';
      case 'unmatched': return 'UNMATCH';
    }
  };

  const handleRevertAll = async () => {
    setReverting(true);
    try {
      await fetch(`${API_URL}/labeled-files/clear`, { method: 'POST' });
      await fetch(`${API_URL}/label-runner/clear-logs`, { method: 'POST' });
      setShowRevertConfirm(false);
      fetchGroups();
    } catch (err) {
      console.error('Error reverting:', err);
    } finally {
      setReverting(false);
    }
  };

  // Filter groups based on match filter
  const filteredGroups = groups.filter((group) => {
    if (matchFilter === '100') {
      return group.matchPercentage === 100;
    } else if (matchFilter === 'not100') {
      return group.matchPercentage < 100;
    }
    return true; // 'all'
  });

  const totalGroups = groups.length;
  const totalPages = groups.reduce((sum, g) => sum + g.totalPages, 0);
  const totalMatched = groups.reduce((sum, g) => sum + g.matchedPages, 0);
  const overallMatchPercentage = totalPages > 0 ? (totalMatched / totalPages * 100) : 0;

  // Permission check UI
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!canAccessStage03()) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Access Denied</h1>
          <p className="text-text-secondary">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <StageBadge
            stageNumber="03"
            title="Stage 03: PDF Label Review"
            description="Review and adjust labeled documents before extraction"
          />

          {/* Status Cards */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Current Status</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BlurFade delay={0.1} inView>
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                  <span className="block text-accent text-sm font-medium mb-2">Total Groups</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalGroups} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-accent/70 mt-2">labeled groups</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.2} inView>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                  <span className="block text-emerald-400 text-sm font-medium mb-2">Match Rate</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={overallMatchPercentage} className="text-text-primary" decimalPlaces={1} />%
                  </span>
                  <span className="block text-xs text-emerald-400/70 mt-2">{totalMatched}/{totalPages} pages</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.3} inView>
                <div className={`bg-gradient-to-br p-5 rounded-xl border ${
                  totalGroups > 0
                    ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
                    : 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
                }`}>
                  <span className={`block text-sm font-medium mb-2 ${
                    totalGroups > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>Status</span>
                  <div className="flex items-center gap-2.5 text-xl font-semibold my-2">
                    {totalGroups > 0 ? (
                      <><span className="w-3 h-3 bg-amber-500 rounded-full"></span> <span className="text-text-primary">Ready</span></>
                    ) : (
                      <><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> <span className="text-text-primary">No Groups</span></>
                    )}
                  </div>
                  <span className={`block text-xs mt-2 ${
                    totalGroups > 0 ? 'text-amber-400/70' : 'text-emerald-400/70'
                  }`}>
                    {totalGroups > 0 ? 'Review and adjust labels' : 'No pending groups'}
                  </span>
                </div>
              </BlurFade>
            </div>
          </div>

          {/* Action Buttons - Admin Only */}
          {user?.role === 'admin' && (
            <div className="flex gap-3 mb-6">
              {!taskRunning ? (
                <Button onClick={startTask}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Auto Label All
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={stopTask}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Stop Auto Label
                </Button>
              )}
              {totalGroups > 0 && (
                <Button
                  variant="danger"
                  onClick={() => setShowRevertConfirm(true)}
                  disabled={reverting}
                >
                  Revert All Labels
                </Button>
              )}
            </div>
          )}

          {/* Terminal - Admin Only */}
          {user?.role === 'admin' && (
            <div className="bg-[#1a1b26] rounded-2xl overflow-hidden mb-6 border border-[#2d2f3d]/50 shadow-xl">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-[#16171f] border-b border-[#2d2f3d]">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                  <span className="w-3 h-3 rounded-full bg-[#27ca40]"></span>
                </div>
                <span className="text-[#a0a0b0] text-sm font-mono">task-03-label-pdf.py</span>
                {taskRunning && (
                  <span className="flex items-center gap-2 bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    Running
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 border border-[#5a5a6a] rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 font-mono bg-[#2a2a3a] text-[#c0c0d0] hover:border-accent hover:text-accent hover:bg-accent/10"
                    onClick={() => setTerminalCompact(!terminalCompact)}
                  >
                    {terminalCompact ? '📋 Full Logs' : '📊 Compact'}
                  </button>
                  <button
                    className="px-3 py-1.5 border border-[#5a5a6a] rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 font-mono bg-[#2a2a3a] text-[#c0c0d0] hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                    onClick={clearLogs}
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>
              <div
                ref={terminalBodyRef}
                className={`p-4 px-6 ${terminalCompact ? 'min-h-[100px]' : 'min-h-[100px] max-h-[400px]'} overflow-y-auto font-mono`}
              >
                {terminalCompact ? (
                  <div className="space-y-3">
                    {/* Summary Section */}
                    <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-accent text-sm font-semibold">📊 Summary</span>
                        <span className="text-[#a0a0b0] text-xs">{logs.length} total logs</span>
                      </div>
                      <div className="text-[#a0a0b0] text-xs">
                        {taskRunning ? (
                          <>
                            <div>Status: <span className="text-emerald-400 font-medium">Running</span></div>
                            {lastActivityTime && (
                              <div>Last Activity: {lastActivityTime.toLocaleTimeString()}</div>
                            )}
                          </>
                        ) : (
                          <div>Status: <span className="text-[#6a6a7a] font-medium">Idle</span></div>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <div className="text-accent text-xs font-semibold mb-2">📝 Recent Activity (Last 10 logs)</div>
                      {logs.length === 0 ? (
                        <div className="text-[#6a6a7a] text-sm">No logs yet. Click "Start Auto Label All" to begin.</div>
                      ) : (
                        logs
                          .filter(log => !log.message.toLowerCase().includes('waiting'))
                          .slice(-10)
                          .map((log, i) => (
                            <div key={i} className="mb-1 text-sm">
                              <span className="text-[#6a6a7a]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                              <span className={
                                log.type === 'success' ? 'text-emerald-400' :
                                log.type === 'error' ? 'text-red-400' :
                                log.type === 'warning' ? 'text-amber-400' :
                                'text-[#c0c0d0]'
                              }>
                                {log.message}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {logs.length === 0 ? (
                      <div className="text-[#6a6a7a] text-sm">No logs yet. Click "Start Auto Label All" to begin.</div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="mb-1 text-sm">
                          <span className="text-[#6a6a7a]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          <span className={
                            log.type === 'success' ? 'text-emerald-400' :
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'warning' ? 'text-amber-400' :
                            'text-[#c0c0d0]'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Groups Table */}
          {groups.length === 0 ? (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="m-0 mb-2 text-text-primary text-lg font-semibold">No labeled groups to review</p>
              <p className="m-0 text-text-secondary text-sm">Go to Stage 02 to label groups</p>
            </div>
          ) : (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="m-0 text-lg font-semibold text-text-primary">Labeled Groups ({totalGroups} total)</h2>
                <div className="flex items-center gap-4">
                  {/* Review Status filter - Admin Only */}
                  {user?.role === 'admin' && (
                    <label className="flex items-center gap-2 text-sm text-text-secondary font-medium">
                      Review Status:
                      <select
                        value={reviewFilter}
                        onChange={(e) => {
                          setReviewFilter(e.target.value as 'unreviewed' | 'all');
                        }}
                        className="px-3 py-2 border border-border-color/50 bg-card-bg text-text-primary rounded-lg text-sm cursor-pointer transition-all duration-200 hover:border-accent focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.1)] [&>option]:bg-card-bg [&>option]:text-text-primary"
                      >
                        <option value="unreviewed">Unreviewed Only</option>
                        <option value="all">All Groups</option>
                      </select>
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-text-secondary font-medium">
                    Match %:
                    <select
                      value={matchFilter}
                      onChange={(e) => setMatchFilter(e.target.value as 'all' | '100' | 'not100')}
                      className="px-3 py-2 border border-border-color/50 bg-card-bg text-text-primary rounded-lg text-sm cursor-pointer transition-all duration-200 hover:border-accent focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.1)] [&>option]:bg-card-bg [&>option]:text-text-primary"
                    >
                      <option value="all">All</option>
                      <option value="100">100% Matched</option>
                      <option value="not100">Not 100%</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border-color/30 mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-accent/10 via-purple-500/5 to-transparent">
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Group #</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Total Pages</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Matched</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Unmatched</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Match %</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Status</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Reviewed</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Reviewer</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <tr key={group.groupId} className="border-t border-border-color/30 transition-all duration-200 hover:bg-accent/5">
                        <td className="p-4 text-text-primary">
                          <div className="flex items-center gap-3 font-semibold">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                            Group {group.groupId}
                          </div>
                        </td>
                        <td className="p-4 text-text-primary text-sm">{group.totalPages}</td>
                        <td className="p-4 text-text-primary">
                          <span className="text-emerald-400 font-bold text-sm">
                            {group.matchedPages}
                          </span>
                        </td>
                        <td className="p-4 text-text-primary">
                          <span className="text-red-400 font-bold text-sm">
                            {group.totalPages - group.matchedPages}
                          </span>
                        </td>
                        <td className="p-4 text-text-primary">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border ${
                            group.matchPercentage === 100
                              ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/20'
                              : 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-400 border-amber-500/20'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${group.matchPercentage === 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                            {group.matchPercentage.toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-4 text-text-primary">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            {getStatusBadge(group.status)}
                          </div>
                        </td>
                        <td className="p-4 text-text-primary">
                          {group.isReviewed ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 font-semibold text-xs border border-emerald-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                              Reviewed
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-400 font-semibold text-xs border border-amber-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-text-primary">
                          {group.reviewer ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <span className="font-medium text-sm">{group.reviewer}</span>
                            </div>
                          ) : (
                            <span className="text-text-secondary italic text-xs">Not reviewed</span>
                          )}
                        </td>
                        <td className="p-4 text-text-primary">
                          <Button
                            size="sm"
                            onClick={() => router.push(`/stages/03-pdf-label/manual/${group.groupId}`)}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredGroups.length === 0 && groups.length > 0 && (
                <div className="bg-bg-secondary/50 rounded-xl p-8 text-center border border-border-color/30">
                  <p className="m-0 mb-2 text-text-primary text-base font-semibold">No groups match the current filter</p>
                  <p className="m-0 text-text-secondary text-sm">Try changing the filter to see more results</p>
                </div>
              )}
            </div>
          )}

          {/* Revert Confirmation Dialog */}
          <ConfirmDialog
            isOpen={showRevertConfirm}
            onClose={() => setShowRevertConfirm(false)}
            onConfirm={handleRevertAll}
            title="Revert All Labels?"
            description={`This will delete all labels for ${totalGroups} groups (${totalPages} pages) from Stage 03. This action cannot be undone.`}
            confirmText={reverting ? 'Reverting...' : 'Revert All'}
            variant="danger"
            isLoading={reverting}
          />
        </div>
      </div>
    </div>
  );
}
