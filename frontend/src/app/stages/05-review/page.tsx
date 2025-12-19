'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import { StageBadge } from '@/components/shared/StageBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface FinalReviewGroup {
  groupId: number;
  totalPages: number;

  // Stage 03 data
  labelMatchPercentage: number;
  isLabeledReviewed: boolean;
  labeledReviewer: string | null;

  // Stage 04 data
  hasFoundationInstrument: boolean;
  committeeCount: number;
  isParseDataReviewed: boolean;
  parseDataReviewer: string | null;
  parseDataAt: string | null;

  // Stage 05 data
  isFinalApproved: boolean;
  finalReviewer: string | null;
  finalApprovedAt: string | null;
}

export default function Stage05Review() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { canAccessStage05 } = usePermission();

  const [groups, setGroups] = useState<FinalReviewGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('pending');

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/files/final-review-groups?status=${statusFilter}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Error fetching final review groups:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate statistics
  const totalGroups = groups.length;
  const pendingGroups = groups.filter(g => !g.isFinalApproved).length;
  const approvedGroups = groups.filter(g => g.isFinalApproved).length;
  const approvalRate = totalGroups > 0 ? ((approvedGroups / totalGroups) * 100).toFixed(1) : '0';

  // Permission check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!canAccessStage05()) {
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
            stageNumber="05"
            title="Stage 05: Final Review & Approval"
            description="Review and approve processed groups before final upload"
          />

          {/* Status Cards */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Current Status</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <BlurFade delay={0.1} inView>
                <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-xl border border-amber-500/20">
                  <span className="block text-amber-400 text-sm font-medium mb-2">Pending Review</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={pendingGroups} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-amber-400/70 mt-2">groups waiting</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.2} inView>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                  <span className="block text-emerald-400 text-sm font-medium mb-2">Approved</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={approvedGroups} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-emerald-400/70 mt-2">groups approved</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.3} inView>
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                  <span className="block text-accent text-sm font-medium mb-2">Total Groups</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalGroups} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-accent/70 mt-2">ready for review</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.4} inView>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-5 rounded-xl border border-purple-500/20">
                  <span className="block text-purple-400 text-sm font-medium mb-2">Approval Rate</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={approvalRate} className="text-text-primary" decimalPlaces={1} />%
                  </span>
                  <span className="block text-xs text-purple-400/70 mt-2">completed</span>
                </div>
              </BlurFade>
            </div>
          </div>

          {/* Groups Table */}
          {loading ? (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin"></div>
              </div>
              <p className="mt-4 text-text-secondary">Loading groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="m-0 mb-2 text-text-primary text-lg font-semibold">No groups ready for final review</p>
              <p className="m-0 text-text-secondary text-sm">
                Groups must be reviewed in both Stage 03 and Stage 04 first
              </p>
            </div>
          ) : (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="m-0 text-lg font-semibold text-text-primary">
                  Groups ({groups.length} total)
                </h2>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary font-medium">
                    Status:
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'approved' | 'all')}
                      className="px-3 py-2 border border-border-color/50 bg-card-bg text-text-primary rounded-lg text-sm cursor-pointer transition-all duration-200 hover:border-accent focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(var(--accent-rgb),0.1)] [&>option]:bg-card-bg [&>option]:text-text-primary"
                    >
                      <option value="pending">Pending Only</option>
                      <option value="approved">Approved Only</option>
                      <option value="all">All Groups</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border-color/30 mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-accent/10 via-purple-500/5 to-transparent">
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Group #</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Stage 03</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Stage 04</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Final Status</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Reviewer</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Date</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
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
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              group.labelMatchPercentage === 100
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}>
                              {group.labelMatchPercentage.toFixed(0)}% match
                            </span>
                            <span className="text-xs text-text-secondary">
                              👤 {group.labeledReviewer || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {group.hasFoundationInstrument && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-xs">
                                  📄 ตราสาร
                                </span>
                              )}
                              {group.committeeCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 text-xs">
                                  👥 {group.committeeCount}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-secondary">
                              👤 {group.parseDataReviewer || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {group.isFinalApproved ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 font-semibold text-xs border border-emerald-500/20">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                              Approved
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
                          {group.finalReviewer ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <span className="font-medium text-sm">{group.finalReviewer}</span>
                            </div>
                          ) : (
                            <span className="text-text-secondary italic text-xs">Not reviewed</span>
                          )}
                        </td>
                        <td className="p-4 text-text-secondary text-sm">
                          {formatDate(group.finalApprovedAt)}
                        </td>
                        <td className="p-4 text-text-primary">
                          <button
                            onClick={() => router.push(`/stages/05-review/${group.groupId}`)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium text-sm hover:from-blue-700 hover:to-purple-800 hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                          >
                            {group.isFinalApproved ? 'View' : 'Review'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
