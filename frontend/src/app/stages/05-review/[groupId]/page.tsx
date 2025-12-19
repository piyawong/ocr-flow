'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface LabeledFile {
  id: number;
  groupedFileId: number;
  orderInGroup: number;
  originalName: string;
  storagePath: string;
  templateName: string | null;
  category: string | null;
  labelStatus: 'start' | 'continue' | 'end' | 'single' | 'unmatched';
  matchReason: string;
  documentId: number | null;
  pageInDocument: number | null;
}

interface GroupDetailResponse {
  groupId: number;
  stage03: {
    totalPages: number;
    matchedPages: number;
    unmatchedPages: number;
    matchPercentage: number;
    documents: Array<{
      templateName: string;
      category: string;
      pageCount: number;
    }>;
    labeledFiles: LabeledFile[];
    isReviewed: boolean;
    reviewer: string | null;
    reviewedAt: string | null;
  };
  stage04: {
    hasFoundationInstrument: boolean;
    foundationData: any | null;
    committeeCount: number;
    committeeMembers: any[];
    isReviewed: boolean;
    reviewer: string | null;
    parseDataAt: string | null;
  };
  stage05: {
    isFinalApproved: boolean;
    finalReviewer: string | null;
    finalApprovedAt: string | null;
    finalReviewNotes: string | null;
  };
  metadata: {
    districtOffice: string | null;
    registrationNumber: string | null;
    logoUrl: string | null;
  };
}

