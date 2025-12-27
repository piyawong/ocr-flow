'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/Button';
import { NumberTicker } from '@/components/ui/number-ticker';
import { fetchWithAuth } from '@/lib/api';
import { BlurFade } from '@/components/ui/blur-fade';
import { StageBadge } from '@/components/shared/StageBadge';
import { Tooltip } from '@/components/ui/Tooltip';

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
  lockedBy: number | null;
  lockedByName: string | null;
  lockedAt: string | null;
  finalReview03: 'pending' | 'approved' | 'rejected';
  finalReview03Reviewer: string | null;
  finalReview03ReviewedAt: string | null;
  finalReview03Notes: string | null;
  labeledNotes: string | null;
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

interface Stage03Stats {
  totalGroups: number;
  pendingReview: number;
  reviewed: number;
  finalApproved: number;
  finalRejected: number;
  finalPending: number;
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
  const [matchFilter, setMatchFilter] = useState<'all' | '100' | 'not100'>('all');
  const [reviewFilter, setReviewFilter] = useState<'unreviewed' | 'all'>('all'); // Default to 'all' for admin
  const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null);
  const documentRefs = useRef<Map<number | null, HTMLDivElement>>(new Map());
  const [stats, setStats] = useState<Stage03Stats>({
    totalGroups: 0,
    pendingReview: 0,
    reviewed: 0,
    finalApproved: 0,
    finalRejected: 0,
    finalPending: 0,
  });

  const fetchGroups = useCallback(async () => {
    try {
      // Fetch summary with isParseData flag
      // Non-admin users ALWAYS see only unreviewed groups
      const includeReviewed = user?.role === 'admin' && reviewFilter === 'all';
      const res = await fetchWithAuth(`/labeled-files/summary?includeReviewed=${includeReviewed}`);
      const responseData = await res.json();

      // ✅ Handle both array and object response formats
      const data: GroupSummary[] = Array.isArray(responseData)
        ? responseData
        : (responseData.groups || []);

      console.log('📊 Fetched groups:', data);

      // Filter: show only groups that are NOT yet parsed (isParseData = false or undefined)
      // For admin with "All Groups" filter, show everything including parsed groups
      const isAdminShowAll = user?.role === 'admin' && reviewFilter === 'all';
      const filteredGroups = isAdminShowAll
        ? data
        : data.filter(g => !g.isParseData);
      setGroups(filteredGroups);
    } catch (err) {
      console.error('Error fetching label summary:', err);
      setGroups([]); // Set to empty array on error
    }
  }, [reviewFilter, user?.role]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/files/stage03-stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stage03 stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchStats();

    // ✅ SSE: Listen to GROUP_LOCKED and GROUP_UNLOCKED events
    const groupEventsSource = new EventSource(`${API_URL}/files/events`);

    groupEventsSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);

        if (eventData.type === 'GROUP_LOCKED' || eventData.type === 'GROUP_UNLOCKED') {
          console.log('🔄 Group lock status changed:', eventData);
          fetchGroups();
        } else if (eventData.type === 'GROUP_REVIEWED') {
          console.log('✅ Group reviewed:', eventData);
          fetchGroups();
          fetchStats(); // Refresh stats when group is reviewed
        } else if (eventData.type === 'GROUP_PARSED') {
          console.log('📊 Group parsed:', eventData);
          fetchGroups();
          fetchStats(); // Refresh stats when group is parsed
        } else if (eventData.type === 'FINAL_REVIEW_03_UPDATED') {
          console.log('🎯 Final Review 03 updated:', eventData);
          fetchGroups();
          fetchStats(); // Refresh stats when Stage 03 final review is updated
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    groupEventsSource.onerror = (err) => {
      console.error('SSE connection error:', err);
    };

    // Cleanup SSE connections on unmount
    return () => {
      groupEventsSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Permission check - redirect if no permission
  useEffect(() => {
    if (!isLoading && user && !canAccessStage03()) {
      router.push('/');
    }
  }, [user, isLoading, canAccessStage03, router]);

  const handleGroupClick = async (group: GroupSummary) => {
    try {
      const [filesRes, summaryRes] = await Promise.all([
        fetchWithAuth(`/labeled-files/group/${group.groupId}`),
        fetchWithAuth(`/labeled-files/group/${group.groupId}/summary`),
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

  // Filter groups based on match filter
  const filteredGroups = (groups || []).filter((group) => {
    if (matchFilter === '100') {
      return group.matchPercentage === 100;
    } else if (matchFilter === 'not100') {
      return group.matchPercentage < 100;
    }
    return true; // 'all'
  });

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

          {/* Status Cards - Admin Only */}
          {user?.role === 'admin' && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="m-0 text-lg font-semibold text-text-primary">Current Status</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <BlurFade delay={0.1} inView>
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 rounded-xl border border-blue-500/20">
                    <span className="block text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">Total Groups</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.totalGroups} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-blue-600/70 dark:text-blue-400/70 mt-2">from Stage 02</span>
                  </div>
                </BlurFade>
                <BlurFade delay={0.15} inView>
                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-xl border border-amber-500/20">
                    <span className="block text-amber-600 dark:text-amber-400 text-sm font-medium mb-2">Pending</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.pendingReview} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-amber-600/70 dark:text-amber-400/70 mt-2">not reviewed</span>
                  </div>
                </BlurFade>
                <BlurFade delay={0.2} inView>
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-5 rounded-xl border border-cyan-500/20">
                    <span className="block text-cyan-600 dark:text-cyan-400 text-sm font-medium mb-2">Reviewed</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.reviewed} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-cyan-600/70 dark:text-cyan-400/70 mt-2">stage 03 done</span>
                  </div>
                </BlurFade>
                <BlurFade delay={0.25} inView>
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                    <span className="block text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">✓ Approved</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.finalApproved} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-2">final approved</span>
                  </div>
                </BlurFade>
                <BlurFade delay={0.3} inView>
                  <div className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 p-5 rounded-xl border border-rose-500/20">
                    <span className="block text-rose-600 dark:text-rose-400 text-sm font-medium mb-2">✗ Rejected</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.finalRejected} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-rose-600/70 dark:text-rose-400/70 mt-2">final rejected</span>
                  </div>
                </BlurFade>
                <BlurFade delay={0.35} inView>
                  <div className="bg-gradient-to-br from-slate-500/10 to-slate-500/5 p-5 rounded-xl border border-slate-500/20">
                    <span className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-2">⏸ Pending</span>
                    <span className="block text-4xl font-bold text-text-primary">
                      <NumberTicker value={stats.finalPending} className="text-text-primary" />
                    </span>
                    <span className="block text-xs text-slate-600/70 dark:text-slate-400/70 mt-2">awaiting final</span>
                  </div>
                </BlurFade>
              </div>
            </div>
          )}

          {/* Groups Table */}
          {(groups || []).length === 0 ? (
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
                <h2 className="m-0 text-lg font-semibold text-text-primary">Labeled Groups ({groups.length} total)</h2>
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
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Group #</th>
                      {user?.role === 'admin' && (
                        <>
                          <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Total Pages</th>
                          <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Match %</th>
                        </>
                      )}
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Reviewed</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Reviewer</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Stage 03 Notes</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Final Review</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Final Review Notes</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <tr key={group.groupId} className="border-t border-border-color/30 transition-all duration-200 hover:bg-accent/5">
                        <td className="p-4 text-text-primary">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 text-white font-bold text-sm flex items-center justify-center shadow-md">
                              {group.groupId}
                            </span>
                          </div>
                        </td>
                        {user?.role === 'admin' && (
                          <>
                            <td className="p-4 text-text-primary text-sm">{group.totalPages}</td>
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
                          </>
                        )}
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
                          {group.labeledNotes ? (
                            <div className="max-w-xs truncate text-sm" title={group.labeledNotes}>
                              {group.labeledNotes}
                            </div>
                          ) : (
                            <span className="text-text-secondary italic text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 text-text-primary">
                          {group.finalReview03 === 'approved' ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 font-semibold text-xs border border-emerald-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                              Approved
                            </div>
                          ) : group.finalReview03 === 'rejected' ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-400 font-semibold text-xs border border-rose-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Rejected
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-500/15 to-slate-500/5 text-slate-400 font-semibold text-xs border border-slate-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-text-primary">
                          {group.finalReview03Notes ? (
                            <div className="max-w-xs truncate text-sm" title={group.finalReview03Notes}>
                              {group.finalReview03Notes}
                            </div>
                          ) : (
                            <span className="text-text-secondary italic text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 text-text-primary">
                          {(() => {
                            const isLockedByOther = group.lockedBy && group.lockedBy !== user?.id;
                            const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
                            const lockAge = group.lockedAt ? Date.now() - new Date(group.lockedAt).getTime() : 0;
                            const isLockExpired = lockAge > LOCK_TIMEOUT_MS;

                            if (isLockedByOther) {
                              if (isLockExpired) {
                                // ✅ Lock expired - User can take over
                                return (
                                  <Tooltip content={`Lock expired - Locked by: ${group.lockedByName || 'Unknown'}${group.lockedAt ? `\nLocked at: ${new Date(group.lockedAt).toLocaleString('th-TH')}` : ''}`}>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/stages/03-pdf-label/manual/${group.groupId}`);
                                      }}
                                      className="bg-amber-500 hover:bg-amber-600"
                                    >
                                      ⚠️ Take Over
                                    </Button>
                                  </Tooltip>
                                );
                              } else {
                                // ✅ Still locked - Disabled
                                return (
                                  <Tooltip content={`Locked by: ${group.lockedByName || 'Unknown'}${group.lockedAt ? `\nLocked at: ${new Date(group.lockedAt).toLocaleString('th-TH')}` : ''}`}>
                                    <Button
                                      size="sm"
                                      disabled
                                      className="opacity-50 cursor-not-allowed"
                                    >
                                      🔒 Locked
                                    </Button>
                                  </Tooltip>
                                );
                              }
                            }

                            // ✅ Not locked or locked by self - Normal button
                            return (
                              <Button
                                size="sm"
                                onClick={() => router.push(`/stages/03-pdf-label/manual/${group.groupId}`)}
                              >
                                Review
                              </Button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredGroups.length === 0 && (groups || []).length > 0 && (
                <div className="bg-bg-secondary/50 rounded-xl p-8 text-center border border-border-color/30">
                  <p className="m-0 mb-2 text-text-primary text-base font-semibold">No groups match the current filter</p>
                  <p className="m-0 text-text-secondary text-sm">Try changing the filter to see more results</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
