'use client';

import { fetchWithAuth } from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import { StageBadge } from '@/components/shared/StageBadge';

interface ApprovedGroup {
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

  // Stage 05 data (split 03/04)
  finalReview03: 'pending' | 'approved' | 'rejected';
  finalReview03Reviewer: string | null;
  finalReview03ReviewedAt: string | null;
  finalReview04: 'pending' | 'approved' | 'rejected';
  finalReview04Reviewer: string | null;
  finalReview04ReviewedAt: string | null;

  // Combined status
  isFinalApproved: boolean;
  finalReviewer: string | null;
  finalApprovedAt: string | null;

  // Foundation name (if available)
  foundationName?: string;
  registrationNumber?: string;
  districtOffice?: string;

  // Portal upload status
  portalOrganizationId?: string | null;
  portalUploadedAt?: string | null;
}

interface UploadResult {
  groupId: number;
  type: 'data' | 'logo' | 'documents' | 'all';
  success: boolean;
  portalOrganizationId?: string;
  error?: string;
}

type UploadType = 'data' | 'logo' | 'documents';

export default function Stage06Upload() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<ApprovedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState<{ groupId: number; type: UploadType } | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const fetchApprovedGroups = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch only approved groups (finalReview03 = approved AND finalReview04 = approved)
      const res = await fetchWithAuth(`/files/final-review-groups?status=approved`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Error fetching approved groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovedGroups();
  }, [fetchApprovedGroups]);

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

  const toggleSelectGroup = (groupId: number) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const selectAllGroups = () => {
    if (selectedGroups.size === groups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groups.map(g => g.groupId)));
    }
  };

  // Upload single group with specific type
  const handleUploadSingle = async (groupId: number, type: UploadType) => {
    setUploading({ groupId, type });

    try {
      const res = await fetchWithAuth(`/files/portal-upload/${groupId}/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      const result: UploadResult = {
        groupId,
        type,
        success: res.ok,
        portalOrganizationId: data.portalOrganizationId,
        error: res.ok ? undefined : data.message || 'Upload failed',
      };

      setUploadResults(prev => [...prev, result]);
      setShowResults(true);

      // Refresh the list
      await fetchApprovedGroups();

    } catch (error) {
      console.error(`Error uploading ${type} for group ${groupId}:`, error);
      setUploadResults(prev => [...prev, {
        groupId,
        type,
        success: false,
        error: 'Failed to connect to server',
      }]);
      setShowResults(true);
    } finally {
      setUploading(null);
    }
  };

  // Batch upload selected groups with specific type
  const handleBatchUpload = async (type: UploadType) => {
    if (selectedGroups.size === 0) return;

    const groupIds = Array.from(selectedGroups);

    for (const groupId of groupIds) {
      await handleUploadSingle(groupId, type);
    }
  };

  // Calculate statistics
  const totalGroups = groups.length;
  const totalPages = groups.reduce((sum, g) => sum + g.totalPages, 0);
  const totalWithFoundation = groups.filter(g => g.hasFoundationInstrument).length;
  const totalCommitteeMembers = groups.reduce((sum, g) => sum + g.committeeCount, 0);
  const alreadyUploaded = groups.filter(g => g.portalOrganizationId).length;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <StageBadge
            stageNumber="06"
            title="Stage 06: Final Upload"
            description="Upload approved data to the destination system"
          />

          {/* Status Cards */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200/50 dark:border-emerald-700/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Ready for Upload</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <BlurFade delay={0.1} inView>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                  <span className="block text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-2">Approved Groups</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalGroups} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-2">ready to upload</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.15} inView>
                <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-5 rounded-xl border border-cyan-500/20">
                  <span className="block text-cyan-600 dark:text-cyan-400 text-sm font-medium mb-2">Already Uploaded</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={alreadyUploaded} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-cyan-600/70 dark:text-cyan-400/70 mt-2">to Portal</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.2} inView>
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 rounded-xl border border-blue-500/20">
                  <span className="block text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">Total Pages</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalPages} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-blue-600/70 dark:text-blue-400/70 mt-2">documents</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.25} inView>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-5 rounded-xl border border-purple-500/20">
                  <span className="block text-purple-600 dark:text-purple-400 text-sm font-medium mb-2">Foundation Data</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalWithFoundation} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-purple-600/70 dark:text-purple-400/70 mt-2">with ตราสาร</span>
                </div>
              </BlurFade>
              <BlurFade delay={0.3} inView>
                <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5 rounded-xl border border-amber-500/20">
                  <span className="block text-amber-600 dark:text-amber-400 text-sm font-medium mb-2">Committee Members</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalCommitteeMembers} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-amber-600/70 dark:text-amber-400/70 mt-2">total members</span>
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
              <p className="mt-4 text-text-secondary">Loading approved groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 border border-amber-200/50 dark:border-amber-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="m-0 mb-2 text-text-primary text-lg font-semibold">No approved groups yet</p>
              <p className="m-0 text-text-secondary text-sm mb-4">
                Groups must be approved in Stage 05 (both Stage 03 and Stage 04) before uploading
              </p>
              <button
                onClick={() => router.push('/stages/05-review')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium text-sm hover:from-blue-700 hover:to-purple-800 transition-all duration-200"
              >
                Go to Stage 05 Review
              </button>
            </div>
          ) : (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="m-0 text-lg font-semibold text-text-primary">
                  Approved Groups ({groups.length} total)
                </h2>
                <div className="flex items-center gap-3">
                  {selectedGroups.size > 0 && (
                    <>
                      <span className="text-sm text-text-secondary">
                        {selectedGroups.size} selected
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBatchUpload('data')}
                          disabled={!!uploading}
                          className="px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Upload Data
                        </button>
                        <button
                          onClick={() => handleBatchUpload('logo')}
                          disabled={!!uploading}
                          className="px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Upload Logo
                        </button>
                        <button
                          onClick={() => handleBatchUpload('documents')}
                          disabled={!!uploading}
                          className="px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Upload Documents
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border-color/30 mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
                      <th className="p-4 text-left">
                        <input
                          type="checkbox"
                          checked={selectedGroups.size === groups.length && groups.length > 0}
                          onChange={selectAllGroups}
                          className="w-4 h-4 rounded border-border-color text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Group #</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Pages</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Foundation</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Committee</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Portal Status</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Approved At</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const isUploadingThis = uploading?.groupId === group.groupId;
                      return (
                        <tr key={group.groupId} className="border-t border-border-color/30 transition-all duration-200 hover:bg-emerald-500/5">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedGroups.has(group.groupId)}
                              onChange={() => toggleSelectGroup(group.groupId)}
                              className="w-4 h-4 rounded border-border-color text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-4 text-text-primary">
                            <div className="flex items-center gap-3 font-semibold">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 border border-emerald-200/50 dark:border-emerald-700/50 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              Group {group.groupId}
                            </div>
                          </td>
                          <td className="p-4 text-text-primary">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {group.totalPages} pages
                            </span>
                          </td>
                          <td className="p-4">
                            {group.hasFoundationInstrument ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-xs">
                                ตราสาร
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-500/15 text-gray-600 dark:text-gray-400 text-xs">
                                ไม่มี
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs">
                              {group.committeeCount} คน
                            </span>
                          </td>
                          <td className="p-4">
                            {group.portalOrganizationId ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                  Uploaded
                                </span>
                                <span className="text-xs text-text-secondary">
                                  ID: {group.portalOrganizationId}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                                Not uploaded
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-text-secondary text-sm">
                            {formatDate(group.finalApprovedAt)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Upload Data Button */}
                              <button
                                onClick={() => handleUploadSingle(group.groupId, 'data')}
                                disabled={!!uploading}
                                className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                                  isUploadingThis && uploading?.type === 'data'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                                } border border-blue-500/30 disabled:opacity-50`}
                                title="Upload organization data"
                              >
                                {isUploadingThis && uploading?.type === 'data' ? (
                                  <span className="flex items-center gap-1">
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Data
                                  </span>
                                )}
                              </button>

                              {/* Upload Logo Button */}
                              <button
                                onClick={() => handleUploadSingle(group.groupId, 'logo')}
                                disabled={!!uploading}
                                className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                                  isUploadingThis && uploading?.type === 'logo'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
                                } border border-purple-500/30 disabled:opacity-50`}
                                title="Upload logo image"
                              >
                                {isUploadingThis && uploading?.type === 'logo' ? (
                                  <span className="flex items-center gap-1">
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Logo
                                  </span>
                                )}
                              </button>

                              {/* Upload Documents Button */}
                              <button
                                onClick={() => handleUploadSingle(group.groupId, 'documents')}
                                disabled={!!uploading}
                                className={`px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                                  isUploadingThis && uploading?.type === 'documents'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                } border border-amber-500/30 disabled:opacity-50`}
                                title="Upload PDF documents"
                              >
                                {isUploadingThis && uploading?.type === 'documents' ? (
                                  <span className="flex items-center gap-1">
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Docs
                                  </span>
                                )}
                              </button>

                              {/* View Button */}
                              <button
                                onClick={() => router.push(`/stages/05-review/${group.groupId}`)}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 font-medium text-xs hover:bg-gray-500/20 transition-all duration-200 border border-gray-500/30"
                                title="View group details"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Upload Results */}
              {showResults && uploadResults.length > 0 && (
                <div className="mb-4 p-4 rounded-xl border border-border-color/30 bg-card-bg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-text-primary">Upload Results</h3>
                    <button
                      onClick={() => { setShowResults(false); setUploadResults([]); }}
                      className="text-text-secondary hover:text-text-primary"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {uploadResults.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          result.success
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-red-500/10 border border-red-500/20'
                        }`}
                      >
                        {result.success ? (
                          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${result.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                            Group {result.groupId}
                          </span>
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20 text-text-secondary">
                            {result.type}
                          </span>
                          {result.success ? (
                            result.portalOrganizationId && (
                              <span className="ml-2 text-sm text-emerald-600/80 dark:text-emerald-400/80">
                                → ID: {result.portalOrganizationId}
                              </span>
                            )
                          ) : (
                            <span className="ml-2 text-sm text-red-600/80 dark:text-red-400/80">
                              {result.error}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Banner */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">Portal Upload Options</p>
                  <ul className="text-blue-600/80 dark:text-blue-400/80 space-y-1 list-disc list-inside">
                    <li><strong>Data</strong> - Upload organization data (name, address, charter, committee)</li>
                    <li><strong>Logo</strong> - Upload foundation logo image</li>
                    <li><strong>Documents</strong> - Upload all PDF documents</li>
                  </ul>
                  <p className="mt-2 text-blue-600/80 dark:text-blue-400/80">
                    Note: Auto-upload triggers when groups are approved in Stage 05.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
