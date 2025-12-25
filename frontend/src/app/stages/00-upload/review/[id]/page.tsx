'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
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
  hasEdited: boolean;
  editedPath: string | null;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

// Memoized File Item Component (prevent re-render)
const FileItem = React.memo(function FileItem({
  file,
  idx,
  isActive,
  sidebarCollapsed,
  onSelect,
}: {
  file: RawFile;
  idx: number;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-all border-l-4
        ${isActive
          ? 'bg-accent/10 border-accent'
          : file.isReviewed
            ? 'border-emerald-500/50 hover:bg-emerald-500/5'
            : 'border-transparent hover:bg-accent/5'}
      `}
    >
      {/* Thumbnail */}
      {!sidebarCollapsed && (
        <div className="relative flex-shrink-0">
          <img
            src={`${API_URL}/files/${file.id}/preview`}
            alt={file.originalName}
            className="w-10 h-10 object-cover rounded border border-border-color/50"
            loading="lazy"
          />
          {file.isReviewed && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      )}

      {!sidebarCollapsed && (
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-text-primary truncate">#{file.fileNumber}</div>
          <div className="text-[0.65rem] text-text-secondary truncate leading-tight">{file.originalName}</div>
        </div>
      )}

      {sidebarCollapsed && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          isActive ? 'bg-accent text-white' : file.isReviewed ? 'bg-emerald-500 text-white' : 'bg-border-color text-text-secondary'
        }`}>
          {idx + 1}
        </div>
      )}
    </div>
  );
});

