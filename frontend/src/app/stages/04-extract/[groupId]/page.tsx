'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { fetchWithAuth } from '@/lib/api';
import { DistrictOfficeCombobox } from '@/components/shared/DistrictOfficeCombobox';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Chevron icon component with smooth animation
const ChevronIcon = ({ expanded, className = '' }: { expanded: boolean; className?: string }) => (
  <svg
    className={`w-4 h-4 transition-all duration-300 ease-out ${expanded ? 'rotate-90' : ''} ${className}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Plus icon for adding items
const PlusIcon = ({ className = '' }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Trash icon for deleting
const TrashIcon = ({ className = '' }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// Document icon
const DocumentIcon = ({ className = '' }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Auto-resize textarea component
const AutoResizeTextarea = ({
  value,
  onChange,
  className = '',
  placeholder = '',
  minRows = 1
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, minRows * 24)}px`;
    }
  }, [value, minRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      rows={minRows}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  );
};

interface SubItem {
  id: number;
  number: string;
  content: string;
  orderIndex: number;
}

interface Article {
  id: number;
  number: string;
  content: string;
  orderIndex: number;
  subItems?: SubItem[];
}

interface CharterSection {
  id: number;
  number: string;
  title: string;
  orderIndex: number;
  articles: Article[];
}

interface FoundationInstrument {
  id: number;
  name: string;
  shortName: string;
  address: string;
  logoDescription: string;
  charterSections: CharterSection[];
}

interface CommitteeMember {
  id: number;
  name: string;
  address: string;
  phone: string;
  position: string;
  orderIndex: number;
}

interface ParsedGroupDetail {
  group: {
    id: number;
    isParseData: boolean;
    parseDataAt: string | null;
    isParseDataReviewed: boolean;
    parseDataReviewer: string | null;
    extractDataNotes: string | null;
    districtOffice: string | null;
    registrationNumber: string | null;
    logoUrl: string | null;
  };
  foundationInstrument: FoundationInstrument | null;
  committeeMembers: CommitteeMember[];
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { canAccessStage04 } = usePermission();
  const groupId = params.groupId as string;

  const [groupDetail, setGroupDetail] = useState<ParsedGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'foundation' | 'committee'>('foundation');
  const [reParsing, setReParsing] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  // Always in edit mode
  const [editedFoundation, setEditedFoundation] = useState<FoundationInstrument | null>(null);
  const [editedMembers, setEditedMembers] = useState<CommitteeMember[]>([]);
  const [saving, setSaving] = useState(false);

