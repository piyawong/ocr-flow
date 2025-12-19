'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface ParsedGroup {
  groupId: number;
  fileCount: number;
  parseDataAt: string | null;
  hasFoundationInstrument: boolean;
  committeeCount: number;
  isParseDataReviewed: boolean;
  parseDataReviewer: string | null;
}

export default function Stage04Extract() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { canAccessStage04 } = usePermission();
  const [groups, setGroups] = useState<ParsedGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/files/parsed-groups`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Error fetching parsed groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const totalGroups = groups.length;
  const totalCommitteeMembers = groups.reduce((sum, g) => sum + g.committeeCount, 0);
  const groupsWithFoundation = groups.filter(g => g.hasFoundationInstrument).length;
  const reviewedGroups = groups.filter(g => g.isParseDataReviewed).length;

  // Permission check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!canAccessStage04()) {
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
      {/* Gradient Background */}
      <div className="relative">
        <div className="absolute inset-0 h-80 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
                  ข้อมูลที่สกัดได้
                </h1>
                <p className="text-text-secondary">
                  ดูข้อมูลตราสารและรายชื่อกรรมการที่สกัดจากเอกสาร
                </p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Parsed Groups Card */}
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-5 border border-border-color/50 hover:border-accent/30 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-lg">Total</span>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">{totalGroups}</div>
              <div className="text-sm text-text-secondary">Groups ที่ Parse แล้ว</div>
            </div>

            {/* Foundation Card */}
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-5 border border-border-color/50 hover:border-purple-500/30 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">ตราสาร</span>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">{groupsWithFoundation}</div>
              <div className="text-sm text-text-secondary">Groups มีข้อมูลตราสาร</div>
            </div>

            {/* Committee Card */}
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-5 border border-border-color/50 hover:border-emerald-500/30 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">กรรมการ</span>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">{totalCommitteeMembers}</div>
              <div className="text-sm text-text-secondary">รายชื่อกรรมการทั้งหมด</div>
            </div>

            {/* Reviewed Card */}
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-5 border border-border-color/50 hover:border-amber-500/30 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">Review</span>
              </div>
              <div className="text-3xl font-bold text-text-primary mb-1">
                {reviewedGroups}<span className="text-lg text-text-secondary font-normal">/{totalGroups}</span>
              </div>
              <div className="text-sm text-text-secondary">Groups ที่ Review แล้ว</div>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl border border-border-color/50 overflow-hidden shadow-xl shadow-black/5">
            <div className="px-6 py-5 border-b border-border-color/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-text-primary">รายการ Groups</h2>
              </div>
              <span className="text-sm text-text-secondary">{groups.length} รายการ</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin"></div>
                  <p className="text-text-secondary text-sm">กำลังโหลดข้อมูล...</p>
                </div>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-text-secondary/10 to-text-secondary/5 flex items-center justify-center">
                  <svg className="w-10 h-10 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-text-primary text-lg font-medium mb-2">ยังไม่มีข้อมูลที่สกัดได้</p>
                  <p className="text-text-secondary text-sm max-w-md">
                    Groups จะปรากฏที่นี่โดยอัตโนมัติหลังจากคุณ Save & Review ใน Stage 03
                  </p>
                  <p className="text-text-secondary/70 text-xs mt-2">
                    เงื่อนไข: Labeled + Match 100% + User reviewed
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-secondary/50">
                      <th className="px-6 py-4 text-left font-semibold text-text-secondary">Group</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">หน้า</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">ตราสาร</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">กรรมการ</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">สถานะ Review</th>
                      <th className="px-6 py-4 text-left font-semibold text-text-secondary">ผู้ Review</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">วันที่ Parse</th>
                      <th className="px-6 py-4 text-center font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group, idx) => (
                      <tr
                        key={group.groupId}
                        className={`border-t border-border-color/30 hover:bg-accent/5 cursor-pointer transition-all duration-200 ${idx % 2 === 0 ? '' : 'bg-bg-secondary/20'}`}
                        onClick={() => router.push(`/stages/04-extract/${group.groupId}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 text-white font-bold text-sm flex items-center justify-center shadow-md">
                              {group.groupId}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-text-primary font-medium">{group.fileCount}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {group.hasFoundationInstrument ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              มี
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              ไม่มี
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                            group.committeeCount > 0
                              ? 'bg-purple-500/15 text-purple-400'
                              : 'bg-text-secondary/10 text-text-secondary'
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {group.committeeCount} คน
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {group.isParseDataReviewed ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Reviewed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-sm">
                          {group.parseDataReviewer || (
                            <span className="text-text-secondary/50 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-text-secondary text-sm">
                          {formatDate(group.parseDataAt)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/stages/04-extract/${group.groupId}`);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium text-sm hover:from-blue-700 hover:to-purple-800 hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