export default function FinalReviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId as string;
  const { user, isLoading: authLoading } = useAuth();
  const { canAccessStage05 } = usePermission();

  const [detail, setDetail] = useState<GroupDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'stage03' | 'stage04'>('stage03');
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    labeledFiles: true,
    foundation: true,
    committee: true,
  });

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/files/final-review-groups/${groupId}`);
        const data = await res.json();
        console.log('📊 Final Review Group Detail:', data);
        console.log('  - Stage 03 files:', data?.stage03?.labeledFiles?.length || 0);
        console.log('  - Stage 04 foundation:', data?.stage04?.hasFoundationInstrument);
        console.log('  - Stage 04 committee:', data?.stage04?.committeeCount || 0);
        setDetail(data);
        setNotes(data?.stage05?.finalReviewNotes || '');
      } catch (err) {
        console.error('Error fetching group detail:', err);
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchDetail();
    }
  }, [groupId]);

  const handleApprove = async () => {
    if (!user) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/files/final-review-groups/${groupId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerName: user.name,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to approve');
      }

      // Refresh data
      const updatedRes = await fetch(`${API_URL}/files/final-review-groups/${groupId}`);
      const updatedData = await updatedRes.json();
      setDetail(updatedData);

      alert('Group approved successfully!');
    } catch (err: any) {
      console.error('Error approving group:', err);
      alert(err.message || 'Failed to approve group');
    } finally {
      setSubmitting(false);
    }
  };

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

  const getLabelStatusText = (status: LabeledFile['labelStatus']) => {
    switch (status) {
      case 'start': return 'START';
      case 'end': return 'END';
      case 'single': return 'SINGLE';
      case 'continue': return 'CONT';
      case 'unmatched': return 'UNMATCH';
    }
  };

  const getLabelStatusColor = (status: LabeledFile['labelStatus']) => {
    switch (status) {
      case 'start': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'continue': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'end': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'single': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'unmatched': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin"></div>
          <p className="text-text-secondary">Loading group details...</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Group Not Found</h1>
          <p className="text-text-secondary mb-4">The requested group does not exist or is not ready for final review.</p>
          <button
            onClick={() => router.push('/stages/05-review')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium text-sm"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  const isApproved = detail?.stage05?.isFinalApproved || false;

  return (
    <div className="min-h-screen bg-bg-primary pb-20">
      {/* Gradient Background */}
      <div className="relative">
        <div className="absolute inset-0 h-80 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.push('/stages/05-review')}
              className="p-2 rounded-xl bg-card-bg border border-border-color/50 text-text-primary hover:bg-accent/10 hover:border-accent transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                Group #{groupId} - Final Review
              </h1>
              <p className="text-text-secondary text-sm">
                Review all labeled pages and extracted data before approval
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isApproved && (
            <div className="mb-6 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-emerald-400 font-semibold text-lg">✓ Approved</div>
                  <div className="text-emerald-400/70 text-sm">
                    By {detail?.stage05?.finalReviewer || 'Unknown'} on {formatDate(detail?.stage05?.finalApprovedAt)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-card-bg/50 p-1.5 rounded-xl border border-border-color/50">
            <button
              onClick={() => setActiveTab('stage03')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'stage03'
                  ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-400 border border-blue-500/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Stage 03: Labeled Pages</span>
                <span className="text-xs opacity-70">({detail?.stage03?.totalPages || 0})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('stage04')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'stage04'
                  ? 'bg-gradient-to-r from-purple-500/20 to-purple-500/10 text-purple-400 border border-purple-500/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Stage 04: Extracted Data</span>
              </div>
            </button>
          </div>

          {/* Stage 03 Content */}
          {activeTab === 'stage03' && (
            <div className="space-y-6">
              {!detail?.stage03 || !detail.stage03.labeledFiles || detail.stage03.labeledFiles.length === 0 ? (
                // Empty State
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-text-primary font-semibold mb-2">No labeled pages available</p>
                  <p className="text-text-secondary text-sm mb-4">
                    This group doesn't have any labeled pages from Stage 03
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => router.push('/stages/03-pdf-label')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium text-sm hover:shadow-lg transition-all"
                    >
                      Go to Stage 03
                    </button>
                  </div>
                </div>
              ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <h3 className="text-lg font-bold text-text-primary mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl bg-accent/10">
                    <div className="text-3xl font-bold text-accent">{detail.stage03?.totalPages || 0}</div>
                    <div className="text-xs text-accent/70 mt-1">Total Pages</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-emerald-500/10">
                    <div className="text-3xl font-bold text-emerald-400">{detail.stage03?.matchedPages || 0}</div>
                    <div className="text-xs text-emerald-400/70 mt-1">Matched</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-rose-500/10">
                    <div className="text-3xl font-bold text-rose-400">{detail.stage03?.unmatchedPages || 0}</div>
                    <div className="text-xs text-rose-400/70 mt-1">Unmatched</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-purple-500/10">
                    <div className="text-3xl font-bold text-purple-400">{detail.stage03?.matchPercentage?.toFixed(1) || 0}%</div>
                    <div className="text-xs text-purple-400/70 mt-1">Match Rate</div>
                  </div>
                </div>
              </div>

              {/* Labeled Files Grid */}
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <div
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => toggleSection('labeledFiles')}
                >
                  <h3 className="text-lg font-bold text-text-primary">Labeled Pages ({detail.stage03?.labeledFiles?.length || 0})</h3>
                  <svg
                    className={`w-5 h-5 text-text-secondary transition-transform ${expandedSections.labeledFiles ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expandedSections.labeledFiles && detail.stage03?.labeledFiles && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {detail.stage03.labeledFiles.map((file) => (
                      <div
                        key={file.id}
                        className="bg-bg-secondary/50 rounded-xl overflow-hidden border border-border-color/30 hover:border-accent/50 transition-all group"
                      >
                        {/* Image Preview */}
                        <div className="relative aspect-[3/4] bg-bg-primary/50">
                          <Image
                            src={`${API_URL}/files/${file.groupedFileId}/preview`}
                            alt={file.originalName}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                          {/* Page Number Badge */}
                          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-bold">
                            #{file.orderInGroup}
                          </div>
                          {/* Status Badge */}
                          <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold border ${getLabelStatusColor(file.labelStatus)}`}>
                            {getLabelStatusText(file.labelStatus)}
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="p-3">
                          <div className="text-xs font-semibold text-text-primary mb-1 truncate">
                            {file.templateName || 'Unmatched'}
                          </div>
                          {file.category && (
                            <div className="text-xs text-text-secondary mb-2">
                              {file.category}
                            </div>
                          )}
                          {file.documentId !== null && (
                            <div className="text-xs text-accent">
                              Doc #{file.documentId} | Page {file.pageInDocument}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
              )}
            </div>
          )}

          {/* Stage 04 Content */}
          {activeTab === 'stage04' && (
            <div className="space-y-6">
              {!detail?.stage04 || (!detail.stage04.hasFoundationInstrument && (!detail.stage04.committeeMembers || detail.stage04.committeeMembers.length === 0)) ? (
                // Empty State
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-text-primary font-semibold mb-2">No extracted data available</p>
                  <p className="text-text-secondary text-sm mb-4">
                    This group doesn't have foundation instrument or committee data
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      onClick={() => router.push('/stages/04-extract')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium text-sm hover:shadow-lg transition-all"
                    >
                      Go to Stage 04
                    </button>
                  </div>
                </div>
              ) : (
            <div className="space-y-6">
              {/* Foundation Instrument */}
              {detail.stage04?.hasFoundationInstrument && detail.stage04?.foundationData && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div
                    className="flex items-center justify-between mb-4 cursor-pointer"
                    onClick={() => toggleSection('foundation')}
                  >
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Foundation Instrument (ตราสารจัดตั้งมูลนิธิ)
                    </h3>
                    <svg
                      className={`w-5 h-5 text-text-secondary transition-transform ${expandedSections.foundation ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {expandedSections.foundation && (
                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Foundation Name</div>
                          <div className="text-sm font-medium text-text-primary">
                            {detail.stage04.foundationData.name || '-'}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Short Name</div>
                          <div className="text-sm font-medium text-text-primary">
                            {detail.stage04.foundationData.shortName || '-'}
                          </div>
                        </div>
                      </div>

                      {/* Address */}
                      {detail.stage04.foundationData.address && (
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Address</div>
                          <div className="text-sm font-medium text-text-primary whitespace-pre-wrap">
                            {detail.stage04.foundationData.address}
                          </div>
                        </div>
                      )}

                      {/* Logo Description */}
                      {detail.stage04.foundationData.logoDescription && (
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Logo Description</div>
                          <div className="text-sm font-medium text-text-primary whitespace-pre-wrap">
                            {detail.stage04.foundationData.logoDescription}
                          </div>
                        </div>
                      )}

                      {/* Charter Sections */}
                      {detail.stage04.foundationData.charterSections && detail.stage04.foundationData.charterSections.length > 0 && (
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-3">Charter Sections</div>
                          <div className="space-y-2">
                            {detail.stage04.foundationData.charterSections.map((section: any, idx: number) => (
                              <div key={idx} className="pl-4 border-l-2 border-accent/30">
                                <div className="text-sm font-semibold text-text-primary">
                                  {section.sectionName}
                                </div>
                                {section.charterArticles && section.charterArticles.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {section.charterArticles.map((article: any, aIdx: number) => (
                                      <div key={aIdx} className="text-xs text-text-secondary pl-3">
                                        • {article.articleNumber}: {article.content}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Committee Members */}
              {detail.stage04?.committeeMembers && detail.stage04.committeeMembers.length > 0 && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div
                    className="flex items-center justify-between mb-4 cursor-pointer"
                    onClick={() => toggleSection('committee')}
                  >
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Committee Members ({detail.stage04?.committeeCount || 0})
                    </h3>
                    <svg
                      className={`w-5 h-5 text-text-secondary transition-transform ${expandedSections.committee ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {expandedSections.committee && (
                    <div className="space-y-3">
                      {detail.stage04.committeeMembers.map((member: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl bg-bg-secondary/50 border border-border-color/30">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-accent font-bold">{idx + 1}</span>
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs text-text-secondary">Name</div>
                                <div className="text-sm font-semibold text-text-primary">{member.name || '-'}</div>
                              </div>
                              {member.position && (
                                <div>
                                  <div className="text-xs text-text-secondary">Position</div>
                                  <div className="text-sm font-medium text-text-primary">{member.position}</div>
                                </div>
                              )}
                              {member.phone && (
                                <div>
                                  <div className="text-xs text-text-secondary">Phone</div>
                                  <div className="text-sm font-medium text-text-primary">{member.phone}</div>
                                </div>
                              )}
                              {member.address && (
                                <div className="md:col-span-2">
                                  <div className="text-xs text-text-secondary">Address</div>
                                  <div className="text-sm font-medium text-text-primary">{member.address}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
              )}
            </div>
          )}

          {/* Registration Metadata */}
          {detail?.metadata && (detail.metadata.districtOffice || detail.metadata.registrationNumber || detail.metadata.logoUrl) && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm mt-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-text-primary">Registration Metadata</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {detail.metadata.districtOffice && (
                  <div className="p-4 rounded-xl bg-bg-secondary/50">
                    <div className="text-xs text-text-secondary mb-1">District Office</div>
                    <div className="text-sm font-medium text-text-primary">{detail.metadata.districtOffice}</div>
                  </div>
                )}
                {detail.metadata.registrationNumber && (
                  <div className="p-4 rounded-xl bg-bg-secondary/50">
                    <div className="text-xs text-text-secondary mb-1">Registration Number</div>
                    <div className="text-sm font-medium text-text-primary">{detail.metadata.registrationNumber}</div>
                  </div>
                )}
                {detail.metadata.logoUrl && (
                  <div className="p-4 rounded-xl bg-bg-secondary/50">
                    <div className="text-xs text-text-secondary mb-2">Foundation Logo</div>
                    <div className="relative w-full h-24 bg-bg-primary rounded-lg overflow-hidden">
                      <Image
                        src={`${API_URL}/files/logo/${detail.metadata.logoUrl}`}
                        alt="Foundation Logo"
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Final Review Decision */}
          {!isApproved && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm mt-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-text-primary">Final Review Decision</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Notes / Comments (Optional):
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border-color/50 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-all resize-none"
                    rows={4}
                    placeholder="Add any notes or comments about this review..."
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={submitting}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                        Approving...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        Approve & Ready for Upload
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-text-secondary text-center">
                  By approving, this group will be marked as ready for Stage 06 (Upload)
                </p>
              </div>
            </div>
          )}

          {/* Show Notes if Approved */}
          {isApproved && detail?.stage05?.finalReviewNotes && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm mt-6">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <h3 className="font-semibold text-text-primary">Review Notes:</h3>
              </div>
              <p className="text-text-primary whitespace-pre-wrap bg-bg-secondary/30 p-4 rounded-xl">
                {detail?.stage05?.finalReviewNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
