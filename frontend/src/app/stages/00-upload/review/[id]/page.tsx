'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { fetchWithAuth } from '@/lib/api';
import { RawFile, TextElement, HistoryState, DrawMode } from './types';
import {
  TopBar,
  LeftSidebar,
  ModeIndicator,
  PositionIndicator,
  DrawingToolbar,
} from './components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

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

  // Mode state (mouse, brush, eraser)
  const [mode, setMode] = useState<DrawMode>('mouse'); // Default mouse mode
  const [brushSize, setBrushSize] = useState(200); // Default 200px (max size) - for UI display
  const brushSizeRef = useRef(200); // Actual brush size (no re-render)
  const [brushOpacity, setBrushOpacity] = useState(100);

  // Text tool state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [newTextInput, setNewTextInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(14); // Default 14px
  const [textColor, setTextColor] = useState('#ef4444'); // Red color
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Available colors for text (cycle through with 'r' key)
  const textColors = [
    '#ef4444', // Red
    '#f59e0b', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#a855f7', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#ffffff', // White
    '#000000', // Black
  ];
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null); // Temporary position during drag (no re-render)
  const editInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const brushSizeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());
  // Unified history for canvas + text (for undo/redo)
  const historyRef = useRef<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedDrawing, setHasUnsavedDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageCacheBuster, setImageCacheBuster] = useState(Date.now()); // Force image reload
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

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

    // Check if canvas has any content or text elements
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const hasCanvasContent = imageData.data.some(v => v !== 0);
    const hasTextContent = textElements.length > 0;

    if (!hasCanvasContent && !hasTextContent) {
      // Nothing to save
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

      // Draw canvas overlay on top (brush/eraser drawings)
      compositeCtx.drawImage(canvasRef.current, 0, 0);

      // Render text elements on top
      textElements.forEach(textEl => {
        const x = (textEl.x / 100) * composite.width;
        const y = (textEl.y / 100) * composite.height;

        // Scale font size based on canvas size
        const scaledFontSize = (textEl.fontSize / 1000) * composite.width;

        compositeCtx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        compositeCtx.fillStyle = textEl.color;
        compositeCtx.textAlign = 'center';
        compositeCtx.textBaseline = 'middle';

        // Add text shadow for better visibility
        compositeCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        compositeCtx.shadowBlur = 4;
        compositeCtx.shadowOffsetX = 2;
        compositeCtx.shadowOffsetY = 2;

        compositeCtx.fillText(textEl.text, x, y);

        // Reset shadow
        compositeCtx.shadowColor = 'transparent';
        compositeCtx.shadowBlur = 0;
        compositeCtx.shadowOffsetX = 0;
        compositeCtx.shadowOffsetY = 0;
      });

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
      // Clear text elements after saving (they're now baked into the image)
      setTextElements([]);
      setSelectedTextId(null);

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
  }, [file, textElements]);

  // Toggle review status (auto-save if has drawing changes)
  const handleToggleReview = useCallback(async () => {
    if (!file) return;

    try {
      // If has drawing/text changes, save temp image first (silent)
      if (hasUnsavedDrawing) {
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
  }, [file, hasUnsavedDrawing, saveEditedImageFunc, goToNextUnreviewed]);

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

      // Initialize unified history for this image (canvas + text)
      const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const initialState: HistoryState = {
        canvasData,
        textElements: [],
      };
      historyRef.current = [initialState];
      setHistoryIndex(0);
      setHasUnsavedDrawing(false);
      // Also clear text elements when changing image
      setTextElements([]);
    };

    // Wait for image to load
    if (imageRef.current?.complete) {
      initCanvas();
    } else {
      imageRef.current?.addEventListener('load', initCanvas);
      return () => imageRef.current?.removeEventListener('load', initCanvas);
    }
  }, [file?.id]);

  // Update cursor style when brush size or mode changes
  useEffect(() => {
    if (!cursorRef.current) return;

    const color = mode === 'brush' ? '#3b82f6' : '#ef4444';
    const bgColor = mode === 'brush' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    cursorRef.current.style.border = `2px solid ${color}`;
    cursorRef.current.style.backgroundColor = bgColor;

    // Update center dot color
    const centerDot = cursorRef.current.querySelector('div');
    if (centerDot instanceof HTMLElement) {
      centerDot.style.backgroundColor = color;
    }

    // Update cursor size (from state or ref)
    if (imageRef.current) {
      const img = imageRef.current;
      const imgRect = img.getBoundingClientRect();
      const displayScale = imgRect.width / img.naturalWidth;
      const scaledBrushSize = brushSizeRef.current * displayScale;
      cursorRef.current.style.width = `${scaledBrushSize}px`;
      cursorRef.current.style.height = `${scaledBrushSize}px`;
    }
  }, [brushSize, mode]);

  // Canvas drawing logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((mode !== 'brush' && mode !== 'eraser') || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Update cursor position using direct DOM (no getBoundingClientRect for img - use cached scale)
    if (cursorRef.current) {
      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSizeRef.current;

    if (mode === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255, 255, 255, ${brushOpacity / 100})`;
    } else if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Update cursor position only (size is updated by keyboard handler)
    if (cursorRef.current) {
      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
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
    if (e && cursorRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      cursorRef.current.style.left = `${e.clientX - rect.left}px`;
      cursorRef.current.style.top = `${e.clientY - rect.top}px`;
    }

    // Save to unified history (canvas + text)
    const canvasData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const state: HistoryState = {
      canvasData,
      textElements: JSON.parse(JSON.stringify(textElements)),
    };
    historyRef.current = historyRef.current.slice(0, historyIndex + 1);
    historyRef.current.push(state);
    setHistoryIndex(historyRef.current.length - 1);
    setHasUnsavedDrawing(true);
  };

  // Save current state to history (unified: canvas + text)
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const canvasData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const state: HistoryState = {
      canvasData,
      textElements: JSON.parse(JSON.stringify(textElements)), // Deep copy
    };

    // Truncate future history and add new state
    historyRef.current = historyRef.current.slice(0, historyIndex + 1);
    historyRef.current.push(state);
    setHistoryIndex(historyRef.current.length - 1);
    setHasUnsavedDrawing(true);
  }, [textElements, historyIndex]);

  // Undo (restore previous state: canvas + text)
  const undo = useCallback(() => {
    if (historyIndex > 0 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const newIndex = historyIndex - 1;
      const state = historyRef.current[newIndex];
      if (state) {
        if (state.canvasData) {
          ctx.putImageData(state.canvasData, 0, 0);
        }
        setTextElements(state.textElements);
        setHistoryIndex(newIndex);
      }
    }
  }, [historyIndex]);

  // Redo (restore next state: canvas + text)
  const redo = useCallback(() => {
    if (historyIndex < historyRef.current.length - 1 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const newIndex = historyIndex + 1;
      const state = historyRef.current[newIndex];
      if (state) {
        if (state.canvasData) {
          ctx.putImageData(state.canvasData, 0, 0);
        }
        setTextElements(state.textElements);
        setHistoryIndex(newIndex);
      }
    }
  }, [historyIndex]);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveToHistory();
  }, [saveToHistory]);

  // Text Tool Functions
  const addTextElement = useCallback(() => {
    if (!newTextInput.trim()) return;

    const newText: TextElement = {
      id: `text-${Date.now()}`,
      text: newTextInput.trim(),
      x: 50, // center
      y: 50, // center
      fontSize: textFontSize,
      color: textColor,
    };

    setTextElements(prev => [...prev, newText]);
    setNewTextInput('');
    setSelectedTextId(newText.id);
    setHasUnsavedDrawing(true);
  }, [newTextInput, textFontSize, textColor]);

  const deleteTextElement = useCallback((id: string) => {
    setTextElements(prev => {
      const updated = prev.filter(t => t.id !== id);
      // Save to history
      setTimeout(() => saveToHistory(), 0);
      return updated;
    });
    if (selectedTextId === id) setSelectedTextId(null);
    if (editingTextId === id) setEditingTextId(null);
  }, [selectedTextId, editingTextId, saveToHistory]);

  // Start editing text element
  const startEditingText = useCallback((id: string) => {
    const textEl = textElements.find(t => t.id === id);
    if (textEl) {
      setEditingTextId(id);
      setEditingTextValue(textEl.text);
      setSelectedTextId(id);
      // Focus input after render
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [textElements]);

  // Save edited text
  const saveEditingText = useCallback(() => {
    if (!editingTextId) return;

    const trimmedValue = editingTextValue.trim();
    const originalText = textElements.find(t => t.id === editingTextId)?.text || '';

    if (trimmedValue) {
      if (trimmedValue !== originalText) {
        setTextElements(prev => {
          const updated = prev.map(t =>
            t.id === editingTextId ? { ...t, text: trimmedValue } : t
          );
          // Save to history after state update
          setTimeout(() => saveToHistory(), 0);
          return updated;
        });
      }
    } else {
      // Delete if empty
      setTextElements(prev => {
        const updated = prev.filter(t => t.id !== editingTextId);
        if (originalText) {
          // Only save history if we're deleting existing text
          setTimeout(() => saveToHistory(), 0);
        }
        return updated;
      });
      if (selectedTextId === editingTextId) setSelectedTextId(null);
    }
    setEditingTextId(null);
    setEditingTextValue('');
  }, [editingTextId, editingTextValue, textElements, selectedTextId, saveToHistory]);

  // Cancel editing
  const cancelEditingText = useCallback(() => {
    if (editingTextId) {
      // If original text was empty, delete the element
      const originalText = textElements.find(t => t.id === editingTextId)?.text || '';
      if (!originalText) {
        setTextElements(prev => prev.filter(t => t.id !== editingTextId));
        if (selectedTextId === editingTextId) setSelectedTextId(null);
      }
    }
    setEditingTextId(null);
    setEditingTextValue('');
  }, [editingTextId, textElements, selectedTextId]);

  const handleTextMouseDown = useCallback((e: React.MouseEvent, textId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const textEl = textElements.find(t => t.id === textId);
    if (!textEl) return;

    // Calculate offset from text position to mouse position
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    setDragOffset({
      x: mouseX - textEl.x,
      y: mouseY - textEl.y,
    });

    setDraggingTextId(textId);
    setSelectedTextId(textId);
  }, [textElements]);

  const handleTextMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingTextId) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newX = ((e.clientX - rect.left) / rect.width) * 100 - dragOffset.x;
    const newY = ((e.clientY - rect.top) / rect.height) * 100 - dragOffset.y;

    // Clamp to container bounds
    const clampedX = Math.max(0, Math.min(100, newX));
    const clampedY = Math.max(0, Math.min(100, newY));

    // Store in ref (no re-render) for smooth dragging
    dragPositionRef.current = { x: clampedX, y: clampedY };

    // Update DOM directly for smooth performance
    const textEl = document.querySelector(`[data-text-id="${draggingTextId}"]`) as HTMLElement;
    if (textEl) {
      textEl.style.left = `${clampedX}%`;
      textEl.style.top = `${clampedY}%`;
    }
  }, [draggingTextId, dragOffset]);

  const handleTextMouseUp = useCallback(() => {
    if (draggingTextId && dragPositionRef.current) {
      const finalPos = dragPositionRef.current;

      // Update state with final position
      setTextElements(prev =>
        prev.map(t =>
          t.id === draggingTextId
            ? { ...t, x: finalPos.x, y: finalPos.y }
            : t
        )
      );

      // Save to history after drag
      setTimeout(() => saveToHistory(), 0);

      // Clear drag position ref
      dragPositionRef.current = null;
    }
    setDraggingTextId(null);
  }, [draggingTextId, saveToHistory]);

  // Track mouse position on image container (throttled to reduce lag)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const handleImageContainerMouseMove = useCallback((e: React.MouseEvent) => {
    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Store in ref (no re-render) for T key shortcut
    lastMousePosRef.current = { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };

    // Handle text dragging
    handleTextMouseMove(e);
  }, [handleTextMouseMove]);

  const handleImageContainerMouseLeave = useCallback(() => {
    lastMousePosRef.current = null;
    handleTextMouseUp();
  }, [handleTextMouseUp]);

  // Add text at specific position with pre-filled text
  const addTextAtPosition = useCallback((x: number, y: number, prefillText: string = '') => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      text: prefillText,
      x,
      y,
      fontSize: textFontSize,
      color: textColor,
    };

    setTextElements(prev => [...prev, newText]);
    setSelectedTextId(newText.id);

    if (prefillText) {
      // If pre-filled, don't auto-edit (just add the text)
      // Save to history
      setTimeout(() => saveToHistory(), 0);
    } else {
      // If empty, auto-start editing
      setEditingTextId(newText.id);
      setEditingTextValue('');
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 10);
    }
  }, [textFontSize, textColor, saveToHistory]);

  // Render text elements to canvas before saving
  const renderTextToCanvas = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    textElements.forEach(textEl => {
      const x = (textEl.x / 100) * canvas.width;
      const y = (textEl.y / 100) * canvas.height;

      // Scale font size based on canvas size (assuming base is 1000px width)
      const scaledFontSize = (textEl.fontSize / 1000) * canvas.width;

      ctx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
      ctx.fillStyle = textEl.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Add text shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(textEl.text, x, y);

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    });
  }, [textElements]);

  // Clear text elements when file changes
  useEffect(() => {
    setTextElements([]);
    setSelectedTextId(null);
    setNewTextInput('');
  }, [file?.id]);

  // Cycle text color for all text elements
  const cycleTextColor = useCallback(() => {
    if (textElements.length === 0) return;

    const nextIndex = (currentColorIndex + 1) % textColors.length;
    const nextColor = textColors[nextIndex];

    setCurrentColorIndex(nextIndex);
    setTextColor(nextColor);

    // Update all text elements to new color
    setTextElements(prev => {
      const updated = prev.map(t => ({ ...t, color: nextColor }));
      // Save to history after state update
      setTimeout(() => saveToHistory(), 0);
      return updated;
    });
  }, [textElements.length, currentColorIndex, textColors, saveToHistory]);

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

  // Keyboard shortcuts with key hold support for brush size
  useEffect(() => {
    let lastUIUpdate = Date.now();

    // Start brush size change interval
    const startBrushSizeChange = (direction: 'increase' | 'decrease') => {
      // Clear existing interval if any
      if (brushSizeIntervalRef.current) {
        clearInterval(brushSizeIntervalRef.current);
      }

      // Immediate first change
      const newSize = direction === 'increase'
        ? Math.min(200, brushSizeRef.current + 10)
        : Math.max(1, brushSizeRef.current - 10);

      brushSizeRef.current = newSize;
      setBrushSize(newSize);
      lastUIUpdate = Date.now();

      // Update cursor size immediately
      if (cursorRef.current && imageRef.current) {
        const img = imageRef.current;
        const imgRect = img.getBoundingClientRect();
        const displayScale = imgRect.width / img.naturalWidth;
        const scaledBrushSize = newSize * displayScale;
        cursorRef.current.style.width = `${scaledBrushSize}px`;
        cursorRef.current.style.height = `${scaledBrushSize}px`;
      }

      // Start interval for continuous changes (30ms for smoother updates)
      brushSizeIntervalRef.current = setInterval(() => {
        const newSize = direction === 'increase'
          ? Math.min(200, brushSizeRef.current + 10)
          : Math.max(1, brushSizeRef.current - 10);

        brushSizeRef.current = newSize;

        // Update cursor size via ref (no re-render)
        if (cursorRef.current && imageRef.current) {
          const img = imageRef.current;
          const imgRect = img.getBoundingClientRect();
          const displayScale = imgRect.width / img.naturalWidth;
          const scaledBrushSize = newSize * displayScale;
          cursorRef.current.style.width = `${scaledBrushSize}px`;
          cursorRef.current.style.height = `${scaledBrushSize}px`;
        }

        // Update UI state only every 100ms (throttle to reduce re-renders)
        const now = Date.now();
        if (now - lastUIUpdate >= 100) {
          setBrushSize(newSize);
          lastUIUpdate = now;
        }
      }, 30);
    };

    // Stop brush size change interval
    const stopBrushSizeChange = () => {
      if (brushSizeIntervalRef.current) {
        clearInterval(brushSizeIntervalRef.current);
        brushSizeIntervalRef.current = null;
      }
      // Final UI update
      setBrushSize(brushSizeRef.current);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Prevent key repeat for non-size-change keys
      const sizeKeys = ['[', ']', '1', '2', 'ๅ', '/'];
      if (!sizeKeys.includes(e.key) && heldKeysRef.current.has(e.key)) {
        return;
      }
      heldKeysRef.current.add(e.key);

      // Global shortcuts (work in all modes)
      if (e.key === 'b' || e.key === 'B' || e.key === 'ิ') {
        e.preventDefault();
        // Toggle brush mode (b or ิ)
        setMode(prev => prev === 'brush' ? 'mouse' : 'brush');
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'ำ') {
        e.preventDefault();
        // Toggle eraser mode (e or ำ)
        setMode(prev => prev === 'eraser' ? 'mouse' : 'eraser');
      } else if (e.key === 't' || e.key === 'T' || e.key === 'ะ') {
        e.preventDefault();
        // Add text (t or ะ) and switch to mouse mode
        const pos = lastMousePosRef.current;
        if (pos) {
          addTextAtPosition(pos.x, pos.y);
        } else {
          addTextAtPosition(50, 50);
        }
        // Switch to mouse mode automatically
        setMode('mouse');
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'พ') {
        e.preventDefault();
        // Cycle text color (r or พ)
        cycleTextColor();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected text element
        if (selectedTextId) {
          e.preventDefault();
          deleteTextElement(selectedTextId);
        }
      } else if (e.key === '[' || e.key === '1' || e.key === 'ๅ') {
        e.preventDefault();
        startBrushSizeChange('decrease');
      } else if (e.key === ']' || e.key === '2' || e.key === '/') {
        e.preventDefault();
        startBrushSizeChange('increase');
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
      } else if ((e.key === 's' || e.key === 'ห') && !e.ctrlKey && !e.metaKey) {
        // "s" or "ห" (Thai) without Ctrl/Cmd -> Save Changes
        e.preventDefault();
        saveEditedImageFunc(false);
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleToggleReview(); // Save + Mark + Next
      } else if (e.key === ' ') {
        e.preventDefault();
        handleToggleReview();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        goToNextUnreviewed();
      } else if (e.key === 'h' || e.key === 'H' || e.key === 'ี') {
        e.preventDefault();
        // H key: Show shortcuts modal
        setShowShortcutsModal(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // ESC: close shortcuts modal first, then handle mode/back
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (mode !== 'mouse') {
          if (hasUnsavedDrawing) {
            if (confirm('You have unsaved changes. Exit to mouse mode?')) {
              setMode('mouse');
            }
          } else {
            setMode('mouse');
          }
        } else {
          goBack();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key);

      // Stop brush size change on key up
      if (e.key === '[' || e.key === ']' || e.key === '1' || e.key === '2' || e.key === 'ๅ' || e.key === '/') {
        stopBrushSizeChange();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopBrushSizeChange(); // Cleanup interval on unmount
    };
  }, [mode, handleToggleReview, goToNext, goToPrevious, goToNextUnreviewed, goBack, hasUnsavedDrawing, undo, redo, selectedTextId, deleteTextElement, addTextAtPosition, cycleTextColor, saveEditedImageFunc, showShortcutsModal]);

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
    <div className="min-h-screen bg-bg-primary">
      {/* Top Bar - Sticky navigation (แสดงเมื่อ scroll ลงมา) */}
      <TopBar
        currentIndex={currentIndex}
        totalFiles={allFiles.length}
        reviewedCount={reviewedCount}
        unreviewedCount={unreviewedCount}
        progress={progress}
        onGoBack={goBack}
        onGoToNextUnreviewed={goToNextUnreviewed}
      />

      {/* Main Content - 3 Panel Layout (Full viewport height minus TopBar) */}
      <div className="flex overflow-hidden h-[calc(100vh-60px)]">
        {/* LEFT SIDEBAR - File List */}
        <LeftSidebar
          allFiles={allFiles}
          currentFile={file}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          visibleFiles={visibleFiles}
          sidebarScrollRef={sidebarScrollRef}
          onSelectFile={selectFile}
        />

        {/* CENTER - Image Preview with Canvas */}
        <div
          className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1a1b26] relative overflow-hidden p-4"
          onMouseMove={handleImageContainerMouseMove}
          onMouseUp={handleTextMouseUp}
          onMouseLeave={handleImageContainerMouseLeave}
        >
          {/* Image Container with Canvas Overlay */}
          <div
            ref={imageContainerRef}
            className="relative max-w-full max-h-full"
          >
            {/* Original Image */}
            <img
              ref={imageRef}
              src={`${API_URL}/files/${file.id}/preview?t=${imageCacheBuster}`}
              alt={file.originalName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              crossOrigin="anonymous"
            />

            {/* Canvas Overlay (Always present, cursor changes by mode) */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="absolute top-0 left-0 w-full h-full"
              style={{ cursor: mode === 'mouse' ? 'default' : 'none' }}
            />

            {/* Brush Cursor Preview - Show only in brush/eraser mode */}
            {(mode === 'brush' || mode === 'eraser') && (
              <div
                ref={cursorRef}
                className="absolute pointer-events-none rounded-full transition-none"
                style={{
                  display: 'none',
                  transform: 'translate(-50%, -50%)',
                  border: `2px solid ${mode === 'brush' ? '#3b82f6' : '#ef4444'}`,
                  backgroundColor: mode === 'brush' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.5)`,
                }}
              >
                {/* Center dot */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: 3,
                    height: 3,
                    backgroundColor: mode === 'brush' ? '#3b82f6' : '#ef4444',
                  }}
                />
              </div>
            )}


            {/* Text Elements Overlay - Always visible */}
            {textElements
              .filter(textEl => textEl.text || editingTextId === textEl.id) // Hide empty text unless editing
              .map((textEl) => (
              <div
                key={textEl.id}
                data-text-element="true"
                data-text-id={textEl.id}
                onMouseDown={(e) => {
                  if (editingTextId !== textEl.id) {
                    handleTextMouseDown(e, textEl.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startEditingText(textEl.id);
                }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none transition-shadow ${
                  editingTextId === textEl.id ? '' : 'cursor-move'
                } ${
                  selectedTextId === textEl.id
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-transparent'
                    : 'hover:ring-2 hover:ring-accent/50'
                } ${draggingTextId === textEl.id ? 'opacity-80' : ''}`}
                style={{
                  left: `${textEl.x}%`,
                  top: `${textEl.y}%`,
                  fontSize: `${textEl.fontSize}px`,
                  color: textEl.color,
                  fontWeight: 'bold',
                  fontFamily: 'Arial, sans-serif',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: selectedTextId === textEl.id ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
                }}
              >
                {editingTextId === textEl.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        saveEditingText();
                      } else if (e.key === 'Escape') {
                        cancelEditingText();
                      }
                    }}
                    onBlur={saveEditingText}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="พิมพ์ข้อความ..."
                    className="bg-black/50 border border-accent rounded px-2 py-1 outline-none min-w-[120px] placeholder-white/50"
                    style={{
                      fontSize: 'inherit',
                      color: 'inherit',
                      fontWeight: 'inherit',
                      fontFamily: 'inherit',
                    }}
                    autoFocus
                  />
                ) : (
                  textEl.text
                )}
                {selectedTextId === textEl.id && editingTextId !== textEl.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTextElement(textEl.id);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    title="Delete text"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Mode Indicator */}
          <ModeIndicator
            mode={mode}
            hasUnsavedDrawing={hasUnsavedDrawing}
            textElementsCount={textElements.filter(t => t.text).length}
          />

          {/* Position Indicator - Bottom only */}
          <PositionIndicator
            currentIndex={currentIndex}
            totalFiles={allFiles.length}
          />

          {/* Drawing Toolbar - Bottom Left (show when not in mouse mode) */}
          {mode !== 'mouse' && (
            <DrawingToolbar
              historyIndex={historyIndex}
              historyLength={historyRef.current.length}
              onUndo={undo}
              onRedo={redo}
              onClear={clearCanvas}
            />
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

          {/* Mode Selector & Tools Section */}
          <div className="px-3 py-2 border-b border-border-color overflow-y-auto max-h-[calc(100vh-400px)] bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-[0.65rem] font-semibold text-text-primary uppercase tracking-wide mb-2">Mode & Tools</h3>

            {/* Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                onClick={() => setMode('mouse')}
                className={`px-2 py-1.5 rounded text-[0.7rem] font-semibold transition-all ${
                  mode === 'mouse'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                title="Mouse Mode (ESC)"
              >
                🖱️ Mouse
              </button>
              <button
                onClick={() => setMode('brush')}
                className={`px-2 py-1.5 rounded text-[0.7rem] font-semibold transition-all ${
                  mode === 'brush'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                title="Brush Mode (B or ิ)"
              >
                🖌️ Brush
              </button>
              <button
                onClick={() => setMode('eraser')}
                className={`px-2 py-1.5 rounded text-[0.7rem] font-semibold transition-all ${
                  mode === 'eraser'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                title="Eraser Mode (E or ำ)"
              >
                🧹 Eraser
              </button>
            </div>

            {/* Brush/Eraser Settings - Show only in brush/eraser mode */}
            {(mode === 'brush' || mode === 'eraser') && (
              <>
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
                      onChange={(e) => {
                        const newSize = parseInt(e.target.value);
                        brushSizeRef.current = newSize;
                        setBrushSize(newSize);
                      }}
                      className="w-full h-2 bg-border-color/50 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => { brushSizeRef.current = 20; setBrushSize(20); }} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">20</button>
                      <button onClick={() => { brushSizeRef.current = 50; setBrushSize(50); }} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">50</button>
                      <button onClick={() => { brushSizeRef.current = 100; setBrushSize(100); }} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">100</button>
                      <button onClick={() => { brushSizeRef.current = 200; setBrushSize(200); }} className="flex-1 text-xs py-1 bg-bg-secondary hover:bg-accent/10 rounded text-text-primary">200</button>
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
              </>
            )}

            {/* Text Settings */}
            <div className="mt-2 pt-2 border-t border-border-color/50">
              {/* Text Size */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[0.65rem] font-medium text-text-primary">Text Size</label>
                  <span className="text-[0.65rem] font-semibold text-blue-600 dark:text-blue-400">{textFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-border-color/50 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setTextFontSize(12)} className="flex-1 text-[0.65rem] py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-accent/50 rounded text-text-primary">12</button>
                  <button onClick={() => setTextFontSize(18)} className="flex-1 text-[0.65rem] py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-accent/50 rounded text-text-primary">18</button>
                  <button onClick={() => setTextFontSize(24)} className="flex-1 text-[0.65rem] py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-accent/50 rounded text-text-primary">24</button>
                  <button onClick={() => setTextFontSize(36)} className="flex-1 text-[0.65rem] py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-accent/50 rounded text-text-primary">36</button>
                </div>
              </div>

              {/* Text Color */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[0.65rem] font-medium text-text-primary">Text Color</label>
                  <button
                    onClick={cycleTextColor}
                    className="px-1.5 py-0.5 bg-bg-secondary border border-border-color/50 hover:border-accent/50 rounded text-[0.65rem] font-medium text-text-primary transition-all flex items-center gap-1"
                    title="Cycle color (R or พ)"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/50"
                      style={{ backgroundColor: textColor }}
                    />
                    Cycle
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {textColors.map((color, idx) => (
                    <button
                      key={color}
                      onClick={() => {
                        setCurrentColorIndex(idx);
                        setTextColor(color);
                        if (textElements.length > 0) {
                          setTextElements(prev => {
                            const updated = prev.map(t => ({ ...t, color }));
                            setTimeout(() => saveToHistory(), 0);
                            return updated;
                          });
                        }
                      }}
                      className={`w-5 h-5 rounded-full border transition-all ${
                        idx === currentColorIndex
                          ? 'border-accent border-2 scale-105'
                          : color === '#ffffff'
                            ? 'border-slate-400 dark:border-slate-500 hover:border-accent/50'
                            : color === '#000000'
                              ? 'border-slate-300 dark:border-slate-600 hover:border-accent/50'
                              : 'border-border-color hover:border-accent/50'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Color ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Text Elements List (show when have text) */}
              {textElements.filter(t => t.text).length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-color/50">
                  <label className="text-[0.65rem] font-medium text-text-primary block mb-1">
                    Text ({textElements.filter(t => t.text).length})
                  </label>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {textElements.filter(t => t.text).map((textEl) => (
                      <div
                        key={textEl.id}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[0.7rem] cursor-pointer transition-all ${
                          selectedTextId === textEl.id
                            ? 'bg-accent/20 border border-accent'
                            : 'bg-bg-secondary border border-border-color/50 hover:border-accent/30'
                        }`}
                        onClick={() => setSelectedTextId(textEl.id)}
                        onDoubleClick={() => startEditingText(textEl.id)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-border-color/50"
                          style={{ backgroundColor: textEl.color }}
                        />
                        <span className="flex-1 truncate text-text-primary">{textEl.text}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTextElement(textEl.id);
                          }}
                          className="p-0.5 hover:bg-red-500/20 rounded text-red-500"
                          title="Delete text"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Action Buttons */}
            <div className="mt-2">
              <button
                onClick={() => saveEditedImageFunc(false)}
                disabled={!hasUnsavedDrawing || saving}
                className={`w-full px-3 py-1.5 rounded text-[0.75rem] font-medium transition-all flex items-center justify-center gap-1.5 ${
                  hasUnsavedDrawing && !saving
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Quick Actions Section */}
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

          {/* Keyboard Shortcuts Button */}
          <div className="px-4 py-3 border-t border-border-color">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Keyboard Shortcuts
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card-bg rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden border border-border-color">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border-color bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-text-primary">Keyboard Shortcuts</h2>
                </div>
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-2 hover:bg-bg-secondary/50 rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {/* Mode Shortcuts */}
                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Brush Mode</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">B</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">ิ</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Eraser Mode</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">E</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">ำ</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Add Text</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">T</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">ะ</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Cycle Text Color</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">R</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">พ</kbd>
                  </div>
                </div>

                {/* Size Shortcuts */}
                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Brush Size</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">1</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">2</kbd>
                  </div>
                </div>

                {/* Edit Shortcuts */}
                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Undo / Redo</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">⌘Z</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">⌘Y</kbd>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Navigate</span>
                  <div className="flex gap-1.5">
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">←</kbd>
                    <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">→</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Next Unreviewed</span>
                  <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">N</kbd>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Mark + Next</span>
                  <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">Space</kbd>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">Save & Mark</span>
                  <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">⌘S</kbd>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-border-color/30">
                  <span className="text-sm text-text-primary font-medium">{mode !== 'mouse' ? 'Mouse Mode' : 'Back to List'}</span>
                  <kbd className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-text-primary font-mono text-sm shadow-sm">ESC</kbd>
                </div>
              </div>

              {/* Info Note */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  💡 <strong>Tip:</strong> Most shortcuts work in all modes. Press <kbd className="px-2 py-0.5 bg-white/50 dark:bg-black/30 rounded text-xs font-mono">H</kbd> anytime to show this help.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border-color bg-bg-secondary/30 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
