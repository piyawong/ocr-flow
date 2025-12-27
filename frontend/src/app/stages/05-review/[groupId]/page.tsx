'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { fetchWithAuth } from '@/lib/api';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Chevron icon component
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

interface CharterSubItem {
  id: number;
  number: string;
  content: string;
  orderIndex: number;
}

interface CharterArticle {
  id: number;
  number: string;
  content: string;
  orderIndex: number;
  subItems: CharterSubItem[];
}

interface CharterSection {
  id: number;
  number: string;
  title: string;
  orderIndex: number;
  articles: CharterArticle[];
}

interface FoundationInstrument {
  id: number;
  name: string;
  shortName: string;
  address: string;
  logoDescription: string;
  isCancelled: boolean;
  charterSections: CharterSection[];
}

interface CommitteeMember {
  id: number;
  name: string;
  position: string;
  address: string;
  phone: string;
  orderIndex: number;
}

interface GroupDetailResponse {
  groupId: number;
  stage03: {
    totalPages: number;
    matchedPages: number;
    unmatchedPages: number;
    matchPercentage: number;
    documents: any[];
    labeledFiles: any[];
    isReviewed: boolean;
    reviewer: string | null;
    reviewedAt: string | null;
    remarks: string | null;
  };
  stage04: {
    hasFoundationInstrument: boolean;
    foundationData: FoundationInstrument | null;
    committeeCount: number;
    committeeMembers: CommitteeMember[];
    isReviewed: boolean;
    reviewer: string | null;
    parseDataAt: string | null;
    remarks: string | null;
  };
  stage05: {
    finalReview03: 'pending' | 'approved' | 'rejected';
    finalReview03Reviewer: string | null;
    finalReview03ReviewedAt: string | null;
    finalReview03Notes: string | null;
    finalReview04: 'pending' | 'approved' | 'rejected';
    finalReview04Reviewer: string | null;
    finalReview04ReviewedAt: string | null;
    finalReview04Notes: string | null;
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

  const [groupDetail, setGroupDetail] = useState<GroupDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'foundation' | 'committee'>('foundation');
  const [notes03, setNotes03] = useState('');
  const [notes04, setNotes04] = useState('');
  const [submitting03, setSubmitting03] = useState(false);
  const [submitting04, setSubmitting04] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [isEditingStage03, setIsEditingStage03] = useState(false);
  const [isEditingStage04, setIsEditingStage04] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`/files/final-review-groups/${groupId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch group detail');
        }
        const data = await res.json();
        console.log('📊 Final Review Group Detail:', data);
        console.log('📊 Foundation Data:', data?.stage04?.foundationData);
        console.log('📊 Charter Sections:', data?.stage04?.foundationData?.charterSections);
        if (data?.stage04?.foundationData?.charterSections) {
          data.stage04.foundationData.charterSections.forEach((s: any, idx: number) => {
            console.log(`📊 Section ${idx + 1}:`, s.title, '- Articles:', s.articles?.length || 0, s.articles);
          });
        }
        setGroupDetail(data);
        setNotes03(data?.stage05?.finalReview03Notes || '');
        setNotes04(data?.stage05?.finalReview04Notes || '');

        // Auto-expand all sections
        if (data?.stage04?.foundationData?.charterSections) {
          const sectionIds = data.stage04.foundationData.charterSections.map((s: CharterSection) => s.id);
          setExpandedSections(new Set(sectionIds));
        }
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

  const handleApproveStage03 = async () => {
    if (!user) return;

    setSubmitting03(true);
    try {
      const res = await fetchWithAuth(`/files/final-review-groups/${groupId}/review-stage03`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'approved',
          notes: notes03 || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to approve Stage 03');
      }

      // Refresh data
      const updatedRes = await fetchWithAuth(`/files/final-review-groups/${groupId}`);
      const updatedData = await updatedRes.json();
      setGroupDetail(updatedData);
      setNotes03(updatedData?.stage05?.finalReview03Notes || '');
      setIsEditingStage03(false);

      alert('Stage 03 (PDF Labels) approved successfully!');
    } catch (err: any) {
      console.error('Error approving Stage 03:', err);
      alert(err.message || 'Failed to approve Stage 03');
    } finally {
      setSubmitting03(false);
    }
  };

  const handleRejectStage03 = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to reject Stage 03 (PDF Labels)? This will require re-review.')) {
      return;
    }

    setSubmitting03(true);
    try {
      const res = await fetchWithAuth(`/files/final-review-groups/${groupId}/review-stage03`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'rejected',
          notes: notes03 || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reject Stage 03');
      }

      // Refresh data
      const updatedRes = await fetchWithAuth(`/files/final-review-groups/${groupId}`);
      const updatedData = await updatedRes.json();
      setGroupDetail(updatedData);
      setNotes03(updatedData?.stage05?.finalReview03Notes || '');
      setIsEditingStage03(false);

      alert('Stage 03 (PDF Labels) rejected. Please review and fix issues.');
    } catch (err: any) {
      console.error('Error rejecting Stage 03:', err);
      alert(err.message || 'Failed to reject Stage 03');
    } finally {
      setSubmitting03(false);
    }
  };

  const handleApproveStage04 = async () => {
    if (!user) return;

    setSubmitting04(true);
    try {
      const res = await fetchWithAuth(`/files/final-review-groups/${groupId}/review-stage04`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'approved',
          notes: notes04 || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to approve Stage 04');
      }

      // Refresh data
      const updatedRes = await fetchWithAuth(`/files/final-review-groups/${groupId}`);
      const updatedData = await updatedRes.json();
      setGroupDetail(updatedData);
      setNotes04(updatedData?.stage05?.finalReview04Notes || '');
      setIsEditingStage04(false);

      alert('Stage 04 (Extract Data) approved successfully!');
    } catch (err: any) {
      console.error('Error approving Stage 04:', err);
      alert(err.message || 'Failed to approve Stage 04');
    } finally {
      setSubmitting04(false);
    }
  };

  const handleRejectStage04 = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to reject Stage 04 (Extract Data)? This will require re-review.')) {
      return;
    }

    setSubmitting04(true);
    try {
      const res = await fetchWithAuth(`/files/final-review-groups/${groupId}/review-stage04`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'rejected',
          notes: notes04 || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reject Stage 04');
      }

      // Refresh data
      const updatedRes = await fetchWithAuth(`/files/final-review-groups/${groupId}`);
      const updatedData = await updatedRes.json();
      setGroupDetail(updatedData);
      setNotes04(updatedData?.stage05?.finalReview04Notes || '');
      setIsEditingStage04(false);

      alert('Stage 04 (Extract Data) rejected. Please review and fix issues.');
    } catch (err: any) {
      console.error('Error rejecting Stage 04:', err);
      alert(err.message || 'Failed to reject Stage 04');
    } finally {
      setSubmitting04(false);
    }
  };

  const toggleSection = (sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
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

  const isAdmin = () => {
    return user?.role === 'admin';
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

  if (!groupDetail) {
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

  const finalReview03Status = groupDetail?.stage05?.finalReview03 || 'pending';
  const finalReview04Status = groupDetail?.stage05?.finalReview04 || 'pending';
  const isFullyApproved = finalReview03Status === 'approved' && finalReview04Status === 'approved';
  const foundationInstrument = groupDetail?.stage04?.foundationData;
  const committeeMembers = groupDetail?.stage04?.committeeMembers || [];

  return (
    <div className="min-h-screen bg-bg-primary pb-20">
      {/* Gradient Background */}
      <div className="relative">
        <div className="absolute inset-0 h-80 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/stages/05-review')}
              className="self-start p-2 rounded-xl bg-card-bg border border-border-color/50 text-text-primary hover:bg-accent/10 hover:border-accent transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="flex-1 flex items-start gap-6">
              {/* Logo */}
              {groupDetail.metadata?.logoUrl && (
                <div className="flex-shrink-0 w-20 h-20 rounded-2xl border-2 border-border-color/40 bg-gradient-to-br from-bg-secondary/50 to-bg-secondary/20 flex items-center justify-center overflow-hidden shadow-sm">
                  <img
                    src={`${API_URL}/files/logo/${groupDetail.metadata.logoUrl}`}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
                  {foundationInstrument?.name || `Group #${groupId}`}
                </h1>
                <p className="text-text-secondary text-sm">
                  Final Review & Approval
                </p>
                {groupDetail.metadata?.districtOffice && (
                  <p className="text-text-secondary text-sm mt-1">
                    องค์กร: {groupDetail.metadata.districtOffice}
                  </p>
                )}
              </div>
            </div>

            {/* Documents Button */}
            <button
              onClick={() => window.open(`/documents/${groupId}`, '_blank', 'width=1400,height=900')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium text-sm hover:shadow-lg transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              📄 Documents
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Status Badges */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stage 03 Review Badge */}
            <div className={`rounded-2xl p-4 border ${
              finalReview03Status === 'approved'
                ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border-emerald-500/20'
                : finalReview03Status === 'rejected'
                ? 'bg-gradient-to-r from-rose-500/15 to-rose-500/5 border-rose-500/20'
                : 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  finalReview03Status === 'approved'
                    ? 'bg-emerald-500/20'
                    : finalReview03Status === 'rejected'
                    ? 'bg-rose-500/20'
                    : 'bg-amber-500/20'
                }`}>
                  {finalReview03Status === 'approved' ? (
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : finalReview03Status === 'rejected' ? (
                    <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-base ${
                    finalReview03Status === 'approved'
                      ? 'text-emerald-400'
                      : finalReview03Status === 'rejected'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}>
                    {finalReview03Status === 'approved' ? '✓ Stage 03 Approved' : finalReview03Status === 'rejected' ? '✗ Stage 03 Rejected' : '⏳ Stage 03 Pending'}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    PDF Labels Review
                  </div>
                  {finalReview03Status !== 'pending' && (
                    <div className={`text-xs mt-1 ${
                      finalReview03Status === 'approved' ? 'text-emerald-400/70' : 'text-rose-400/70'
                    }`}>
                      By {groupDetail?.stage05?.finalReview03Reviewer || 'Unknown'} on {formatDate(groupDetail?.stage05?.finalReview03ReviewedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stage 04 Review Badge */}
            <div className={`rounded-2xl p-4 border ${
              finalReview04Status === 'approved'
                ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border-emerald-500/20'
                : finalReview04Status === 'rejected'
                ? 'bg-gradient-to-r from-rose-500/15 to-rose-500/5 border-rose-500/20'
                : 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  finalReview04Status === 'approved'
                    ? 'bg-emerald-500/20'
                    : finalReview04Status === 'rejected'
                    ? 'bg-rose-500/20'
                    : 'bg-amber-500/20'
                }`}>
                  {finalReview04Status === 'approved' ? (
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : finalReview04Status === 'rejected' ? (
                    <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-base ${
                    finalReview04Status === 'approved'
                      ? 'text-emerald-400'
                      : finalReview04Status === 'rejected'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}>
                    {finalReview04Status === 'approved' ? '✓ Stage 04 Approved' : finalReview04Status === 'rejected' ? '✗ Stage 04 Rejected' : '⏳ Stage 04 Pending'}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Extract Data Review
                  </div>
                  {finalReview04Status !== 'pending' && (
                    <div className={`text-xs mt-1 ${
                      finalReview04Status === 'approved' ? 'text-emerald-400/70' : 'text-rose-400/70'
                    }`}>
                      By {groupDetail?.stage05?.finalReview04Reviewer || 'Unknown'} on {formatDate(groupDetail?.stage05?.finalReview04ReviewedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTab('foundation')}
              className={`px-5 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'foundation'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg'
                  : 'bg-card-bg/80 backdrop-blur-sm text-text-secondary hover:text-text-primary border border-border-color/50 hover:border-accent/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Foundation Instrument
            </button>
            <button
              onClick={() => setActiveTab('committee')}
              className={`px-5 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'committee'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg'
                  : 'bg-card-bg/80 backdrop-blur-sm text-text-secondary hover:text-text-primary border border-border-color/50 hover:border-accent/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Committee Members ({committeeMembers.length})
            </button>
          </div>

          {/* Remarks Cards - Display Stage 03 & 04 Remarks */}
          {(groupDetail?.stage03?.remarks || groupDetail?.stage04?.remarks) && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stage 03 Remarks Card */}
              {groupDetail?.stage03?.remarks && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Stage 03 Remarks (PDF Labels Review)</h3>
                      <p className="text-xs text-text-secondary">By {groupDetail?.stage03?.reviewer || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="text-sm text-text-primary whitespace-pre-wrap bg-bg-secondary/30 p-4 rounded-xl">
                    {groupDetail?.stage03?.remarks}
                  </div>
                </div>
              )}

              {/* Stage 04 Remarks Card */}
              {groupDetail?.stage04?.remarks && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Stage 04 Remarks (Extract Data Review)</h3>
                      <p className="text-xs text-text-secondary">By {groupDetail?.stage04?.reviewer || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="text-sm text-text-primary whitespace-pre-wrap bg-bg-secondary/30 p-4 rounded-xl">
                    {groupDetail?.stage04?.remarks}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl border border-border-color/50 shadow-xl">
            {/* Foundation Tab */}
            {activeTab === 'foundation' && (
              <div className="p-6 md:p-8">
                {!foundationInstrument ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                      <svg className="w-10 h-10 text-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">No Foundation Instrument Data</h3>
                    <p className="text-text-secondary text-sm">This group doesn't have foundation instrument data.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-2xl border border-border-color/30 p-6">
                      <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Basic Information
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Foundation Name</div>
                          <div className="text-sm font-medium text-text-primary">{foundationInstrument.name || '-'}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-bg-secondary/50">
                          <div className="text-xs text-text-secondary mb-1">Short Name</div>
                          <div className="text-sm font-medium text-text-primary">{foundationInstrument.shortName || '-'}</div>
                        </div>
                      </div>

                      {foundationInstrument.address && (
                        <div className="p-4 rounded-xl bg-bg-secondary/50 mt-4">
                          <div className="text-xs text-text-secondary mb-1">Address</div>
                          <div className="text-sm font-medium text-text-primary whitespace-pre-wrap">{foundationInstrument.address}</div>
                        </div>
                      )}

                      {foundationInstrument.logoDescription && (
                        <div className="p-4 rounded-xl bg-bg-secondary/50 mt-4">
                          <div className="text-xs text-text-secondary mb-1">Logo Description</div>
                          <div className="text-sm font-medium text-text-primary whitespace-pre-wrap">{foundationInstrument.logoDescription}</div>
                        </div>
                      )}
                    </div>

                    {/* Charter Sections */}
                    {foundationInstrument.charterSections && foundationInstrument.charterSections.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-500/5 via-transparent to-accent/5 rounded-2xl border border-border-color/30 p-6">
                        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Charter Sections ({foundationInstrument.charterSections.length})
                        </h2>

                        <div className="space-y-3">
                          {foundationInstrument.charterSections.map((section) => (
                            <div key={section.id} className="border border-border-color/30 rounded-xl overflow-hidden bg-bg-secondary/30">
                              {/* Section Header */}
                              <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/5 transition-colors"
                              >
                                <ChevronIcon expanded={expandedSections.has(section.id)} />
                                <div className="flex-1 text-left">
                                  <div className="font-semibold text-text-primary">
                                    หมวด {section.number}: {section.title}
                                  </div>
                                  <div className="text-xs text-text-secondary mt-0.5">
                                    {section.articles?.length || 0} ข้อ
                                  </div>
                                </div>
                              </button>

                              {/* Section Content */}
                              {expandedSections.has(section.id) && section.articles && section.articles.length > 0 && (
                                <div className="px-4 pb-4 space-y-2">
                                  {section.articles.map((article) => (
                                    <div key={article.id} className="pl-6 border-l-2 border-accent/30">
                                      <div className="text-sm font-medium text-text-primary mb-1">
                                        ข้อ {article.number}
                                      </div>
                                      <div className="text-sm text-text-secondary whitespace-pre-wrap mb-2">
                                        {article.content}
                                      </div>

                                      {article.subItems && article.subItems.length > 0 && (
                                        <div className="ml-4 space-y-1">
                                          {article.subItems.map((subItem) => (
                                            <div key={subItem.id} className="text-sm text-text-secondary">
                                              ({subItem.number}) {subItem.content}
                                            </div>
                                          ))}
                                        </div>
                                      )}
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

            {/* Committee Tab */}
            {activeTab === 'committee' && (
              <div className="p-6 md:p-8">
                {committeeMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                      <svg className="w-10 h-10 text-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">No Committee Members</h3>
                    <p className="text-text-secondary text-sm">This group doesn't have committee members data.</p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-500/5 via-transparent to-accent/5 rounded-2xl border border-border-color/30 p-6">
                    <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Committee Members ({committeeMembers.length})
                    </h2>

                    <div className="space-y-3">
                      {committeeMembers.map((member, idx) => (
                        <div key={member.id} className="p-4 rounded-xl bg-bg-secondary/50 border border-border-color/30">
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Sections */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage 03 Review Section */}
            {(finalReview03Status === 'pending' || (isAdmin() && isEditingStage03)) && (
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-text-primary">Review Stage 03</h2>
                    <p className="text-xs text-text-secondary">PDF Labels</p>
                  </div>
                  {isEditingStage03 && (
                    <button
                      onClick={() => {
                        setIsEditingStage03(false);
                        setNotes03(groupDetail?.stage05?.finalReview03Notes || '');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-color/50 text-text-secondary hover:text-text-primary hover:border-accent transition-all text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Notes / Comments (Optional):
                    </label>
                    <textarea
                      value={notes03}
                      onChange={(e) => setNotes03(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border-color/50 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-all resize-none"
                      rows={3}
                      placeholder="Add notes about PDF labels review..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleApproveStage03}
                      disabled={submitting03}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting03 ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          Approve Stage 03
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleRejectStage03}
                      disabled={submitting03}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting03 ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject Stage 03
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Review Button for Stage 03 (Admin only, when already reviewed) */}
            {isAdmin() && (finalReview03Status === 'approved' || finalReview03Status === 'rejected') && !isEditingStage03 && (
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Stage 03 Review</h2>
                    <p className="text-xs text-text-secondary">Already reviewed as {finalReview03Status}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingStage03(true)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Review
                </button>
              </div>
            )}

            {/* Stage 04 Review Section */}
            {(finalReview04Status === 'pending' || (isAdmin() && isEditingStage04)) && (
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-text-primary">Review Stage 04</h2>
                    <p className="text-xs text-text-secondary">Extract Data</p>
                  </div>
                  {isEditingStage04 && (
                    <button
                      onClick={() => {
                        setIsEditingStage04(false);
                        setNotes04(groupDetail?.stage05?.finalReview04Notes || '');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-color/50 text-text-secondary hover:text-text-primary hover:border-accent transition-all text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Notes / Comments (Optional):
                    </label>
                    <textarea
                      value={notes04}
                      onChange={(e) => setNotes04(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border-color/50 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-all resize-none"
                      rows={3}
                      placeholder="Add notes about extracted data review..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleApproveStage04}
                      disabled={submitting04}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting04 ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          Approve Stage 04
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleRejectStage04}
                      disabled={submitting04}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting04 ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject Stage 04
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Review Button for Stage 04 (Admin only, when already reviewed) */}
            {isAdmin() && (finalReview04Status === 'approved' || finalReview04Status === 'rejected') && !isEditingStage04 && (
              <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Stage 04 Review</h2>
                    <p className="text-xs text-text-secondary">Already reviewed as {finalReview04Status}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingStage04(true)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Review
                </button>
              </div>
            )}
          </div>

          {/* Fully Approved Message */}
          {isFullyApproved && (
            <div className="mt-6 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-emerald-400 font-bold text-xl">Fully Approved!</div>
                  <div className="text-emerald-400/70 text-sm mt-1">
                    Both Stage 03 (PDF Labels) and Stage 04 (Extract Data) have been approved. This group is ready for Stage 06 (Upload).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show Notes */}
          {(groupDetail?.stage05?.finalReview03Notes || groupDetail?.stage05?.finalReview04Notes) && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stage 03 Notes */}
              {groupDetail?.stage05?.finalReview03Notes && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h3 className="font-semibold text-text-primary">Stage 03 Review Notes:</h3>
                  </div>
                  <p className="text-text-primary whitespace-pre-wrap bg-bg-secondary/30 p-4 rounded-xl text-sm">
                    {groupDetail?.stage05?.finalReview03Notes}
                  </p>
                </div>
              )}

              {/* Stage 04 Notes */}
              {groupDetail?.stage05?.finalReview04Notes && (
                <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 border border-border-color/50 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h3 className="font-semibold text-text-primary">Stage 04 Review Notes:</h3>
                  </div>
                  <p className="text-text-primary whitespace-pre-wrap bg-bg-secondary/30 p-4 rounded-xl text-sm">
                    {groupDetail?.stage05?.finalReview04Notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
