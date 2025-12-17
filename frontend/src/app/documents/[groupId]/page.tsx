'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ImageViewer from '@/components/ImageViewer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

export default function GroupDocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [labeledFiles, setLabeledFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [documentGroups, setDocumentGroups] = useState<any[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryGroups, setCategoryGroups] = useState<Record<string, any[]>>({});

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
        const res = await fetch(`${API_URL}/labeled-files/group/${groupId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch labeled files');
        }
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

  // Keyboard navigation - navigate within current template, jump to next template at boundaries
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close();
        return;
      }

      const currentFile = labeledFiles[selectedFileIndex];
      if (!currentFile) return;

      const currentTemplate = currentFile.templateName;
      const currentGroup = documentGroups.find((g: any) => g.templateName === currentTemplate);

      if (!currentGroup) return;

      const filesInGroup = currentGroup.files;
      const currentIndexInGroup = filesInGroup.findIndex((f: any) => f.id === currentFile.id);

      if (e.key === 'ArrowLeft') {
        if (currentIndexInGroup > 0) {
          // Previous page in same template
          const prevFile = filesInGroup[currentIndexInGroup - 1];
          const prevFileIndex = labeledFiles.findIndex((f: any) => f.id === prevFile.id);
          setSelectedFileIndex(prevFileIndex);
        } else {
          // Jump to previous template (last page)
          const currentGroupIndex = documentGroups.findIndex((g: any) => g.templateName === currentTemplate);
          if (currentGroupIndex > 0) {
            const prevGroup = documentGroups[currentGroupIndex - 1];
            const lastFileOfPrevGroup = prevGroup.files[prevGroup.files.length - 1];
            const prevFileIndex = labeledFiles.findIndex((f: any) => f.id === lastFileOfPrevGroup.id);
            setSelectedFileIndex(prevFileIndex);
          }
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndexInGroup < filesInGroup.length - 1) {
          // Next page in same template
          const nextFile = filesInGroup[currentIndexInGroup + 1];
          const nextFileIndex = labeledFiles.findIndex((f: any) => f.id === nextFile.id);
          setSelectedFileIndex(nextFileIndex);
        } else {
          // Jump to next template (first page)
          const currentGroupIndex = documentGroups.findIndex((g: any) => g.templateName === currentTemplate);
          if (currentGroupIndex < documentGroups.length - 1) {
            const nextGroup = documentGroups[currentGroupIndex + 1];
            const firstFileOfNextGroup = nextGroup.files[0];
            const nextFileIndex = labeledFiles.findIndex((f: any) => f.id === firstFileOfNextGroup.id);
            setSelectedFileIndex(nextFileIndex);
          }
        }
      } else if (e.key === 'ArrowUp') {
        // Jump to previous template (first page)
        const currentGroupIndex = documentGroups.findIndex((g: any) => g.templateName === currentTemplate);
        if (currentGroupIndex > 0) {
          const prevGroup = documentGroups[currentGroupIndex - 1];
          const firstFileOfPrevGroup = prevGroup.files[0];
          const prevFileIndex = labeledFiles.findIndex((f: any) => f.id === firstFileOfPrevGroup.id);
          setSelectedFileIndex(prevFileIndex);
        }
      } else if (e.key === 'ArrowDown') {
        // Jump to next template (first page)
        const currentGroupIndex = documentGroups.findIndex((g: any) => g.templateName === currentTemplate);
        if (currentGroupIndex < documentGroups.length - 1) {
          const nextGroup = documentGroups[currentGroupIndex + 1];
          const firstFileOfNextGroup = nextGroup.files[0];
          const nextFileIndex = labeledFiles.findIndex((f: any) => f.id === firstFileOfNextGroup.id);
          setSelectedFileIndex(nextFileIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileIndex, labeledFiles, documentGroups]);

  const currentFile = labeledFiles[selectedFileIndex];

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

  // Get sorted categories (non-empty categories first, then root items)
  const sortedCategories = Object.keys(categoryGroups).filter(cat => cat !== '' && categoryGroups[cat].length > 0);
  const rootDocuments = categoryGroups[''] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Header - Minimal */}
      <div className="bg-card-bg border-b border-border-color px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.close()}
            className="p-1.5 hover:bg-accent-light rounded transition-colors text-text-secondary hover:text-text-primary"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-text-primary">
            Group {groupId} • {labeledFiles.length} Documents
          </h1>
        </div>
        <div className="text-sm text-text-secondary">
          {currentFile && `Page ${currentFile.orderInGroup} of ${labeledFiles.length}`}
        </div>
      </div>

      {/* Main Layout: 3 Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Full Height */}
        <div className="w-12 sm:w-32 md:w-48 lg:w-56 xl:w-64 bg-card-bg border-r border-border-color overflow-y-auto overflow-x-hidden">
          <div className="p-2">
            <h3 className="text-xs font-semibold text-text-secondary uppercase px-3 py-2">Documents</h3>
            <div className="space-y-0.5">
              {/* Category Folders */}
              {sortedCategories.map((category) => {
                const docsInCategory = categoryGroups[category] || [];
                const isExpanded = expandedCategories.has(category);
                const totalPages = docsInCategory.reduce((sum: number, doc: any) => sum + doc.files.length, 0);

                // Check if any document in this category is selected
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

        {/* Center - Image Preview + Thumbnail Strip */}
        <div className="flex-1 flex flex-col bg-bg-secondary overflow-hidden">
          {/* Image Container with Zoom/Pan */}
          <div className="flex-1 overflow-hidden">
            {currentFile && (
              <ImageViewer
                src={`${API_URL}/labeled-files/${currentFile.id}/preview`}
                alt={currentFile.originalName}
                onPrevious={() => {
                  if (selectedFileIndex > 0) {
                    setSelectedFileIndex(selectedFileIndex - 1);
                  }
                }}
                onNext={() => {
                  if (selectedFileIndex < labeledFiles.length - 1) {
                    setSelectedFileIndex(selectedFileIndex + 1);
                  }
                }}
                hasPrevious={selectedFileIndex > 0}
                hasNext={selectedFileIndex < labeledFiles.length - 1}
              />
            )}
          </div>

          {/* Thumbnail Strip - Bottom */}
          <div className="h-32 bg-card-bg border-t border-border-color px-4 py-2 overflow-x-auto flex-shrink-0">
            <div className="flex gap-2 h-full">
              {(() => {
                // Filter: Show only files from current template
                const currentTemplate = currentFile?.templateName;
                const currentGroup = documentGroups.find((g: any) => g.templateName === currentTemplate);
                const filesToShow = currentGroup ? currentGroup.files : [];

                return filesToShow.map((file: any, idx: number) => {
                  const color = getTemplateColor(file.templateName);
                  const fileIndex = labeledFiles.findIndex((f: any) => f.id === file.id);
                  const isSelected = fileIndex === selectedFileIndex;

                  return (
                    <div
                      key={file.id}
                      className={`flex-shrink-0 w-20 cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => setSelectedFileIndex(fileIndex)}
                    >
                      <div className="h-20 bg-bg-secondary rounded overflow-hidden border-2" style={{ borderColor: isSelected ? color : 'transparent' }}>
                        <img
                          src={`${API_URL}/labeled-files/${file.id}/preview`}
                          alt={file.originalName}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-center text-text-secondary mt-1 truncate">
                        {idx + 1}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Full Height */}
        <div className="w-16 sm:w-40 md:w-56 lg:w-72 xl:w-80 bg-card-bg border-l border-border-color overflow-y-auto overflow-x-hidden">
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">OCR Result</h3>
                {currentFile && (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getTemplateColor(currentFile.templateName) }}
                    ></span>
                    <span className="text-xs text-text-secondary">
                      {currentFile.templateName || 'Unmatched'}
                    </span>
                  </div>
                )}
              </div>
              {currentFile?.ocrText && (
                <button
                  onClick={() => {
                    const ocrWindow = window.open('', '_blank', 'width=700,height=900');
                    if (ocrWindow) {
                      // Check if OCR text contains HTML tags
                      const hasHtmlTags = (text: string) => {
                        return /<(table|tr|td|th|div|span|p|br|ul|ol|li|h[1-6])[^>]*>/i.test(text);
                      };

                      // Convert OCR text to HTML with paragraphs and line breaks
                      const formatOcrToHtml = (text: string) => {
                        // If text contains HTML tags, render as HTML directly
                        if (hasHtmlTags(text)) {
                          return text;
                        }

                        // Otherwise, escape HTML special chars and format
                        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                        // Split by double newlines for paragraphs
                        const paragraphs = html.split(/\n\s*\n/);

                        return paragraphs.map(p => {
                          // Convert single newlines to <br>
                          const withBreaks = p.trim().replace(/\n/g, '<br>');
                          return `<p>${withBreaks}</p>`;
                        }).join('');
                      };

                      const formattedContent = formatOcrToHtml(currentFile.ocrText);
                      const isHtmlContent = hasHtmlTags(currentFile.ocrText);
                      const templateColor = getTemplateColor(currentFile.templateName);

                      ocrWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>OCR Text - ${currentFile.templateName || 'Document'}</title>
                          <style>
                            * { box-sizing: border-box; }
                            body {
                              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                              padding: 0;
                              margin: 0;
                              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                              color: #e0e0e0;
                              min-height: 100vh;
                            }
                            .container {
                              max-width: 800px;
                              margin: 0 auto;
                              padding: 24px;
                            }
                            .header {
                              background: rgba(255,255,255,0.05);
                              border-radius: 12px;
                              padding: 20px;
                              margin-bottom: 20px;
                              border: 1px solid rgba(255,255,255,0.1);
                              backdrop-filter: blur(10px);
                            }
                            .header-top {
                              display: flex;
                              justify-content: space-between;
                              align-items: flex-start;
                              margin-bottom: 12px;
                            }
                            .template-badge {
                              display: inline-flex;
                              align-items: center;
                              gap: 8px;
                              padding: 6px 12px;
                              background: ${templateColor}22;
                              border: 1px solid ${templateColor}44;
                              border-radius: 20px;
                              font-size: 13px;
                              color: ${templateColor};
                            }
                            .template-badge .dot {
                              width: 8px;
                              height: 8px;
                              border-radius: 50%;
                              background: ${templateColor};
                            }
                            .header h1 {
                              font-size: 18px;
                              margin: 0 0 8px 0;
                              color: #fff;
                              font-weight: 600;
                            }
                            .header .meta {
                              font-size: 13px;
                              color: #888;
                              display: flex;
                              gap: 16px;
                            }
                            .meta-item {
                              display: flex;
                              align-items: center;
                              gap: 6px;
                            }
                            .copy-btn {
                              display: inline-flex;
                              align-items: center;
                              gap: 6px;
                              padding: 8px 16px;
                              background: rgba(59, 130, 246, 0.2);
                              border: 1px solid rgba(59, 130, 246, 0.3);
                              border-radius: 8px;
                              color: #60a5fa;
                              font-size: 13px;
                              cursor: pointer;
                              transition: all 0.2s;
                            }
                            .copy-btn:hover {
                              background: rgba(59, 130, 246, 0.3);
                              border-color: rgba(59, 130, 246, 0.5);
                            }
                            .copy-btn.copied {
                              background: rgba(34, 197, 94, 0.2);
                              border-color: rgba(34, 197, 94, 0.3);
                              color: #4ade80;
                            }
                            .content {
                              background: rgba(0,0,0,0.3);
                              padding: 24px;
                              border-radius: 12px;
                              border: 1px solid rgba(255,255,255,0.1);
                              font-size: 15px;
                              line-height: 1.8;
                            }
                            .content p {
                              margin: 0 0 16px 0;
                              text-align: justify;
                            }
                            .content p:last-child {
                              margin-bottom: 0;
                            }
                            /* Table Styles */
                            .content table {
                              width: 100%;
                              border-collapse: collapse;
                              margin: 16px 0;
                              font-size: 14px;
                              background: rgba(255,255,255,0.02);
                              border-radius: 8px;
                              overflow: hidden;
                            }
                            .content table, .content th, .content td {
                              border: 1px solid rgba(255,255,255,0.15);
                            }
                            .content th {
                              background: rgba(59, 130, 246, 0.2);
                              color: #60a5fa;
                              font-weight: 600;
                              padding: 12px 16px;
                              text-align: left;
                            }
                            .content td {
                              padding: 10px 16px;
                              vertical-align: top;
                            }
                            .content tr:nth-child(even) {
                              background: rgba(255,255,255,0.02);
                            }
                            .content tr:hover {
                              background: rgba(59, 130, 246, 0.1);
                            }
                            /* First row as header if no th */
                            .content table tr:first-child td {
                              background: rgba(59, 130, 246, 0.15);
                              font-weight: 600;
                              color: #93c5fd;
                            }
                            .stats {
                              display: flex;
                              gap: 24px;
                              margin-top: 16px;
                              padding-top: 16px;
                              border-top: 1px solid rgba(255,255,255,0.1);
                              font-size: 12px;
                              color: #666;
                            }
                            .stat {
                              display: flex;
                              align-items: center;
                              gap: 6px;
                            }
                            .stat-value {
                              color: #999;
                              font-weight: 500;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            <div class="header">
                              <div class="header-top">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                  <div class="template-badge">
                                    <span class="dot"></span>
                                    ${currentFile.templateName || 'Unmatched'}
                                  </div>
                                  ${isHtmlContent ? '<div style="padding: 4px 10px; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; font-size: 11px; color: #4ade80;">HTML Rendered</div>' : ''}
                                </div>
                                <button class="copy-btn" onclick="copyText()">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                  <span id="copy-text">Copy Text</span>
                                </button>
                              </div>
                              <h1>${currentFile.templateName || 'Unmatched Document'}</h1>
                              <div class="meta">
                                <span class="meta-item">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                  </svg>
                                  Page ${currentFile.orderInGroup}
                                </span>
                                <span class="meta-item">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                  </svg>
                                  Group ${groupId}
                                </span>
                              </div>
                            </div>
                            <div class="content" id="ocr-content">
                              ${formattedContent}
                            </div>
                            <div class="stats">
                              <div class="stat">
                                <span>Characters:</span>
                                <span class="stat-value">${currentFile.ocrText.length.toLocaleString()}</span>
                              </div>
                              <div class="stat">
                                <span>Words:</span>
                                <span class="stat-value">${currentFile.ocrText.split(/\\s+/).filter(Boolean).length.toLocaleString()}</span>
                              </div>
                              <div class="stat">
                                <span>Lines:</span>
                                <span class="stat-value">${currentFile.ocrText.split('\\n').length.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <script>
                            const originalText = ${JSON.stringify(currentFile.ocrText)};
                            function copyText() {
                              navigator.clipboard.writeText(originalText).then(() => {
                                const btn = document.querySelector('.copy-btn');
                                const text = document.getElementById('copy-text');
                                btn.classList.add('copied');
                                text.textContent = 'Copied!';
                                setTimeout(() => {
                                  btn.classList.remove('copied');
                                  text.textContent = 'Copy Text';
                                }, 2000);
                              });
                            }
                          </script>
                        </body>
                        </html>
                      `);
                      ocrWindow.document.close();
                    }
                  }}
                  className="p-1.5 rounded-lg bg-bg-secondary hover:bg-accent/20 text-text-secondary hover:text-accent transition-colors"
                  title="เปิด OCR Text ในหน้าต่างใหม่"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
            </div>

            {currentFile?.ocrText ? (
              <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap bg-bg-secondary p-3 rounded border border-border-color">
                {currentFile.ocrText}
              </div>
            ) : (
              <div className="text-sm text-text-secondary italic">
                No OCR text available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
