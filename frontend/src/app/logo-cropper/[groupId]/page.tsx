'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface CropArea {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function LogoCropperPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [labeledFiles, setLabeledFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Folder structure state (like documents page)
  const [documentGroups, setDocumentGroups] = useState<any[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryGroups, setCategoryGroups] = useState<Record<string, any[]>>({});

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide navbar
  useEffect(() => {
    document.body.classList.add('viewer-mode');
    const navbar = document.querySelector('nav');
    if (navbar instanceof HTMLElement) {
      navbar.style.display = 'none';
    }

    return () => {
      document.body.classList.remove('viewer-mode');
      if (navbar instanceof HTMLElement) {
        navbar.style.display = '';
      }
    };
  }, []);

  // Fetch labeled files
  useEffect(() => {
    const fetchLabeledFiles = async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`/labeled-files/group/${groupId}`);
        if (!res.ok) throw new Error('Failed to fetch labeled files');
        const data = await res.json();
        const sortedFiles = (data || []).sort((a: any, b: any) => a.orderInGroup - b.orderInGroup);
        setLabeledFiles(sortedFiles);

        // Group files by templateName (combine all pages of same template)
        const groupsMap: Record<string, any> = {};
        sortedFiles.forEach((file: any) => {
          const templateKey = file.templateName || 'Unmatched';
          if (!groupsMap[templateKey]) {
            groupsMap[templateKey] = {
              templateName: file.templateName,
              category: file.category,
              files: [],
            };
          }
          groupsMap[templateKey].files.push(file);
        });

        // Sort groups: labeled templates first (by first appearance), then unmatched
        const groups = Object.values(groupsMap).sort((a: any, b: any) => {
          const aFirstIndex = sortedFiles.findIndex((f: any) => f.templateName === a.templateName);
          const bFirstIndex = sortedFiles.findIndex((f: any) => f.templateName === b.templateName);
          return aFirstIndex - bFirstIndex;
        });
        setDocumentGroups(groups);

        // Group documents by category for folder structure
        const catGroups: Record<string, any[]> = { '': [] }; // '' = no category (root level)
        groups.forEach((group: any) => {
          const category = group.category || '';
          if (!catGroups[category]) {
            catGroups[category] = [];
          }
          catGroups[category].push(group);
        });
        setCategoryGroups(catGroups);

        // Expand categories that contain the first selected file
        const firstFile = sortedFiles[0];
        if (firstFile?.category) {
          setExpandedCategories(new Set([firstFile.category]));
        }
      } catch (err) {
        console.error('Error fetching labeled files:', err);
        alert('Error loading documents');
      } finally {
        setLoading(false);
      }
    };
    fetchLabeledFiles();
  }, [groupId]);

  // Load selected image
  useEffect(() => {
    if (labeledFiles.length > 0 && selectedFileIndex < labeledFiles.length) {
      const file = labeledFiles[selectedFileIndex];
      setImageLoading(true);
      setImageUrl(`${API_URL}/labeled-files/${file.id}/preview`);
      setCropArea(null);
      setCroppedPreview(null);
    }
  }, [labeledFiles, selectedFileIndex]);

  // Store the scale factor for coordinate conversion
  const scaleRef = useRef<number>(1);

  // Draw image and crop overlay on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    // Use fixed max dimensions for canvas
    const maxWidth = container.clientWidth - 32;
    const maxHeight = container.clientHeight - 32;

    // Calculate scale to fit image
    const scale = Math.min(
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
      1 // Don't scale up
    );
    scaleRef.current = scale;

    const displayWidth = Math.floor(image.naturalWidth * scale);
    const displayHeight = Math.floor(image.naturalHeight * scale);

    // Set canvas size (1:1 pixel ratio)
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Draw image
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    // Draw crop overlay if exists
    if (cropArea) {
      const x = Math.min(cropArea.startX, cropArea.endX);
      const y = Math.min(cropArea.startY, cropArea.endY);
      const width = Math.abs(cropArea.endX - cropArea.startX);
      const height = Math.abs(cropArea.endY - cropArea.startY);

      // Darken outside crop area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + height, canvas.width, canvas.height - y - height);
      ctx.fillRect(0, y, x, height);
      ctx.fillRect(x + width, y, canvas.width - x - width, height);

      // Draw crop border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);

      // Draw corner handles
      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6';
      const handleSize = 8;
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
      ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
    }
  }, [cropArea]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, cropArea]);

  // Handle image load
  const handleImageLoad = () => {
    setImageLoading(false);
    drawCanvas();
  };

  // Get canvas coordinates from mouse event
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    // Account for any CSS scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  // Mouse event handlers for cropping
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoords(e);

    setIsCropping(true);
    setCropArea({ startX: x, startY: y, endX: x, endY: y });
    setCroppedPreview(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !cropArea) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoords(e);
    const clampedX = Math.max(0, Math.min(x, canvas.width));
    const clampedY = Math.max(0, Math.min(y, canvas.height));

    setCropArea({ ...cropArea, endX: clampedX, endY: clampedY });
  };

  const handleMouseUp = () => {
    if (!isCropping || !cropArea) return;
    setIsCropping(false);

    // Generate cropped preview
    const width = Math.abs(cropArea.endX - cropArea.startX);
    const height = Math.abs(cropArea.endY - cropArea.startY);

    if (width > 10 && height > 10) {
      generateCroppedPreview();
    }
  };

  // Generate cropped preview
  const generateCroppedPreview = () => {
    const image = imageRef.current;
    if (!image || !cropArea) return;

    const x = Math.min(cropArea.startX, cropArea.endX);
    const y = Math.min(cropArea.startY, cropArea.endY);
    const width = Math.abs(cropArea.endX - cropArea.startX);
    const height = Math.abs(cropArea.endY - cropArea.startY);

    // Use stored scale factor
    const scale = scaleRef.current;

    // Calculate source coordinates in original image
    const srcX = x / scale;
    const srcY = y / scale;
    const srcWidth = width / scale;
    const srcHeight = height / scale;

    // Create cropped canvas at original resolution
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.floor(srcWidth);
    croppedCanvas.height = Math.floor(srcHeight);
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      srcX, srcY, srcWidth, srcHeight,
      0, 0, srcWidth, srcHeight
    );

    setCroppedPreview(croppedCanvas.toDataURL('image/png'));
  };

  // Save cropped logo
  const handleSaveLogo = async () => {
    if (!croppedPreview) return;

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/files/parsed-group/${groupId}/upload-logo`, {
        method: 'POST',
        body: JSON.stringify({ imageData: croppedPreview }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to save logo');
      }

      const data = await res.json();

      // Notify parent window to update logo using localStorage event
      // This is more reliable than postMessage across windows
      localStorage.setItem('logo-updated', JSON.stringify({
        type: 'LOGO_UPDATED',
        groupId: groupId,
        logoUrl: data.logoUrl,
        timestamp: Date.now(),
      }));

      // Also try postMessage as fallback
      if (window.opener) {
        window.opener.postMessage({
          type: 'LOGO_UPDATED',
          groupId: groupId,
          logoUrl: data.logoUrl,
        }, '*');
      }

      window.close();
    } catch (err: any) {
      console.error('Error saving logo:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reset crop
  const handleResetCrop = () => {
    setCropArea(null);
    setCroppedPreview(null);
    drawCanvas();
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Template colors for visual distinction
  const TEMPLATE_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  const getTemplateColor = (templateName: string | null) => {
    if (!templateName) return '#999';
    const uniqueTemplates = [...new Set(labeledFiles.map(f => f.templateName).filter(Boolean))];
    const index = uniqueTemplates.indexOf(templateName);
    return TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
  };

  // Auto-expand category when selecting a file
  useEffect(() => {
    const currentFile = labeledFiles[selectedFileIndex];
    if (currentFile?.category) {
      setExpandedCategories(prev => {
        if (!prev.has(currentFile.category)) {
          const next = new Set(prev);
          next.add(currentFile.category);
          return next;
        }
        return prev;
      });
    }
  }, [selectedFileIndex, labeledFiles]);

  // Get sorted categories
  const sortedCategories = Object.keys(categoryGroups).filter(cat => cat !== '' && categoryGroups[cat]?.length > 0);
  const rootDocuments = categoryGroups[''] || [];

  // Close window
  const handleClose = () => {
    window.close();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft' && selectedFileIndex > 0) {
        setSelectedFileIndex(selectedFileIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedFileIndex < labeledFiles.length - 1) {
        setSelectedFileIndex(selectedFileIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileIndex, labeledFiles.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin"></div>
          <p className="text-text-secondary">กำลังโหลดเอกสาร...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-card-bg border-b border-border-color px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-lg bg-bg-secondary hover:bg-danger/20 flex items-center justify-center text-text-secondary hover:text-danger transition-colors"
            title="ปิด (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div>
            <h1 className="text-text-primary font-semibold">เลือก Logo - Group {groupId}</h1>
            <p className="text-xs text-text-secondary">ลากเมาส์เพื่อเลือกพื้นที่ Logo จากเอกสาร</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {croppedPreview && (
            <button
              onClick={handleResetCrop}
              className="px-4 py-2 rounded-lg bg-bg-secondary border border-border-color text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              เลือกใหม่
            </button>
          )}
          <button
            onClick={handleSaveLogo}
            disabled={!croppedPreview || saving}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                ตกลง
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Folder Structure */}
        <div className="w-56 flex-shrink-0 bg-card-bg border-r border-border-color overflow-y-auto">
          <div className="p-2">
            <h3 className="text-xs font-semibold text-text-secondary uppercase px-3 py-2">Documents</h3>
            <div className="space-y-0.5">
              {/* Category Folders */}
              {sortedCategories.map((category) => {
                const docsInCategory = categoryGroups[category] || [];
                const isExpanded = expandedCategories.has(category);
                const totalPages = docsInCategory.reduce((sum: number, doc: any) => sum + doc.files.length, 0);
                const currentSelectedFile = labeledFiles[selectedFileIndex];
                const hasSelectedDoc = currentSelectedFile && docsInCategory.some(
                  (doc: any) => doc.templateName === currentSelectedFile.templateName
                );

                return (
                  <div key={category} className="mb-1">
                    {/* Category Header (Folder) */}
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        hasSelectedDoc && !isExpanded
                          ? 'bg-accent/20 text-accent'
                          : 'hover:bg-accent-light text-text-primary'
                      }`}
                      onClick={() => toggleCategory(category)}
                    >
                      {/* Folder Icon */}
                      <svg
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'text-yellow-500' : 'text-yellow-600'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        {isExpanded ? (
                          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
                        ) : (
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        )}
                      </svg>
                      {/* Expand/Collapse Arrow */}
                      <svg
                        className={`w-3 h-3 flex-shrink-0 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{category}</div>
                        <div className="text-xs text-text-secondary truncate">
                          {docsInCategory.length} doc{docsInCategory.length !== 1 ? 's' : ''}, {totalPages} page{totalPages !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Documents inside category folder */}
                    {isExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border-color pl-2">
                        {docsInCategory.map((docGroup: any) => {
                          const color = getTemplateColor(docGroup.templateName);
                          const firstFile = docGroup.files[0];
                          const firstFileIndex = labeledFiles.findIndex((f: any) => f.id === firstFile.id);
                          const isDocSelected = currentSelectedFile && currentSelectedFile.templateName === docGroup.templateName;

                          return (
                            <div
                              key={docGroup.templateName || 'unmatched'}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                isDocSelected
                                  ? 'bg-accent text-white'
                                  : 'hover:bg-accent-light text-text-primary'
                              }`}
                              onClick={() => setSelectedFileIndex(firstFileIndex)}
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              ></span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {docGroup.templateName || 'Unmatched'}
                                </div>
                                <div className={`text-xs truncate ${isDocSelected ? 'text-white/70' : 'text-text-secondary'}`}>
                                  {docGroup.files.length} {docGroup.files.length === 1 ? 'page' : 'pages'}
                                </div>
                              </div>
                              {isDocSelected && (
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Root Documents (no category) */}
              {rootDocuments.map((docGroup: any) => {
                const color = getTemplateColor(docGroup.templateName);
                const firstFile = docGroup.files[0];
                const firstFileIndex = labeledFiles.findIndex((f: any) => f.id === firstFile.id);
                const currentSelectedFile = labeledFiles[selectedFileIndex];
                const isSelected = currentSelectedFile && currentSelectedFile.templateName === docGroup.templateName;

                return (
                  <div
                    key={docGroup.templateName || 'unmatched-root'}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-accent text-white'
                        : 'hover:bg-accent-light text-text-primary'
                    }`}
                    onClick={() => setSelectedFileIndex(firstFileIndex)}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    ></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {docGroup.templateName || 'Unmatched'}
                      </div>
                      <div className={`text-xs truncate ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}>
                        {docGroup.files.length} {docGroup.files.length === 1 ? 'page' : 'pages'}
                      </div>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center - Image with Crop */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={containerRef}
            className="flex-1 relative flex items-center justify-center bg-bg-secondary p-4 overflow-hidden"
          >
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary z-10">
                <div className="w-8 h-8 rounded-full border-3 border-accent/30 border-t-accent animate-spin"></div>
              </div>
            )}

            {/* Hidden image for loading */}
            {imageUrl && (
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Document"
                onLoad={handleImageLoad}
                className="hidden"
                crossOrigin="anonymous"
              />
            )}

            {/* Canvas for crop interaction */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="max-w-full max-h-full cursor-crosshair shadow-lg rounded-lg"
              style={{ display: imageLoading ? 'none' : 'block' }}
            />
          </div>

          {/* Thumbnail Strip */}
          <div className="flex-shrink-0 h-24 bg-card-bg border-t border-border-color px-4 py-2 overflow-x-auto">
            <div className="flex gap-2 h-full">
              {labeledFiles.map((file, idx) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`flex-shrink-0 h-full aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                    selectedFileIndex === idx
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={`${API_URL}/labeled-files/${file.id}/preview`}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Preview */}
        <div className="w-64 flex-shrink-0 bg-card-bg border-l border-border-color p-4 flex flex-col">
          <h3 className="text-text-primary font-medium mb-3">ตัวอย่าง Logo</h3>

          <div className="flex-1 flex items-center justify-center">
            {croppedPreview ? (
              <div className="w-full aspect-square rounded-xl border-2 border-border-color overflow-hidden bg-white flex items-center justify-center p-2">
                <img
                  src={croppedPreview}
                  alt="Cropped Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border-color/50 flex flex-col items-center justify-center text-text-secondary/50 gap-2">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-center px-4">
                  ลากเมาส์บนรูปเพื่อเลือกพื้นที่ Logo
                </span>
              </div>
            )}
          </div>

          {croppedPreview && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-emerald-400 text-xs flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                พร้อมบันทึก Logo
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border-color">
            <p className="text-xs text-text-secondary">
              <strong>วิธีใช้:</strong>
            </p>
            <ul className="text-xs text-text-secondary mt-2 space-y-1">
              <li>• เลือกหน้าเอกสารจากรายการ</li>
              <li>• ลากเมาส์เพื่อเลือกพื้นที่ Logo</li>
              <li>• ตรวจสอบตัวอย่างด้านขวา</li>
              <li>• กด "ตกลง" เพื่อบันทึก</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