export default function ReviewFilePage() {
  const params = useParams();
  const router = useRouter();
  const fileId = parseInt(params.id as string, 10);

  // Initialize with sessionStorage cache (synchronous)
  const [allFiles, setAllFiles] = useState<RawFile[]>(() => {
    try {
      const cached = sessionStorage.getItem('stage00-review-files');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const cached = sessionStorage.getItem('stage00-review-files');
      if (cached) {
        const files = JSON.parse(cached) as RawFile[];
        return files.findIndex(f => f.id === fileId);
      }
    } catch {}
    return -1;
  });

  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Drawing state (default ON)
  const [drawingMode, setDrawingMode] = useState(true); // Default drawing mode ON
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(200); // Default 200px (max size)
  const [brushOpacity, setBrushOpacity] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedDrawing, setHasUnsavedDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageCacheBuster, setImageCacheBuster] = useState(Date.now()); // Force image reload

  // No loading state if cache exists
  const [initialLoading, setInitialLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('stage00-review-files');
      return !cached; // loading only if no cache
    } catch {
      return true;
    }
  });

  // Get current file from allFiles (no loading state needed)
  const file = allFiles.length > 0 && currentIndex >= 0 ? allFiles[currentIndex] : null;

  // Virtualization: render only visible range (±50 items from current)
  const RENDER_BUFFER = 50;
  const visibleFiles = React.useMemo(() => {
    if (allFiles.length === 0) return [];

    const start = Math.max(0, currentIndex - RENDER_BUFFER);
    const end = Math.min(allFiles.length, currentIndex + RENDER_BUFFER + 1);

    return allFiles.slice(start, end).map((f, sliceIdx) => ({
      file: f,
      originalIdx: start + sliceIdx,
    }));
  }, [allFiles, currentIndex]);

  // Fetch all files (with sessionStorage cache)
  const fetchAllFiles = async () => {
    try {
      // Fetch from API
      const res = await fetchWithAuth(`/files?limit=10000&sortBy=createdAt&sortOrder=ASC`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      const files = data.files || [];
      setAllFiles(files);

      // Cache in sessionStorage
      sessionStorage.setItem('stage00-review-files', JSON.stringify(files));

      // Find current index from URL
      const index = files.findIndex((f: RawFile) => f.id === fileId);
      setCurrentIndex(index);

      if (index === -1 && files.length > 0) {
        setError(`File ID ${fileId} not found in list`);
      }

      setInitialLoading(false);
      return files;
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(`Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setInitialLoading(false);
      return [];
    }
  };

  // Fetch all files on mount only (if not already loaded from cache)
  useEffect(() => {
    // Only fetch if allFiles is empty (not from cache)
    if (allFiles.length === 0) {
      fetchAllFiles();
    } else {
      // Already loaded from cache, just mark as ready
      setInitialLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Navigate to next file (instant - no router.push)
  const goToNext = useCallback(() => {
    if (currentIndex < allFiles.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextFile = allFiles[nextIndex];
      setCurrentIndex(nextIndex);
      // Update URL without navigation (History API)
      window.history.replaceState(null, '', `/stages/00-upload/review/${nextFile.id}`);
    }
  }, [currentIndex, allFiles]);

  // Navigate to previous file (instant - no router.push)
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevFile = allFiles[prevIndex];
      setCurrentIndex(prevIndex);
      // Update URL without navigation (History API)
      window.history.replaceState(null, '', `/stages/00-upload/review/${prevFile.id}`);
    }
  }, [currentIndex, allFiles]);

  // Go to next unreviewed file (instant - no router.push)
  const goToNextUnreviewed = useCallback(() => {
    const nextUnreviewedIndex = allFiles.findIndex((f, idx) => idx > currentIndex && !f.isReviewed);
    if (nextUnreviewedIndex !== -1) {
      const nextFile = allFiles[nextUnreviewedIndex];
      setCurrentIndex(nextUnreviewedIndex);
      // Update URL without navigation (History API)
      window.history.replaceState(null, '', `/stages/00-upload/review/${nextFile.id}`);
    }
  }, [currentIndex, allFiles]);

  // Save edited image (silent mode for auto-save)
  const saveEditedImageFunc = useCallback(async (silent = false) => {
    if (!file || !canvasRef.current || !imageRef.current) return;

    // Check if canvas has any content
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const hasContent = imageData.data.some(v => v !== 0);

    if (!hasContent) {
      // Canvas is empty, skip saving
      setHasUnsavedDrawing(false);
      return;
    }

    setSaving(true);
    try {
      // Create composite canvas
      const composite = document.createElement('canvas');
      composite.width = imageRef.current.naturalWidth;
      composite.height = imageRef.current.naturalHeight;
      const compositeCtx = composite.getContext('2d');
      if (!compositeCtx) throw new Error('Canvas context not available');

      // Draw original image
      compositeCtx.drawImage(imageRef.current, 0, 0);

      // Draw canvas overlay on top
      compositeCtx.drawImage(canvasRef.current, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        composite.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.95);
      });

      // Upload to backend
      const formData = new FormData();
      formData.append('file', blob, `${file.fileNumber}.jpeg`); // No _temp suffix
      formData.append('fileId', file.id.toString());

      const res = await fetchWithAuth(`/files/${file.id}/save-edited`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setHasUnsavedDrawing(false);

      // Update file in allFiles to mark as hasEdited
      const editedPath = `raw_temp/${file.fileNumber}.jpeg`;
      setAllFiles(prev => {
        const updated = prev.map(f => f.id === file.id ? { ...f, hasEdited: true, editedPath } : f);
        sessionStorage.setItem('stage00-review-files', JSON.stringify(updated));
        return updated;
      });

      // Force image reload (clear browser cache)
      setImageCacheBuster(Date.now());

      if (!silent) {
        alert('Saved successfully!');
      }
    } catch (err) {
      console.error('Error saving edited image:', err);
      if (!silent) {
        alert('Failed to save edited image');
      }
    } finally {
      setSaving(false);
    }
  }, [file]);

  // Toggle review status (auto-save if in drawing mode)
  const handleToggleReview = useCallback(async () => {
    if (!file) return;

    try {
      // If in drawing mode and has changes, save temp image first (silent)
      if (drawingMode && hasUnsavedDrawing) {
        await saveEditedImageFunc(true); // silent = true
      }

      // Mark as reviewed
      await fetchWithAuth(`/files/${file.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReviewed: true }), // Always mark as reviewed
      });

      // Update in allFiles
      setAllFiles(prev => {
        const updated = prev.map(f => f.id === file.id ? { ...f, isReviewed: true, reviewedAt: new Date().toISOString() } : f);
        // Update cache
        sessionStorage.setItem('stage00-review-files', JSON.stringify(updated));
        return updated;
      });

      // Auto go to next unreviewed (keep drawing mode on)
      setTimeout(() => {
        goToNextUnreviewed();
      }, 100);
    } catch (err) {
      console.error('Error toggling review:', err);
    }
  }, [file, drawingMode, hasUnsavedDrawing, saveEditedImageFunc, goToNextUnreviewed]);

  // Go back to list
  const goBack = useCallback(() => {
    // Clear cache when going back
    sessionStorage.removeItem('stage00-review-files');
    router.push('/stages/00-upload');
  }, [router]);

  // Select file from sidebar (instant - no router.push)
  const selectFile = useCallback((id: number) => {
    const idx = allFiles.findIndex(f => f.id === id);
    if (idx !== -1) {
      setCurrentIndex(idx);
      // Update URL without navigation (History API)
      window.history.replaceState(null, '', `/stages/00-upload/review/${id}`);
    }
  }, [allFiles]);

  // Initialize canvas when image loads or file changes
  useEffect(() => {
    if (!drawingMode) return;

    // Wait for image to load
    const initCanvas = () => {
      if (!imageRef.current || !canvasRef.current) return;

      const img = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match image natural dimensions
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Clear canvas (reset for new image)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Initialize history for this image
      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasHistory([initialState]);
      setHistoryIndex(0);
      setHasUnsavedDrawing(false);
    };

    // Wait for image to load
    if (imageRef.current?.complete) {
      initCanvas();
    } else {
      imageRef.current?.addEventListener('load', initCanvas);
      return () => imageRef.current?.removeEventListener('load', initCanvas);
    }
  }, [file?.id, drawingMode]);

  // Update cursor style when brush size or tool changes
  useEffect(() => {
    if (!cursorRef.current) return;

    const color = currentTool === 'brush' ? '#3b82f6' : '#ef4444';
    const bgColor = currentTool === 'brush' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    cursorRef.current.style.border = `2px solid ${color}`;
    cursorRef.current.style.backgroundColor = bgColor;

    // Update center dot color
    const centerDot = cursorRef.current.querySelector('div');
    if (centerDot instanceof HTMLElement) {
      centerDot.style.backgroundColor = color;
    }
  }, [brushSize, currentTool]);

  // Canvas drawing logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Update cursor position using direct DOM
    if (cursorRef.current && imageRef.current) {
      const img = imageRef.current;
      const imgRect = img.getBoundingClientRect();
      const displayScale = imgRect.width / img.naturalWidth;
      const scaledBrushSize = brushSize * displayScale;

      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
      cursorRef.current.style.width = `${scaledBrushSize}px`;
      cursorRef.current.style.height = `${scaledBrushSize}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    if (currentTool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255, 255, 255, ${brushOpacity / 100})`;
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Update cursor position using direct DOM manipulation (no re-render)
    if (cursorRef.current && imageRef.current) {
      const img = imageRef.current;
      const imgRect = img.getBoundingClientRect();

      // Calculate scale (display size vs natural size)
      const displayScale = imgRect.width / img.naturalWidth;
      const scaledBrushSize = brushSize * displayScale;

      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
      cursorRef.current.style.width = `${scaledBrushSize}px`;
      cursorRef.current.style.height = `${scaledBrushSize}px`;
      cursorRef.current.style.display = 'block';
    }

    if (!isDrawing) return;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseEnter = () => {
    if (cursorRef.current) {
      cursorRef.current.style.display = 'block';
    }
  };

  const handleMouseLeave = () => {
    if (cursorRef.current) {
      cursorRef.current.style.display = 'none';
    }
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    setIsDrawing(false);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Update final cursor position if event provided
    if (e && cursorRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const img = imageRef.current;
      const imgRect = img.getBoundingClientRect();
      const displayScale = imgRect.width / img.naturalWidth;
      const scaledBrushSize = brushSize * displayScale;

      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
      cursorRef.current.style.width = `${scaledBrushSize}px`;
      cursorRef.current.style.height = `${scaledBrushSize}px`;
    }

    // Save to history
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedDrawing(true);
  };

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const newIndex = historyIndex - 1;
      ctx.putImageData(canvasHistory[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, canvasHistory]);

  const redo = useCallback(() => {
    if (historyIndex < canvasHistory.length - 1 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const newIndex = historyIndex + 1;
      ctx.putImageData(canvasHistory[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, canvasHistory]);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Save to history
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasUnsavedDrawing(true);
  }, [canvasHistory, historyIndex]);

  // Reset to original image (delete edited version)
  const resetToOriginal = useCallback(async () => {
    if (!file) return;
    if (!confirm('Reset to original image? This will delete the edited version.')) return;

    try {
      const res = await fetchWithAuth(`/files/${file.id}/reset-edited`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Update file in allFiles
      setAllFiles(prev => {
        const updated = prev.map(f => f.id === file.id ? { ...f, hasEdited: false, editedPath: null } : f);
        sessionStorage.setItem('stage00-review-files', JSON.stringify(updated));
        return updated;
      });

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      setHasUnsavedDrawing(false);

      // Force image reload
      setImageCacheBuster(Date.now());

      alert('Reset to original image successfully!');
    } catch (err) {
      console.error('Error resetting image:', err);
      alert('Failed to reset image');
    }
  }, [file]);

  // Save edited image (silent mode for auto-save)
  const saveEditedImage = useCallback(async (silent = false) => {
    if (!file || !canvasRef.current || !imageRef.current) return;

    // Check if canvas has any content
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const hasContent = imageData.data.some(v => v !== 0);

    if (!hasContent) {
      // Canvas is empty, skip saving
      setHasUnsavedDrawing(false);
      return;
    }

    setSaving(true);
    try {
      // Create composite canvas
      const composite = document.createElement('canvas');
      composite.width = imageRef.current.naturalWidth;
      composite.height = imageRef.current.naturalHeight;
      const compositeCtx = composite.getContext('2d');
      if (!compositeCtx) throw new Error('Canvas context not available');

      // Draw original image
      compositeCtx.drawImage(imageRef.current, 0, 0);

      // Draw canvas overlay on top
      compositeCtx.drawImage(canvasRef.current, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        composite.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.95);
      });

      // Upload to backend
      const formData = new FormData();
      formData.append('file', blob, `${file.fileNumber}_temp.jpeg`);
      formData.append('fileId', file.id.toString());

      const res = await fetchWithAuth(`/files/${file.id}/save-edited`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setHasUnsavedDrawing(false);

      if (!silent) {
        alert('Saved successfully!');
      }
    } catch (err) {
      console.error('Error saving edited image:', err);
      if (!silent) {
        alert('Failed to save edited image');
      }
    } finally {
      setSaving(false);
    }
  }, [file]);

  // Auto-scroll to current item in sidebar (instant scroll for better UX)
  useEffect(() => {
    if (sidebarScrollRef.current && currentIndex >= 0) {
      const itemHeight = 50; // height of each item
      const containerHeight = sidebarScrollRef.current.clientHeight;
      const scrollTop = currentIndex * itemHeight - (containerHeight / 2) + (itemHeight / 2); // center it

      sidebarScrollRef.current.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'auto', // instant scroll (no animation for better performance)
      });
    }
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Drawing mode shortcuts
      if (drawingMode) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          setCurrentTool('brush');
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setCurrentTool('eraser');
        } else if (e.key === '[') {
          e.preventDefault();
          setBrushSize(prev => Math.max(1, prev - 5));
        } else if (e.key === ']') {
          e.preventDefault();
          setBrushSize(prev => Math.min(200, prev + 5));
        } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleToggleReview(); // Save + Mark + Next
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (hasUnsavedDrawing) {
            if (confirm('You have unsaved changes. Exit drawing mode?')) {
              setDrawingMode(false);
            }
          } else {
            setDrawingMode(false);
          }
        }
        return;
      }

      // Normal mode shortcuts
      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleToggleReview();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          goToNextUnreviewed();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setDrawingMode(true);
          break;
        case 'Escape':
          e.preventDefault();
          goBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingMode, handleToggleReview, goToNext, goToPrevious, goToNextUnreviewed, goBack, hasUnsavedDrawing, undo, redo, saveEditedImageFunc]);

  // Show loading only on initial mount
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
          <div className="text-text-primary">Loading files...</div>
        </div>
      </div>
    );
  }

  // Show error if failed to load or file not found
  if (error || allFiles.length === 0 || !file) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger mb-4">{error || allFiles.length === 0 ? 'No files found in database' : 'File not found'}</p>
          <Button onClick={goBack}>Back to List</Button>
        </div>
      </div>
    );
  }

  const reviewedCount = allFiles.filter(f => f.isReviewed).length;
  const unreviewedCount = allFiles.filter(f => !f.isReviewed).length;
  const progress = allFiles.length > 0 ? (reviewedCount / allFiles.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-bg-primary flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-card-bg border-b border-border-color px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors text-text-secondary hover:text-text-primary"
            title="Back to list (ESC)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          <div className="h-5 w-px bg-border-color"></div>
          <div className="text-sm">
            <span className="text-text-secondary">Image Review</span>
            <span className="mx-2 text-text-secondary/50">•</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{currentIndex + 1}/{allFiles.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-sm text-text-secondary">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{reviewedCount}</span>
              <span className="mx-1">/</span>
              <span>{allFiles.length}</span>
              <span className="ml-2 text-text-secondary/70">reviewed</span>
            </div>
            <div className="w-32 h-1.5 bg-border-color/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(progress)}%</span>
          </div>

          <button
            onClick={goToNextUnreviewed}
            disabled={unreviewedCount === 0}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            title="Next Incomplete (N)"
          >
            <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Next Unreviewed
          </button>
        </div>
      </div>

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - File List */}
        <div
          className={`bg-card-bg border-r border-border-color transition-all duration-300 flex flex-col ${
            sidebarCollapsed ? 'w-14' : 'w-56'
          }`}
        >
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-border-color flex items-center justify-between flex-shrink-0">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="font-semibold text-sm text-text-primary">FILES</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors text-text-secondary"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
              </svg>
            </button>
          </div>

          {/* File List - Virtualized */}
          <div className="flex-1 overflow-y-auto" ref={sidebarScrollRef}>
            {/* Top spacer (for scroll position) */}
            {visibleFiles.length > 0 && visibleFiles[0].originalIdx > 0 && (
              <div style={{ height: `${visibleFiles[0].originalIdx * 50}px` }} />
            )}

            {/* Render visible range only (±50 items) */}
            {visibleFiles.map(({ file: f, originalIdx }) => (
              <FileItem
                key={f.id}
                file={f}
                idx={originalIdx}
                isActive={f.id === file?.id}
                sidebarCollapsed={sidebarCollapsed}
                onSelect={() => selectFile(f.id)}
              />
            ))}

            {/* Bottom spacer (for scroll position) */}
            {visibleFiles.length > 0 && visibleFiles[visibleFiles.length - 1].originalIdx < allFiles.length - 1 && (
              <div style={{ height: `${(allFiles.length - 1 - visibleFiles[visibleFiles.length - 1].originalIdx) * 50}px` }} />
            )}
          </div>

          {/* Sidebar Footer - Stats */}
          {!sidebarCollapsed && (
            <div className="px-3 py-2.5 border-t border-border-color bg-bg-secondary/50">
              <div className="text-[0.65rem] text-text-secondary mb-1">Progress</div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1 bg-border-color/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[0.65rem] font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(progress)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[0.65rem]">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span className="text-text-secondary">{reviewedCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  <span className="text-text-secondary">{unreviewedCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER - Image Preview with Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1a1b26] relative overflow-hidden p-4">
          {/* Image Container with Canvas Overlay */}
          <div className="relative max-w-full max-h-full">
            {/* Original Image */}
            <img
              ref={imageRef}
              src={`${API_URL}/files/${file.id}/preview?t=${imageCacheBuster}`}
              alt={file.originalName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              crossOrigin="anonymous"
            />

            {/* Canvas Overlay (Drawing Layer) */}
            {drawingMode && (
              <>
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ cursor: 'none' }}
                />

                {/* Brush Cursor Preview - Optimized for Performance */}
                <div
                  ref={cursorRef}
                  className="absolute pointer-events-none rounded-full transition-none"
                  style={{
                    display: 'none',
                    transform: 'translate(-50%, -50%)',
                    border: `2px solid ${currentTool === 'brush' ? '#3b82f6' : '#ef4444'}`,
                    backgroundColor: currentTool === 'brush' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.5)`,
                  }}
                >
                  {/* Center dot */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 3,
                      height: 3,
                      backgroundColor: currentTool === 'brush' ? '#3b82f6' : '#ef4444',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Drawing Mode Indicator */}
          {drawingMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent backdrop-blur-sm rounded-lg border border-accent text-white text-sm font-semibold shadow-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Drawing Mode • {currentTool === 'brush' ? '🖌️ Brush' : '🧹 Eraser'}
              {hasUnsavedDrawing && <span className="text-yellow-300">*</span>}
            </div>
          )}

          {/* Position Indicator - Bottom only */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-card-bg/90 backdrop-blur-sm rounded-lg border border-border-color/50 text-sm font-medium text-text-primary shadow-lg">
            {currentIndex + 1} / {allFiles.length}
          </div>

          {/* Drawing Toolbar - Bottom Left */}
          {drawingMode && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-text-primary"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= canvasHistory.length - 1}
                className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-accent/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-text-primary"
                title="Redo (Ctrl+Y)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <button
                onClick={clearCanvas}
                className="px-3 py-2 bg-card-bg/90 backdrop-blur-sm border border-border-color/50 rounded-lg hover:bg-red-500/20 transition-all text-text-primary"
                title="Clear All"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - Info */}
        <div className="w-72 bg-card-bg border-l border-border-color flex flex-col overflow-hidden">
          {/* Current File Section */}
          <div className="px-4 py-3 border-b border-border-color">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">Current File</h3>
            <div className="space-y-2">
              <div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">File #{file.fileNumber}</div>
                <div className="text-sm text-text-primary mt-1 break-words">{file.originalName}</div>
              </div>
              <div className="text-xs text-text-secondary">
                <div>Size: {(file.size / 1024).toFixed(1)} KB</div>
                <div>Uploaded: {new Date(file.createdAt).toLocaleString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}</div>
              </div>
            </div>
          </div>

          {/* Review Status Section */}
          <div className="px-4 py-3 border-b border-border-color">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">Review Status</h3>
            {file.isReviewed ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-emerald-400">Reviewed</div>
                  {file.reviewedAt && (
                    <div className="text-xs text-emerald-400/70">
                      {new Date(file.reviewedAt).toLocaleString('th-TH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-400">Unreviewed</div>
                  <div className="text-xs text-amber-400/70">Needs review</div>
                </div>
              </div>
            )}
          </div>

          {/* Drawing Tools Section (show when drawing mode) */}
          {drawingMode && (
            <div className="px-4 py-3 border-b border-border-color">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">Drawing Tools</h3>

              {/* Tool Selector */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setCurrentTool('brush')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentTool === 'brush'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-bg-secondary border border-border-color/50 text-text-primary hover:border-accent/50'
                  }`}
                >
                  🖌️ Brush
                </button>
                <button
                  onClick={() => setCurrentTool('eraser')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentTool === 'eraser'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-bg-secondary border border-border-color/50 text-text-primary hover:border-accent/50'
                  }`}
                >
                  🧹 Eraser
                </button>
              </div>

              {/* Brush Size */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text-primary">Brush Size</label>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-border-color/50 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setBrushSize(20)} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">20</button>
                  <button onClick={() => setBrushSize(50)} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">50</button>
                  <button onClick={() => setBrushSize(100)} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">100</button>
                  <button onClick={() => setBrushSize(200)} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">200</button>
                </div>
              </div>

              {/* Opacity */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-text-primary">Opacity</label>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{brushOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                  className="w-full h-2 bg-border-color/50 rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => saveEditedImageFunc(false)}
                  disabled={!hasUnsavedDrawing || saving}
                  fullWidth
                  isLoading={saving}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {saving ? 'Saving...' : 'Save as _temp.jpeg'}
                </Button>
                <button
                  onClick={clearCanvas}
                  className="w-full px-4 py-2 border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                  Clear Canvas
                </button>

                {file.hasEdited && (
                  <button
                    onClick={resetToOriginal}
                    className="w-full px-4 py-2 border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset to Original
                  </button>
                )}

                <button
                  onClick={() => {
                    if (hasUnsavedDrawing && !confirm('Exit drawing mode? Unsaved changes will be lost.')) return;
                    setDrawingMode(false);
                  }}
                  className="w-full px-4 py-2 border border-border-color/50 bg-bg-secondary text-text-primary rounded-lg text-sm font-medium hover:bg-accent/10 transition-colors"
                >
                  Exit Drawing Mode
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions Section */}
          {!drawingMode && (
            <div className="px-4 py-3 border-b border-border-color">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">Quick Actions</h3>
              <div className="space-y-2">
              <Button
                onClick={handleToggleReview}
                fullWidth
                variant={file.isReviewed ? 'secondary' : 'primary'}
              >
                {file.isReviewed ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Unmark as Reviewed
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Reviewed
                  </>
                )}
              </Button>

              <button
                onClick={() => setDrawingMode(true)}
                className="w-full px-4 py-2.5 border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Image (Draw)
              </button>

              <button
                onClick={goToNextUnreviewed}
                disabled={unreviewedCount === 0}
                className="w-full px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Go to Unreviewed
              </button>

              <button
                onClick={() => {
                  if (confirm(`Delete ${file.originalName}?`)) {
                    // Handle delete and go to next
                    fetchWithAuth(`/files/${file.id}`, { method: 'DELETE' })
                      .then(() => {
                        if (currentIndex < allFiles.length - 1) {
                          goToNext();
                        } else if (currentIndex > 0) {
                          goToPrevious();
                        } else {
                          goBack();
                        }
                      });
                  }
                }}
                className="w-full px-4 py-2.5 border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete File
              </button>
            </div>
          </div>
          )}

          {/* Statistics Section */}
          <div className="px-4 py-3 bg-bg-secondary/30">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">Statistics</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{reviewedCount}</div>
                <div className="text-xs text-text-secondary">Reviewed</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{unreviewedCount}</div>
                <div className="text-xs text-text-secondary">Unreviewed</div>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="px-4 py-2.5 border-t border-border-color bg-bg-secondary/20">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1.5">Shortcuts</h3>
            <div className="space-y-1 text-xs">
              {drawingMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Brush</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">B</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Eraser</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">E</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Size</span>
                    <div className="flex gap-0.5">
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">[</kbd>
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">]</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Undo/Redo</span>
                    <div className="flex gap-0.5">
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">^Z</kbd>
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">^Y</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Save+Next</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">^S</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Mark+Next</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Exit</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">ESC</kbd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Mark</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Navigate</span>
                    <div className="flex gap-0.5">
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">←</kbd>
                      <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">→</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Draw</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">D</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Unreviewed</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">N</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-[0.7rem]">Back</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 rounded text-text-primary font-mono text-[0.65rem]">ESC</kbd>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
