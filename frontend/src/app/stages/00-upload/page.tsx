'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal';
import { Pagination } from '@/components/shared/Pagination';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import { StageBadge } from '@/components/shared/StageBadge';
import { fetchWithAuth } from '@/lib/api';

interface RawFile {
  id: number;
  fileNumber: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  processed: boolean;
  processedAt: string | null;
  isReviewed: boolean;
  reviewedAt: string | null;
  createdAt: string;
}

interface PreviewFile {
  file: File;
  preview: string;
}

interface UploadProgress {
  total: number;
  uploaded: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  failedFiles: string[];
}

const BATCH_SIZE = 1; // Upload 1 file per request (safer - prevents MinIO/DB sync issues)
const MAX_PREVIEW_FILES = 6; // Only preview first 6 files

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

export default function Stage00Upload() {
  const [files, setFiles] = useState<RawFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);
  const [allSelectedFiles, setAllSelectedFiles] = useState<File[]>([]); // Store all files without preview
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const uploadAbortRef = useRef(false);
  const [removing, setRemoving] = useState(false);
  const [backendConnected, setBackendConnected] = useState(true);
  const [previewFile, setPreviewFile] = useState<RawFile | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [viewMode, setViewMode] = useState<'all' | 'unreviewed'>('all'); // 'all' = show all files, 'unreviewed' = show only unreviewed
  const [reviewedCount, setReviewedCount] = useState(0);
  const [unreviewedCount, setUnreviewedCount] = useState(0);

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: 'createdAt',
        sortOrder: 'ASC',
        processed: 'all',
      });
      const res = await fetchWithAuth(`/files?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      // Filter by review status if in unreviewed mode
      let filteredFiles = data.files || [];
      if (viewMode === 'unreviewed') {
        filteredFiles = filteredFiles.filter((f: RawFile) => !f.isReviewed);
      }

      setFiles(filteredFiles);
      setTotalPages(data.totalPages || 1);
      setTotalFiles(viewMode === 'unreviewed' ? filteredFiles.length : data.total || 0);
      setBackendConnected(true);

      // Count reviewed/unreviewed
      const allFiles = data.files || [];
      const reviewed = allFiles.filter((f: RawFile) => f.isReviewed).length;
      const unreviewed = allFiles.filter((f: RawFile) => !f.isReviewed).length;
      setReviewedCount(reviewed);
      setUnreviewedCount(unreviewed);

      return filteredFiles;
    } catch (err) {
      // Silently fail when backend is not running (development mode)
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        // Backend not running - this is expected in development
        setBackendConnected(false);
        return [];
      }
      console.error('Error fetching files:', err);
      setBackendConnected(false);
      return [];
    }
  }, [currentPage, itemsPerPage, viewMode]);

  // Fetch files when pagination changes
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, [selectedFiles]);

  const validateFiles = (fileList: File[]): File[] => {
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    fileList.forEach((file) => {
      if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpeg') || file.name.toLowerCase().endsWith('.jpg')) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Only JPEG files allowed. Invalid: ${invalidFiles.join(', ')}`);
    } else {
      setError(null);
    }

    return validFiles;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(Array.from(e.dataTransfer.files));
      setAllSelectedFiles(validFiles);
      // Only create previews for first MAX_PREVIEW_FILES files
      const previewFiles = validFiles.slice(0, MAX_PREVIEW_FILES);
      const previews = previewFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setSelectedFiles(previews);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(Array.from(e.target.files));
      setAllSelectedFiles(validFiles);
      // Only create previews for first MAX_PREVIEW_FILES files
      const previewFiles = validFiles.slice(0, MAX_PREVIEW_FILES);
      const previews = previewFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
      setSelectedFiles(previews);
    }
  };

  // Upload a single batch of files
  const uploadBatch = async (files: File[]): Promise<{ success: boolean; failedFiles: string[] }> => {
    const formData = new FormData();
    files.forEach((f) => {
      formData.append('files', f);
    });

    try {
      const response = await fetchWithAuth(`/files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return { success: true, failedFiles: [] };
    } catch (err) {
      console.error('Batch upload error:', err);
      return { success: false, failedFiles: files.map(f => f.name) };
    }
  };

  const handleUpload = async () => {
    if (allSelectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    uploadAbortRef.current = false;

    const totalFiles = allSelectedFiles.length;
    const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);

    // Initialize progress
    setUploadProgress({
      total: totalFiles,
      uploaded: 0,
      failed: 0,
      currentBatch: 0,
      totalBatches,
      failedFiles: [],
    });

    // Create batches
    const batches: File[][] = [];
    for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
      batches.push(allSelectedFiles.slice(i, i + BATCH_SIZE));
    }

    let uploadedCount = 0;
    let failedCount = 0;
    const allFailedFiles: string[] = [];

    // Process batches sequentially to maintain file order
    for (let i = 0; i < batches.length; i++) {
      if (uploadAbortRef.current) break;

      const batch = batches[i];
      const result = await uploadBatch(batch);

      if (result.success) {
        uploadedCount += batch.length;
      } else {
        failedCount += batch.length;
        allFailedFiles.push(...result.failedFiles);
      }

      setUploadProgress(prev => prev ? {
        ...prev,
        uploaded: uploadedCount,
        failed: failedCount,
        currentBatch: i + 1,
        failedFiles: allFailedFiles,
      } : null);
    }

    // Cleanup
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    setAllSelectedFiles([]);

    // Show final status
    if (failedCount > 0) {
      setError(`Upload completed with ${failedCount} failed files. Successfully uploaded ${uploadedCount} files.`);
    }

    // Keep progress visible for a moment before closing
    setTimeout(() => {
      setShowUploadModal(false);
      setUploadProgress(null);
      setUploading(false);
      fetchFiles();
    }, failedCount > 0 ? 3000 : 1000);
  };

  const handleCancelUpload = () => {
    uploadAbortRef.current = true;
    setError('Upload cancelled by user.');
  };

  const handleCloseUploadModal = () => {
    if (uploading) return; // Don't close while uploading
    // Cleanup previews
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
    setAllSelectedFiles([]);
    setUploadProgress(null);
    setShowUploadModal(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchWithAuth(`/files/${id}`, { method: 'DELETE' });
      fetchFiles();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleToggleReviewed = async (id: number, currentStatus: boolean) => {
    try {
      await fetchWithAuth(`/files/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReviewed: !currentStatus }),
      });
      fetchFiles();
    } catch (err) {
      console.error('Error updating review status:', err);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm(`Delete all ${totalFiles} files? This action cannot be undone.`)) return;

    setRemoving(true);
    try {
      await fetchWithAuth(`/files/clear`, { method: 'POST' });
      fetchFiles();
    } catch (err) {
      console.error('Error removing:', err);
      setError('Failed to remove files');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <StageBadge
            stageNumber="00"
            title="Stage 00: Upload Images"
            description="Upload raw document images to the system"
          />

          {error && (
            <Alert variant="danger" className="mb-6" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {!backendConnected && (
            <Alert variant="warning" className="mb-6">
              Backend server is not running. Start backend with: <code className="bg-black/20 px-2 py-0.5 rounded font-mono text-sm">cd ../backend && npm run dev</code>
            </Alert>
          )}

          {/* Status Card */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Storage Overview</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <BlurFade delay={0.1} inView>
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                  <span className="block text-accent-foreground text-sm font-medium mb-2">Total Images</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={totalFiles} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-text-secondary mt-2">
                    Showing {files.length} of {totalFiles} files
                  </span>
                </div>
              </BlurFade>
              <BlurFade delay={0.15} inView>
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 rounded-xl border border-emerald-500/20">
                  <span className="block text-emerald-400 text-sm font-medium mb-2">Reviewed</span>
                  <span className="block text-4xl font-bold text-text-primary">
                    <NumberTicker value={reviewedCount} className="text-text-primary" />
                  </span>
                  <span className="block text-xs text-emerald-400/70 mt-2">
                    Files marked as reviewed
                  </span>
                </div>
              </BlurFade>
              <BlurFade delay={0.2} inView>
                <div className={`bg-gradient-to-br p-5 rounded-xl border ${
                  unreviewedCount === 0
                    ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
                    : 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
                }`}>
                  <span className={`block text-sm font-medium mb-2 ${
                    unreviewedCount === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>Unreviewed</span>
                  <div className="flex items-center gap-2.5 text-xl font-semibold my-2">
                    {unreviewedCount === 0 ? (
                      <><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> <span className="text-text-primary">All Done</span></>
                    ) : (
                      <><span className="w-3 h-3 bg-amber-500 rounded-full"></span> <span className="text-text-primary">{unreviewedCount}</span></>
                    )}
                  </div>
                  <span className={`block text-xs mt-2 ${
                    unreviewedCount === 0 ? 'text-emerald-400/70' : 'text-amber-400/70'
                  }`}>
                    {unreviewedCount === 0
                      ? 'All files reviewed!'
                      : `${unreviewedCount} files need review`}
                  </span>
                </div>
              </BlurFade>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6 flex-wrap items-center">
            <Button onClick={() => setShowUploadModal(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Images
            </Button>

            {totalFiles > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  // Start review from first file
                  const firstFile = files[0];
                  if (firstFile) {
                    window.location.href = `/stages/00-upload/review/${firstFile.id}`;
                  }
                }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Start Review
              </Button>
            )}

            {/* View Mode Toggle */}
            {totalFiles > 0 && (
              <div className="flex bg-card-bg/80 backdrop-blur-sm rounded-xl p-1 border border-border-color/50">
                <button
                  onClick={() => {
                    setViewMode('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'all'
                      ? 'bg-gradient-to-r from-[#3b82f6] to-purple-600 text-white shadow-md'
                      : 'text-text-primary bg-card-bg/50 hover:text-text-primary hover:bg-[#3b82f6]/10 border border-transparent'
                  }`}
                >
                  All Files
                </button>
                <button
                  onClick={() => {
                    setViewMode('unreviewed');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'unreviewed'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-text-primary bg-card-bg/50 hover:text-text-primary hover:bg-amber-500/10 border border-transparent'
                  }`}
                >
                  Unreviewed ({unreviewedCount})
                </button>
              </div>
            )}

            {totalFiles > 0 && (
              <Button
                variant="danger"
                onClick={handleRemoveAll}
                disabled={removing}
              >
                Remove All
              </Button>
            )}
          </div>

          {/* Upload Modal */}
          <Modal
            isOpen={showUploadModal}
            onClose={handleCloseUploadModal}
            size="lg"
            closeOnOverlay={!uploading}
            closeOnEscape={!uploading}
          >
            <ModalHeader>
              <ModalTitle>Upload Images</ModalTitle>
            </ModalHeader>
            <ModalBody className="max-h-[calc(90vh-150px)] overflow-y-auto">
              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 cursor-pointer ${
                  dragActive ? 'border-accent bg-accent-light' : 'border-border-color'
                } hover:border-accent`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept=".jpeg,.jpg,image/jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="fileInput"
                />
                <label htmlFor="fileInput" className="flex flex-col items-center gap-2 cursor-pointer text-text-secondary">
                  <span className="text-[2rem] mb-2">📁</span>
                  {dragActive ? 'Drop JPEG files here...' : 'Drag & drop JPEG files here or click to select'}
                  <span className="text-[0.85rem] text-text-secondary opacity-70">Only .jpeg/.jpg files are accepted</span>
                </label>
              </div>

              {allSelectedFiles.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border-color">
                  <h3 className="m-0 mb-4 text-base font-semibold">Selected ({allSelectedFiles.length} files)</h3>

                  {/* Preview grid */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3 mb-4">
                    {selectedFiles.map((f, idx) => (
                      <div key={idx} className="text-center">
                        <img src={f.preview} alt={f.file.name} className="w-full h-16 object-cover rounded-md mb-1" />
                        <span className="block text-xs text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">{f.file.name}</span>
                      </div>
                    ))}
                    {allSelectedFiles.length > MAX_PREVIEW_FILES && (
                      <div className="flex items-center justify-center h-16 bg-accent-light rounded-md text-accent font-semibold">
                        +{allSelectedFiles.length - MAX_PREVIEW_FILES} more
                      </div>
                    )}
                  </div>

                  {/* Upload progress */}
                  {uploadProgress && (
                    <div className="mb-4 p-4 bg-accent-light rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-text-primary">
                          Uploading... {uploadProgress.uploaded + uploadProgress.failed}/{uploadProgress.total}
                        </span>
                        <span className="text-sm text-text-secondary">
                          File {uploadProgress.currentBatch}/{uploadProgress.totalBatches}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-border-color rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-300 ease-out"
                          style={{
                            width: `${((uploadProgress.uploaded + uploadProgress.failed) / uploadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-xs text-text-secondary">
                        <span className="text-success">✓ {uploadProgress.uploaded} uploaded</span>
                        {uploadProgress.failed > 0 && (
                          <span className="text-danger">✗ {uploadProgress.failed} failed</span>
                        )}
                        <span>{Math.round(((uploadProgress.uploaded + uploadProgress.failed) / uploadProgress.total) * 100)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      fullWidth
                      size="lg"
                      isLoading={uploading}
                    >
                      {uploading
                        ? `Uploading ${uploadProgress ? `${uploadProgress.uploaded}/${uploadProgress.total}` : '...'}`
                        : `Upload ${allSelectedFiles.length} files`}
                    </Button>
                    {uploading && (
                      <Button
                        variant="danger"
                        onClick={handleCancelUpload}
                        size="lg"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>

                  {/* File size summary */}
                  {!uploading && (
                    <p className="mt-3 text-xs text-text-secondary">
                      Total size: {(allSelectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                      <span className="ml-2 text-accent">• Uploading one file at a time for reliability</span>
                    </p>
                  )}
                </div>
              )}
            </ModalBody>
          </Modal>

          {/* Files Table */}
          {totalFiles > 0 && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="m-0 text-lg font-semibold text-text-primary">
                    Uploaded Files ({totalFiles} total)
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary font-medium">
                    Per page:
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(parseInt(e.target.value, 10));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-border-color/50 bg-bg-secondary text-text-primary rounded-lg text-sm cursor-pointer transition-all duration-200 hover:border-accent/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border-color/50 mb-4">
                <table className="w-full border-collapse bg-bg-secondary/50">
                  <thead className="bg-gradient-to-r from-accent/10 to-accent/5 border-b border-border-color/50">
                    <tr>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">#</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">Preview</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">File Name</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">Status</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">Created</th>
                      <th className="p-4 text-left font-semibold text-text-primary text-sm whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-text-secondary">
                          {viewMode === 'unreviewed'
                            ? '🎉 All files have been reviewed!'
                            : 'No files found'}
                        </td>
                      </tr>
                    ) : (
                      files.map((file) => (
                        <tr key={file.id} className="border-b border-border-color/30 transition-colors duration-200 last:border-b-0 hover:bg-accent/5">
                          <td className="p-4 text-text-primary text-sm font-bold font-mono">#{file.fileNumber}</td>
                          <td className="p-4 text-sm">
                            <img
                              src={`${API_URL}/files/${file.id}/preview`}
                              alt={file.originalName}
                              className="w-[100px] h-[100px] object-cover rounded-lg border border-border-color/50 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-accent/50"
                              onClick={() => setPreviewFile(file)}
                              title="Click to view full image"
                            />
                          </td>
                          <td className="p-4 text-text-primary text-sm max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">{file.originalName}</td>
                          <td className="p-4 text-sm">
                            {file.isReviewed ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-semibold whitespace-nowrap">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                Reviewed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-semibold whitespace-nowrap">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                                Unreviewed
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-text-secondary text-xs whitespace-nowrap">
                            {new Date(file.createdAt).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-4 text-sm">
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => window.location.href = `/stages/00-upload/review/${file.id}`}
                                title="Review this file (fullscreen)"
                              >
                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Review
                              </Button>
                              <Button
                                size="sm"
                                variant={file.isReviewed ? 'secondary' : 'primary'}
                                onClick={() => handleToggleReviewed(file.id, file.isReviewed)}
                                title={file.isReviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
                              >
                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={file.isReviewed ? "M6 18L18 6M6 6l12 12" : "M5 13l4 4L19 7"} />
                                </svg>
                                {file.isReviewed ? 'Unmark' : 'Mark'}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  if (confirm(`Delete ${file.originalName}?`)) {
                                    handleDelete(file.id);
                                  }
                                }}
                                title="Delete file"
                              >
                                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalFiles}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  showItemsPerPage={false}
                  className="justify-center py-4"
                />
              )}
            </div>
          )}

          {/* Image Preview Modal */}
          {previewFile && (
            <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/90 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
              <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-card-bg/95 backdrop-blur-xl px-6 py-4 rounded-t-2xl border-b border-border-color/50 flex items-center justify-between">
                  <div>
                    <h3 className="m-0 text-lg font-semibold text-text-primary">{previewFile.originalName}</h3>
                    <p className="m-0 mt-1 text-sm text-text-secondary">
                      File #{previewFile.fileNumber} • Created: {new Date(previewFile.createdAt).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    className="w-10 h-10 rounded-xl bg-card-bg border border-border-color/50 flex items-center justify-center text-text-secondary cursor-pointer transition-all duration-200 hover:bg-accent/10 hover:border-accent/50 hover:text-text-primary"
                    onClick={() => setPreviewFile(null)}
                    title="Close preview"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Image */}
                <div className="bg-[#1a1b26] rounded-b-2xl p-6 flex items-center justify-center">
                  <img
                    src={`${API_URL}/files/${previewFile.id}/preview`}
                    alt={previewFile.originalName}
                    className="max-w-full max-h-[calc(90vh-120px)] object-contain rounded-lg shadow-2xl"
                  />
                </div>

                {/* Actions */}
                <div className="absolute bottom-6 right-6 flex gap-3">
                  <Button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `${API_URL}/files/${previewFile.id}/preview`;
                      link.download = previewFile.originalName;
                      link.click();
                    }}
                    title="Download image"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete ${previewFile.originalName}?`)) {
                        handleDelete(previewFile.id);
                        setPreviewFile(null);
                      }
                    }}
                    title="Delete file"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