  // Group-level fields (district office & registration number)
  const [editedDistrictOffice, setEditedDistrictOffice] = useState<string>('');
  const [editedRegistrationNumber, setEditedRegistrationNumber] = useState<string>('');

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{
    districtOffice?: string;
    registrationNumber?: string;
  }>({});

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNotes, setSaveNotes] = useState('');

  // Validation error modal state
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Collapse/expand state for outline view
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set()); // format: "sectionId-articleId"

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Toggle article expansion
  const toggleArticle = useCallback((sectionId: number, articleId: number) => {
    const key = `${sectionId}-${articleId}`;
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Expand all sections
  const expandAllSections = useCallback(() => {
    if (editedFoundation?.charterSections) {
      setExpandedSections(new Set(editedFoundation.charterSections.map(s => s.id)));
      const articleKeys: string[] = [];
      editedFoundation.charterSections.forEach(s => {
        s.articles?.forEach(a => {
          articleKeys.push(`${s.id}-${a.id}`);
        });
      });
      setExpandedArticles(new Set(articleKeys));
    }
  }, [editedFoundation]);

  // Collapse all sections
  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set());
    setExpandedArticles(new Set());
  }, []);

  useEffect(() => {
    const fetchGroupDetail = async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`/files/parsed-group/${groupId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch group detail');
        }
        const detail: ParsedGroupDetail = await res.json();
        setGroupDetail(detail);

        // Set to edit mode immediately
        setEditedFoundation(detail.foundationInstrument ? JSON.parse(JSON.stringify(detail.foundationInstrument)) : null);
        setEditedMembers(JSON.parse(JSON.stringify(detail.committeeMembers || [])));

        // Set group-level fields
        setEditedDistrictOffice(detail.group.districtOffice || '');
        setEditedRegistrationNumber(detail.group.registrationNumber || '');

        // Auto-expand all sections and articles on load
        if (detail.foundationInstrument?.charterSections) {
          const sections = detail.foundationInstrument.charterSections;
          setExpandedSections(new Set(sections.map(s => s.id)));
          const articleKeys: string[] = [];
          sections.forEach(s => {
            s.articles?.forEach(a => {
              if (a.subItems && a.subItems.length > 0) {
                articleKeys.push(`${s.id}-${a.id}`);
              }
            });
          });
          setExpandedArticles(new Set(articleKeys));
        }
      } catch (err) {
        console.error('Error fetching group detail:', err);
        alert('Error loading group detail');
        router.push('/stages/04-extract');
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchGroupDetail();
    }
  }, [groupId, router]);

  const handleReParse = async () => {
    if (!confirm('Re-parse this group? This will regenerate all extracted data.')) {
      return;
    }

    setReParsing(true);
    try {
      const res = await fetchWithAuth(`/parse-runner/parse/${groupId}?force=true`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to re-parse');
      }

      alert('Re-parse successful! Refreshing data...');
      window.location.reload();
    } catch (err: any) {
      console.error('Error re-parsing:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setReParsing(false);
    }
  };

  // Validate required fields
  const validateFields = (): boolean => {
    const errors: { districtOffice?: string; registrationNumber?: string } = {};

    if (!editedDistrictOffice.trim()) {
      errors.districtOffice = 'กรุณาระบุสำนักงานเขต';
    }
    if (!editedRegistrationNumber.trim()) {
      errors.registrationNumber = 'กรุณาระบุเลขทะเบียน';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open save modal
  const handleOpenSaveModal = () => {
    // Validate required fields first
    if (!validateFields()) {
      // Show validation error modal
      setShowValidationModal(true);
      return;
    }

    // Check if user is logged in
    if (!user?.name) {
      alert('กรุณาเข้าสู่ระบบก่อนบันทึก');
      return;
    }

    setSaveNotes('');
    setShowSaveModal(true);
  };

  const handleSaveAndReview = async () => {
    const reviewer = user?.name;
    if (!reviewer) return;

    setShowSaveModal(false);
    setMarkingReviewed(true);

    try {
      // Step 1: Save edited data first
      const saveRes = await fetchWithAuth(`/files/parsed-group/${groupId}/update`, {
        method: 'PUT',
        body: JSON.stringify({
          foundationInstrument: editedFoundation,
          committeeMembers: editedMembers,
          districtOffice: editedDistrictOffice.trim(),
          registrationNumber: editedRegistrationNumber.trim(),
        }),
      });

      if (!saveRes.ok) {
        const error = await saveRes.json();
        throw new Error(error.message || 'Failed to save changes');
      }

      // Step 2: Mark as reviewed
      const reviewRes = await fetchWithAuth(`/files/parsed-group/${groupId}/mark-reviewed`, {
        method: 'POST',
        body: JSON.stringify({ reviewer, notes: saveNotes || undefined }),
      });

      if (!reviewRes.ok) {
        const error = await reviewRes.json();
        throw new Error(error.message || 'Failed to mark as reviewed');
      }

      alert('บันทึกและ Review สำเร็จ!');
      window.location.reload();
    } catch (err: any) {
      console.error('Error saving/reviewing:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setMarkingReviewed(false);
    }
  };

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // Trigger save if not currently saving
        if (groupDetail && !markingReviewed && !showSaveModal) {
          handleOpenSaveModal();
        }
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        if (showSaveModal) setShowSaveModal(false);
        if (showValidationModal) setShowValidationModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Listen for logo updates from logo cropper window
  useEffect(() => {
    // Handler for updating logo
    const updateLogo = (logoUrl: string) => {
      const newLogoUrl = logoUrl + '?t=' + Date.now();
      setGroupDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          group: {
            ...prev.group,
            logoUrl: newLogoUrl,
          },
        };
      });
    };

    // Listen for postMessage (fallback)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'LOGO_UPDATED' && String(event.data?.groupId) === String(groupId)) {
        updateLogo(event.data.logoUrl);
      }
    };

    // Listen for localStorage changes (more reliable across windows)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'logo-updated' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data.type === 'LOGO_UPDATED' && String(data.groupId) === String(groupId)) {
            updateLogo(data.logoUrl);
          }
        } catch (e) {
          console.error('Error parsing logo update:', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [groupId]);

  // Foundation editing helpers
  const updateFoundationField = (field: keyof FoundationInstrument, value: any) => {
    if (editedFoundation) {
      setEditedFoundation({ ...editedFoundation, [field]: value });
    }
  };

  const addSection = () => {
    if (!editedFoundation) return;
    const newSection: CharterSection = {
      id: Date.now(),
      number: String(editedFoundation.charterSections.length + 1),
      title: 'หมวดใหม่',
      orderIndex: editedFoundation.charterSections.length,
      articles: [],
    };
    setEditedFoundation({
      ...editedFoundation,
      charterSections: [...editedFoundation.charterSections, newSection],
    });
  };

  const removeSection = (sectionId: number) => {
    if (!editedFoundation || !confirm('Delete this section?')) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.filter(s => s.id !== sectionId),
    });
  };

  const updateSection = (sectionId: number, field: keyof CharterSection, value: any) => {
    if (!editedFoundation) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId ? { ...s, [field]: value } : s
      ),
    });
  };

  const addArticle = (sectionId: number) => {
    if (!editedFoundation) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s => {
        if (s.id === sectionId) {
          const newArticle: Article = {
            id: Date.now(),
            number: String(s.articles.length + 1),
            content: 'ข้อใหม่',
            orderIndex: s.articles.length,
            subItems: [],
          };
          return { ...s, articles: [...s.articles, newArticle] };
        }
        return s;
      }),
    });
  };

  const removeArticle = (sectionId: number, articleId: number) => {
    if (!editedFoundation || !confirm('Delete this article?')) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId
          ? { ...s, articles: s.articles.filter(a => a.id !== articleId) }
          : s
      ),
    });
  };

  const updateArticle = (sectionId: number, articleId: number, field: keyof Article, value: any) => {
    if (!editedFoundation) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              articles: s.articles.map(a =>
                a.id === articleId ? { ...a, [field]: value } : a
              ),
            }
          : s
      ),
    });
  };

  const addSubItem = (sectionId: number, articleId: number) => {
    if (!editedFoundation) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              articles: s.articles.map(a => {
                if (a.id === articleId) {
                  const subItems = a.subItems || [];
                  const newSubItem: SubItem = {
                    id: Date.now(),
                    number: `${a.number}.${subItems.length + 1}`,
                    content: 'อนุข้อใหม่',
                    orderIndex: subItems.length,
                  };
                  return { ...a, subItems: [...subItems, newSubItem] };
                }
                return a;
              }),
            }
          : s
      ),
    });
    // Auto-expand the article when adding sub-item
    const key = `${sectionId}-${articleId}`;
    setExpandedArticles(prev => new Set([...prev, key]));
  };

  const removeSubItem = (sectionId: number, articleId: number, subItemId: number) => {
    if (!editedFoundation || !confirm('Delete this sub-item?')) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              articles: s.articles.map(a =>
                a.id === articleId
                  ? { ...a, subItems: (a.subItems || []).filter(si => si.id !== subItemId) }
                  : a
              ),
            }
          : s
      ),
    });
  };

  const updateSubItem = (sectionId: number, articleId: number, subItemId: number, field: keyof SubItem, value: any) => {
    if (!editedFoundation) return;
    setEditedFoundation({
      ...editedFoundation,
      charterSections: editedFoundation.charterSections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              articles: s.articles.map(a =>
                a.id === articleId
                  ? {
                      ...a,
                      subItems: (a.subItems || []).map(si =>
                        si.id === subItemId ? { ...si, [field]: value } : si
                      ),
                    }
                  : a
              ),
            }
          : s
      ),
    });
  };

  // Committee members helpers
  const addMember = () => {
    const newMember: CommitteeMember = {
      id: Date.now(),
      name: '',
      address: '',
      phone: '',
      position: '',
      orderIndex: editedMembers.length,
    };
    setEditedMembers([...editedMembers, newMember]);
  };

  const removeMember = (memberId: number) => {
    if (!confirm('Delete this member?')) return;
    setEditedMembers(editedMembers.filter(m => m.id !== memberId));
  };

  const updateMember = (memberId: number, field: keyof CommitteeMember, value: any) => {
    setEditedMembers(
      editedMembers.map(m => (m.id === memberId ? { ...m, [field]: value } : m))
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openDocumentsViewer = () => {
    const url = `/documents/${groupId}`;
    window.open(url, '_blank', 'width=940,height=900');
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin"></div>
              <p className="text-text-secondary text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!groupDetail) {
    return (
      <div className="min-h-screen bg-bg-primary p-6 md:p-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center">
              <svg className="w-10 h-10 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-text-primary text-lg font-medium">ไม่พบข้อมูล Group</p>
            <button
              onClick={() => router.push('/stages/04-extract')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium hover:from-blue-700 hover:to-purple-800 hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              กลับไปหน้ารายการ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Always use edited data (always in edit mode)
  const displayFoundation = editedFoundation;
  const displayMembers = editedMembers;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
            <div className="flex items-start gap-5">
              {/* Back Button */}
              <button
                onClick={() => router.push('/stages/04-extract')}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-card-bg/80 backdrop-blur-sm border border-border-color/50 flex items-center justify-center hover:bg-accent/10 hover:border-accent/50 transition-all duration-300 text-text-secondary hover:text-accent group"
                title="กลับไปหน้ารายการ"
              >
                <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Logo Area - Large */}
              <div
                onClick={() => window.open(`/logo-cropper/${groupId}`, '_blank', 'width=1200,height=800')}
                className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-border-color/40 hover:border-accent/50 bg-gradient-to-br from-bg-secondary/50 to-bg-secondary/20 flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-md overflow-hidden"
                title="คลิกเพื่อเลือก Logo"
              >
                {groupDetail.group.logoUrl ? (
                  <img
                    src={`${API_URL}/files/logo/${groupDetail.group.logoUrl}`}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      // Fallback to placeholder if image fails
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <svg className={`w-10 h-10 text-text-secondary/30 group-hover:text-accent/50 transition-colors ${groupDetail.group.logoUrl ? 'hidden' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                {/* Top Row: Badges */}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  {/* Group Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300/50">
                    <span className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {groupDetail.group.id}
                    </span>
                    <span className="text-blue-700 font-semibold text-sm">Group</span>
                  </div>

                  {/* Review Status Badge */}
                  {groupDetail.group.isParseDataReviewed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Reviewed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pending Review
                    </span>
                  )}
                </div>

                {/* Foundation Name */}
                <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-2 leading-tight truncate">
                  {displayFoundation?.name || 'ไม่พบข้อมูลตราสาร'}
                </h1>

                {/* Registration Info Row */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 flex-shrink-0 ${validationErrors.districtOffice ? 'text-rose-400' : 'text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <DistrictOfficeCombobox
                        value={editedDistrictOffice}
                        onChange={(value) => {
                          setEditedDistrictOffice(value);
                          if (validationErrors.districtOffice) {
                            setValidationErrors(prev => ({ ...prev, districtOffice: undefined }));
                          }
                        }}
                        placeholder="สำนักงานเขต *"
                        error={!!validationErrors.districtOffice}
                        onClearError={() => setValidationErrors(prev => ({ ...prev, districtOffice: undefined }))}
                      />
                    </div>
                    {validationErrors.districtOffice && (
                      <span className="text-xs text-rose-400 ml-6">{validationErrors.districtOffice}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 flex-shrink-0 ${validationErrors.registrationNumber ? 'text-rose-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      <input
                        type="text"
                        value={editedRegistrationNumber}
                        onChange={(e) => {
                          setEditedRegistrationNumber(e.target.value);
                          if (validationErrors.registrationNumber) {
                            setValidationErrors(prev => ({ ...prev, registrationNumber: undefined }));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md bg-white/80 hover:bg-white focus:bg-white dark:bg-slate-700/60 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none transition-all duration-200 w-36 ${
                          validationErrors.registrationNumber
                            ? 'border-rose-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20'
                            : 'border-border-color/30 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20'
                        }`}
                        placeholder="เลขทะเบียน *"
                      />
                    </div>
                    {validationErrors.registrationNumber && (
                      <span className="text-xs text-rose-400 ml-6">{validationErrors.registrationNumber}</span>
                    )}
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(groupDetail.group.parseDataAt)}
                  </span>
                  {groupDetail.group.parseDataReviewer && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {groupDetail.group.parseDataReviewer}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenSaveModal}
                disabled={markingReviewed}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {markingReviewed ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>บันทึก & Review</span>
                  </>
                )}
              </button>
              <button
                onClick={handleReParse}
                disabled={reParsing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {reParsing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    <span>กำลัง Parse...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Re-parse</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              className={`px-5 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'foundation'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg hover:from-blue-700 hover:to-purple-800'
                  : 'bg-card-bg/80 backdrop-blur-sm text-text-secondary hover:text-text-primary border border-border-color/50 hover:border-accent/50 hover:bg-accent/5'
              }`}
              onClick={() => setActiveTab('foundation')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>ตราสาร</span>
            </button>
            <button
              className={`px-5 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'committee'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg hover:from-blue-700 hover:to-purple-800'
                  : 'bg-card-bg/80 backdrop-blur-sm text-text-secondary hover:text-text-primary border border-border-color/50 hover:border-accent/50 hover:bg-accent/5'
              }`}
              onClick={() => setActiveTab('committee')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>กรรมการ</span>
              <span className="px-2 py-0.5 rounded-lg bg-white/20 text-xs font-bold">
                {displayMembers?.length || 0}
              </span>
            </button>
            <button
              className="px-5 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 bg-card-bg/80 backdrop-blur-sm text-text-secondary hover:text-text-primary border border-border-color/50 hover:border-purple-500/50 hover:bg-purple-500/5 group"
              onClick={openDocumentsViewer}
              title="เปิดดูเอกสารในหน้าต่างใหม่"
            >
              <DocumentIcon className="text-purple-400" />
              <span>เอกสาร</span>
              <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl border border-border-color/50 shadow-xl shadow-black/5">
            {activeTab === 'foundation' && (
              <div className="p-6 md:p-8">
                {!displayFoundation ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-text-secondary/10 to-text-secondary/5 flex items-center justify-center">
                      <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-text-secondary text-sm">ไม่พบข้อมูลตราสาร</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Basic Info Card */}
                    <div className="bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5 rounded-2xl border border-border-color/30 p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">ข้อมูลพื้นฐาน</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                            ชื่อมูลนิธิ
                          </label>
                          <input
                            type="text"
                            value={displayFoundation.name || ''}
                            onChange={(e) => updateFoundationField('name', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200"
                            placeholder="ระบุชื่อมูลนิธิ"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            ชื่อย่อ
                          </label>
                          <input
                            type="text"
                            value={displayFoundation.shortName || ''}
                            onChange={(e) => updateFoundationField('shortName', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200"
                            placeholder="เช่น มส."
                          />
                        </div>
                      </div>

                      <div className="mt-5 space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          ที่อยู่
                        </label>
                        <textarea
                          value={displayFoundation.address || ''}
                          onChange={(e) => updateFoundationField('address', e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200 resize-none"
                          placeholder="ระบุที่อยู่"
                        />
                      </div>

                      <div className="mt-5 space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          คำอธิบายตราสัญลักษณ์
                        </label>
                        <textarea
                          value={displayFoundation.logoDescription || ''}
                          onChange={(e) => updateFoundationField('logoDescription', e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200 resize-none"
                          placeholder="อธิบายลักษณะตราสัญลักษณ์"
                        />
                      </div>
                    </div>

                    {/* Charter Sections - Outline/Tree View */}
                    {displayFoundation.charterSections && displayFoundation.charterSections.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-500/5 via-transparent to-accent/5 rounded-2xl border border-border-color/30 p-6">
                        {/* Header with controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-text-primary">หมวดข้อบังคับ</h3>
                              <p className="text-sm text-text-secondary">{displayFoundation.charterSections.length} หมวด</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={expandAllSections}
                              className="px-3 py-2 rounded-lg bg-bg-primary/50 border border-border-color/30 text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 text-sm flex items-center gap-1.5"
                              title="ขยายทั้งหมด"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                              </svg>
                              ขยาย
                            </button>
                            <button
                              onClick={collapseAllSections}
                              className="px-3 py-2 rounded-lg bg-bg-primary/50 border border-border-color/30 text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 text-sm flex items-center gap-1.5"
                              title="ยุบทั้งหมด"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                              </svg>
                              ยุบ
                            </button>
                            <button
                              onClick={addSection}
                              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 flex items-center gap-1.5"
                            >
                              <PlusIcon className="w-4 h-4" />
                              เพิ่มหมวด
                            </button>
                          </div>
                        </div>

                        {/* Outline Tree View */}
                        <div className="rounded-xl border border-border-color/30 overflow-hidden bg-bg-primary/30">
                          {displayFoundation.charterSections.map((section, sectionIdx) => {
                            const isSectionExpanded = expandedSections.has(section.id);
                            const articleCount = section.articles?.length || 0;

                            return (
                              <div key={section.id} className={sectionIdx > 0 ? 'border-t border-border-color/30' : ''}>
                                {/* Section Header (Level 0) */}
                                <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/10 transition-all duration-200 group bg-bg-secondary/50">
                                  {/* Expand/Collapse Toggle */}
                                  <button
                                    onClick={() => toggleSection(section.id)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                                      isSectionExpanded
                                        ? 'bg-accent/20 text-accent'
                                        : 'bg-bg-primary/50 text-text-secondary hover:bg-accent/10 hover:text-accent'
                                    }`}
                                    title={isSectionExpanded ? 'ยุบ' : 'ขยาย'}
                                  >
                                    <ChevronIcon expanded={isSectionExpanded} />
                                  </button>

                                  {/* Section Badge */}
                                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 text-white font-bold text-sm flex items-center justify-center shadow-md">
                                    {section.number || sectionIdx + 1}
                                  </div>

                                  {/* Section Title - Inline Editable */}
                                  <input
                                    type="text"
                                    value={section.title}
                                    onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/90 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 hover:border-accent/50 focus:border-accent text-text-primary font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                    placeholder="ชื่อหมวด"
                                  />

                                  {/* Article Count Badge */}
                                  <span className="text-xs text-text-secondary bg-bg-primary/70 px-2.5 py-1.5 rounded-lg border border-border-color/30">
                                    {articleCount} ข้อ
                                  </span>

                                  {/* Action Buttons - Show on hover */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                    <button
                                      onClick={() => addArticle(section.id)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                      title="เพิ่มข้อ"
                                    >
                                      <PlusIcon />
                                    </button>
                                    <button
                                      onClick={() => removeSection(section.id)}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                      title="ลบหมวด"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>

                                {/* Articles (Level 1) - Collapsible with animation */}
                                <div className={`overflow-hidden transition-all duration-300 ease-out ${isSectionExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                  {section.articles && section.articles.length > 0 && (
                                    <div className="bg-bg-primary/50 border-t border-border-color/20">
                                      {section.articles.map((article, articleIdx) => {
                                        const articleKey = `${section.id}-${article.id}`;
                                        const isArticleExpanded = expandedArticles.has(articleKey);
                                        const hasSubItems = article.subItems && article.subItems.length > 0;

                                        return (
                                          <div key={article.id} className={articleIdx > 0 ? 'border-t border-border-color/20' : ''}>
                                            {/* Article Row */}
                                            <div className="flex items-start gap-3 pl-14 pr-4 py-3 hover:bg-accent/10 transition-all duration-200 group">
                                              {/* Expand/Collapse Toggle for SubItems */}
                                              <button
                                                onClick={() => hasSubItems && toggleArticle(section.id, article.id)}
                                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 mt-0.5 flex-shrink-0 ${
                                                  hasSubItems
                                                    ? isArticleExpanded
                                                      ? 'bg-purple-500/20 text-purple-400'
                                                      : 'bg-bg-primary/50 text-text-secondary hover:bg-purple-500/10 hover:text-purple-400 cursor-pointer'
                                                    : 'opacity-0 cursor-default'
                                                }`}
                                                disabled={!hasSubItems}
                                              >
                                                {hasSubItems && <ChevronIcon expanded={isArticleExpanded} className="w-3.5 h-3.5" />}
                                              </button>

                                              {/* Article Number Badge */}
                                              <input
                                                type="text"
                                                value={article.number}
                                                onChange={(e) => updateArticle(section.id, article.id, 'number', e.target.value)}
                                                className="flex-shrink-0 w-12 h-8 rounded-lg bg-accent/20 text-accent font-bold text-xs text-center border border-accent/30 hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                                                placeholder="ข้อ"
                                              />

                                              {/* Article Content - Inline Editable with Auto-resize */}
                                              <AutoResizeTextarea
                                                value={article.content}
                                                onChange={(e) => updateArticle(section.id, article.id, 'content', e.target.value)}
                                                minRows={1}
                                                className="flex-1 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700 dark:hover:bg-slate-600 dark:focus:bg-slate-600 border border-border-color/50 hover:border-accent/50 focus:border-accent text-text-primary text-sm leading-relaxed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/20"
                                                placeholder="เนื้อหาข้อ"
                                              />

                                              {/* SubItems Count Badge */}
                                              {hasSubItems && (
                                                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20 mt-0.5 flex-shrink-0">
                                                  {article.subItems?.length} อนุข้อ
                                                </span>
                                              )}

                                              {/* Action Buttons */}
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 mt-0.5 flex-shrink-0">
                                                <button
                                                  onClick={() => addSubItem(section.id, article.id)}
                                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                  title="เพิ่มอนุข้อ"
                                                >
                                                  <PlusIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => removeArticle(section.id, article.id)}
                                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                                                  title="ลบข้อ"
                                                >
                                                  <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            {/* SubItems (Level 2) - Collapsible with animation */}
                                            <div className={`overflow-hidden transition-all duration-300 ease-out ${isArticleExpanded && hasSubItems ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                              {article.subItems && (
                                                <div className="bg-bg-secondary/30 border-t border-border-color/10 ml-14">
                                                  {article.subItems.map((subItem, subIdx) => (
                                                    <div
                                                      key={subItem.id}
                                                      className={`flex items-start gap-3 pl-10 pr-4 py-2.5 hover:bg-accent/5 transition-all duration-200 group ${subIdx > 0 ? 'border-t border-border-color/10' : ''}`}
                                                    >
                                                      {/* SubItem Number */}
                                                      <input
                                                        type="text"
                                                        value={subItem.number}
                                                        onChange={(e) => updateSubItem(section.id, article.id, subItem.id, 'number', e.target.value)}
                                                        className="flex-shrink-0 w-14 h-7 rounded-lg bg-purple-500/20 text-purple-300 font-medium text-xs text-center border border-purple-500/30 hover:border-purple-500/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                                                        placeholder="อนุข้อ"
                                                      />

                                                      {/* SubItem Content - Auto-resize */}
                                                      <AutoResizeTextarea
                                                        value={subItem.content}
                                                        onChange={(e) => updateSubItem(section.id, article.id, subItem.id, 'content', e.target.value)}
                                                        minRows={1}
                                                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 focus:bg-white dark:bg-slate-600 dark:hover:bg-slate-500 dark:focus:bg-slate-500 border border-border-color/50 hover:border-purple-400/50 focus:border-purple-400 text-text-primary text-sm leading-relaxed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                                                        placeholder="เนื้อหาอนุข้อ"
                                                      />

                                                      {/* Delete Button */}
                                                      <button
                                                        onClick={() => removeSubItem(section.id, article.id, subItem.id)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                                                        title="ลบอนุข้อ"
                                                      >
                                                        <TrashIcon className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Empty state for section with no articles */}
                                  {(!section.articles || section.articles.length === 0) && (
                                    <div className="px-14 py-8 bg-card-bg/30 border-t border-border-color/20 text-center">
                                      <p className="text-text-secondary text-sm mb-4">ยังไม่มีข้อในหมวดนี้</p>
                                      <button
                                        onClick={() => addArticle(section.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300/50 text-blue-700 hover:shadow-md hover:bg-blue-100 transition-all duration-200 text-sm font-medium"
                                      >
                                        <PlusIcon className="w-4 h-4" />
                                        เพิ่มข้อแรก
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'committee' && (
              <div className="p-6 md:p-8">
                <div className="bg-gradient-to-br from-emerald-500/5 via-transparent to-accent/5 rounded-2xl border border-border-color/30 p-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-text-primary">รายชื่อกรรมการ</h3>
                        <p className="text-sm text-text-secondary">{displayMembers?.length || 0} คน</p>
                      </div>
                    </div>
                    <button
                      onClick={addMember}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 flex items-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      เพิ่มกรรมการ
                    </button>
                  </div>

                  {/* Members List */}
                  {displayMembers?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-text-secondary/10 to-text-secondary/5 flex items-center justify-center">
                        <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-text-secondary text-sm">ยังไม่มีข้อมูลกรรมการ</p>
                      <button
                        onClick={addMember}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300/50 text-blue-700 hover:shadow-md hover:bg-blue-100 transition-all duration-200 text-sm font-medium"
                      >
                        <PlusIcon className="w-4 h-4" />
                        เพิ่มกรรมการคนแรก
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {displayMembers?.map((member, idx) => (
                        <div
                          key={member.id}
                          className="group bg-bg-primary/30 hover:bg-bg-primary/50 rounded-xl border border-border-color/30 hover:border-accent/30 p-5 transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            {/* Member Number Badge */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-700 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                              {idx + 1}
                            </div>

                            {/* Member Info Grid */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                  ชื่อ-นามสกุล
                                </label>
                                <input
                                  type="text"
                                  value={member.name || ''}
                                  onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                                  className="w-full px-3 py-2.5 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/30 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200"
                                  placeholder="ระบุชื่อ-นามสกุล"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                  ตำแหน่ง
                                </label>
                                <input
                                  type="text"
                                  value={member.position || ''}
                                  onChange={(e) => updateMember(member.id, 'position', e.target.value)}
                                  className="w-full px-3 py-2.5 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/30 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200"
                                  placeholder="เช่น ประธานกรรมการ"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  ที่อยู่
                                </label>
                                <textarea
                                  value={member.address || ''}
                                  onChange={(e) => updateMember(member.id, 'address', e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2.5 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/30 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200 resize-none text-sm"
                                  placeholder="ระบุที่อยู่"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  เบอร์โทร
                                </label>
                                <input
                                  type="text"
                                  value={member.phone || ''}
                                  onChange={(e) => updateMember(member.id, 'phone', e.target.value)}
                                  className="w-full px-3 py-2.5 rounded-lg bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/30 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200"
                                  placeholder="เช่น 081-234-5678"
                                />
                              </div>
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={() => removeMember(member.id)}
                              className="flex-shrink-0 w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                              title="ลบกรรมการ"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Error Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg rounded-2xl border border-border-color/50 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-500/10 to-rose-500/5 px-6 py-5 border-b border-border-color/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">กรุณากรอกข้อมูลให้ครบ</h3>
                  <p className="text-sm text-text-secondary mt-0.5">ไม่สามารถบันทึกได้ เนื่องจากข้อมูลไม่ครบถ้วน</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5">
              <p className="text-sm text-text-secondary mb-4">กรุณากรอกข้อมูลในช่องต่อไปนี้:</p>
              <div className="space-y-3">
                {validationErrors.districtOffice && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-rose-400">สำนักงานเขต</span>
                      <p className="text-xs text-text-secondary mt-0.5">{validationErrors.districtOffice}</p>
                    </div>
                  </div>
                )}
                {validationErrors.registrationNumber && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-rose-400">เลขทะเบียน</span>
                      <p className="text-xs text-text-secondary mt-0.5">{validationErrors.registrationNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-bg-secondary/30 border-t border-border-color/30 flex items-center justify-end">
              <button
                onClick={() => {
                  setShowValidationModal(false);
                  // Scroll to top to show the fields
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-medium hover:from-blue-700 hover:to-purple-800 hover:shadow-lg transition-all duration-200 flex items-center gap-2 active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg rounded-2xl border border-border-color/50 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 px-6 py-5 border-b border-border-color/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">บันทึกและ Review</h3>
                  <p className="text-sm text-text-secondary mt-0.5">ยืนยันการบันทึกข้อมูลและ Mark เป็น Reviewed</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5">
              {/* Summary */}
              <div className="bg-bg-secondary/50 rounded-xl p-4 mb-5 border border-border-color/30">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-text-primary">ข้อมูลที่จะบันทึก</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="text-text-secondary">สำนักงานเขต:</span>
                    <span className="text-text-primary font-medium truncate">{editedDistrictOffice}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span className="text-text-secondary">เลขทะเบียน:</span>
                    <span className="text-text-primary font-medium">{editedRegistrationNumber}</span>
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-50 focus:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:focus:bg-slate-700 border border-border-color/50 text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-200 resize-none text-sm"
                  placeholder="เพิ่มหมายเหตุ (optional)..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveAndReview();
                    }
                  }}
                />
                <p className="text-xs text-text-secondary">กด Enter เพื่อบันทึก หรือ Shift+Enter เพื่อขึ้นบรรทัดใหม่</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-bg-secondary/30 border-t border-border-color/30 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-5 py-2.5 rounded-xl bg-bg-primary border border-border-color/50 text-text-secondary hover:text-text-primary hover:border-border-color transition-all duration-200 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveAndReview}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                บันทึก & Mark as Reviewed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
