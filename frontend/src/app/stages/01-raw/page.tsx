'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface RawFile {
  id: number;
  fileNumber: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  processed: boolean;
  processedAt: string | null;
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

interface LogMessage {
  timestamp: string;
  thread: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

export default function Stage01Raw() {
  const [files, setFiles] = useState<RawFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);
  const [allSelectedFiles, setAllSelectedFiles] = useState<File[]>([]); // Store all files without preview
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const uploadAbortRef = useRef(false);
  const [taskRunning, setTaskRunning] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [backendConnected, setBackendConnected] = useState(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [previewFile, setPreviewFile] = useState<RawFile | null>(null);
  const [terminalCompact, setTerminalCompact] = useState(true);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalAllFiles, setTotalAllFiles] = useState(0); // Total files without filter
  const [viewMode, setViewMode] = useState<'all' | 'progress'>('all'); // 'all' = show all files, 'progress' = show only pending files
  const [processedCount, setProcessedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const taskRunningRef = useRef(taskRunning);
  const reconnectAttemptsRef = useRef(reconnectAttempts);

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: 'createdAt',
        sortOrder: 'ASC',
        processed: viewMode === 'progress' ? 'false' : 'all', // Progress mode = show only pending
      });
      const res = await fetch(`${API_URL}/files?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setFiles(data.files || []);
      setTotalPages(data.totalPages || 1);
      setTotalFiles(data.total || 0);
      setBackendConnected(true);

      // Always fetch processed/pending counts for Status Card
      try {
        const processedRes = await fetch(`${API_URL}/files?${new URLSearchParams({ processed: 'true', limit: '1', page: '1' })}`);
        const pendingRes = await fetch(`${API_URL}/files?${new URLSearchParams({ processed: 'false', limit: '1', page: '1' })}`);

        if (processedRes.ok && pendingRes.ok) {
          const processedData = await processedRes.json();
          const pendingData = await pendingRes.json();
          setProcessedCount(processedData.total || 0);
          setPendingCount(pendingData.total || 0);
          setTotalAllFiles((processedData.total || 0) + (pendingData.total || 0));
        }
      } catch (err) {
        console.error('Error fetching counts:', err);
      }

      return data.files || [];
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

  const hasUnprocessedFiles = useCallback((fileList?: RawFile[]) => {
    const checkFiles = fileList || files;
    return checkFiles.some(f => !f.processed);
  }, [files]);

  // ===== REFACTORED: SSE Connection Logic =====

  // Use refs for functions to avoid circular dependencies
  const startTaskWithSSERef = useRef<(() => Promise<void>) | null>(null);
  const stopHealthCheckRef = useRef<(() => void) | null>(null);

  // Sync state with refs
  useEffect(() => {
    taskRunningRef.current = taskRunning;
  }, [taskRunning]);

  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);

  const handleLogMessage = useCallback(async (log: LogMessage) => {
    // Update last activity time
    lastActivityTimeRef.current = Date.now();

    // Check for FILE_PROCESSED event
    if (log.message.startsWith('FILE_PROCESSED:')) {
      const fileId = parseInt(log.message.split(':')[1]);

      setFiles((prevFiles) => {
        // If in Progress mode, remove the file from list after processing
        if (viewMode === 'progress') {
          return prevFiles.filter((file) => file.id !== fileId);
        } else {
          // If in All mode, just update the status
          return prevFiles.map((file) =>
            file.id === fileId ? { ...file, processed: true, processedAt: new Date().toISOString() } : file
          );
        }
      });

      setLastActivityTime(new Date());
      setProcessedCount(prev => prev + 1);
      setPendingCount(prev => Math.max(0, prev - 1));

      // Update total files count in Progress mode
      if (viewMode === 'progress') {
        setTotalFiles(prev => Math.max(0, prev - 1));
      }

      return;
    }

    // Add log to terminal
    setLogs((prev) => [...prev, log]);

    // Check if loop stopped
    if (log.message.includes('Infinite Worker Loop Stopped')) {
      setTaskRunning(false);
      stopHealthCheckRef.current?.();
      await fetchFiles();
    }
  }, [fetchFiles]);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/task-runner/logs`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);
        await handleLogMessage(log);
        // Reset reconnect attempts on successful message
        setReconnectAttempts(0);
      } catch (e) {
        console.error('Error parsing log:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();

      // Reconnect logic (max 5 attempts) - use refs to avoid dependencies
      if (taskRunningRef.current && reconnectAttemptsRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: `⚠️ Connection lost. Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttemptsRef.current + 1}/5)`,
          type: 'warning'
        }]);

        setReconnectAttempts((prev) => prev + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      } else if (reconnectAttemptsRef.current >= 5) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '❌ Max reconnection attempts reached. Please refresh the page.',
          type: 'error'
        }]);
        setTaskRunning(false);
        stopHealthCheckRef.current?.();
      }
    };
  }, [handleLogMessage]);

  const startHealthCheck = useCallback(() => {
    // Clear existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    // Check every 30 seconds
    healthCheckIntervalRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;
      const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

      if (timeSinceLastActivity > TIMEOUT_MS && taskRunningRef.current) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '⚠️ Task appears to be stuck (no activity for 5 minutes). Stopping...',
          type: 'error'
        }]);
        setTaskRunning(false);
        stopHealthCheckRef.current?.();

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      }
    }, 30000); // Check every 30s
  }, []);

  const stopHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);

  // Update ref whenever stopHealthCheck changes
  useEffect(() => {
    stopHealthCheckRef.current = stopHealthCheck;
  }, [stopHealthCheck]);

  const startTaskWithSSE = useCallback(async () => {
    setTaskRunning(true);
    lastActivityTimeRef.current = Date.now();
    setReconnectAttempts(0);

    // Connect to SSE
    connectSSE();

    // Start health check
    startHealthCheck();

    // Start the task
    try {
      const response = await fetch(`${API_URL}/task-runner/start`, { method: 'POST' });
      const data = await response.json();

      // If backend says already running, just connect to existing task
      if (!response.ok && data.message?.includes('already running')) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '⚠️ Task already running. Connected to existing task.',
          type: 'warning'
        }]);
      }
    } catch (err) {
      console.error('Error starting task:', err);
      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '❌ Failed to start task',
        type: 'error'
      }]);
      setTaskRunning(false);
      stopHealthCheck();
    }
  }, [connectSSE, startHealthCheck, stopHealthCheck]);

  // Update ref whenever startTaskWithSSE changes
  useEffect(() => {
    startTaskWithSSERef.current = startTaskWithSSE;
  }, [startTaskWithSSE]);

  const fetchLogsHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/task-runner/logs-history`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      }
      if (data.isRunning) {
        // Don't auto-reconnect if user intentionally stopped
        // Only reconnect if page was refreshed while task was running
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '🔄 Detected running task from previous session. Reconnecting...',
          type: 'info'
        }]);
        setTaskRunning(true);
        connectSSE();
        startHealthCheck();
      }
    } catch (err) {
      // Silently fail when backend is not running (development mode)
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        // Backend not running - this is expected in development
        return;
      }
      console.error('Error fetching logs history:', err);
    }
  }, [connectSSE, startHealthCheck]);

  // ===== END: Refactored SSE Logic =====

  // Fetch files when pagination or filter changes
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Fetch logs history only on mount
  useEffect(() => {
    fetchLogsHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
      const response = await fetch(`${API_URL}/files/upload`, {
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
      await fetch(`${API_URL}/files/${id}`, { method: 'DELETE' });
      fetchFiles();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  // Smooth auto-scroll with throttling
  useEffect(() => {
    if (!autoScrollEnabled || !terminalBodyRef.current) return;

    // Cancel any pending scroll animation
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }

    // Use requestAnimationFrame to throttle scroll updates
    scrollAnimationRef.current = requestAnimationFrame(() => {
      if (terminalBodyRef.current) {
        terminalBodyRef.current.scrollTo({
          top: terminalBodyRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });

    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, [logs, autoScrollEnabled]);

  // Detect user scroll and pause auto-scroll
  useEffect(() => {
    const terminalBody = terminalBodyRef.current;
    if (!terminalBody) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = terminalBody;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

      // If user scrolled away from bottom, pause auto-scroll
      if (!isAtBottom && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
      // If user scrolled back to bottom, resume auto-scroll
      else if (isAtBottom && !autoScrollEnabled) {
        setAutoScrollEnabled(true);
      }
    };

    terminalBody.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      terminalBody.removeEventListener('scroll', handleScroll);
    };
  }, [autoScrollEnabled]);

  useEffect(() => {
    // Cleanup SSE and timeouts on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHealthCheck();
    };
  }, [stopHealthCheck]);

  const handleStartTask = useCallback(async () => {
    if (taskRunningRef.current) {
      console.log('Task already running (frontend state)');
      return;
    }

    if (files.length === 0) {
      setError('No files to process');
      return;
    }

    // Check backend status before starting
    try {
      const statusRes = await fetch(`${API_URL}/task-runner/status`);
      const statusData = await statusRes.json();

      if (statusData.isRunning) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '⚠️ Task is already running on backend. Reconnecting...',
          type: 'warning'
        }]);

        // Sync frontend state with backend
        setTaskRunning(true);
        connectSSE();
        startHealthCheck();
        return;
      }
    } catch (err) {
      console.error('Error checking task status:', err);
    }

    setLogs((prev) => [...prev, {
      timestamp: new Date().toISOString(),
      thread: 0,
      message: '🔄 Starting Infinite Worker Loop... (triggered by user click)',
      type: 'info'
    }]);

    await startTaskWithSSE();
  }, [files.length, startTaskWithSSE, connectSSE, startHealthCheck]);

  const handleStopTask = async () => {
    try {
      // Cancel any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Stop health check
      stopHealthCheck();

      // Close SSE connection first
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Send stop request
      await fetch(`${API_URL}/task-runner/stop`, { method: 'POST' });

      // Wait a bit and verify backend stopped
      await new Promise(resolve => setTimeout(resolve, 500));

      const statusRes = await fetch(`${API_URL}/task-runner/status`);
      const statusData = await statusRes.json();

      if (statusData.isRunning) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '⚠️ Backend task is still running. It may take a moment to stop...',
          type: 'warning'
        }]);

        // Wait for backend to actually stop (max 5 seconds)
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const checkRes = await fetch(`${API_URL}/task-runner/status`);
          const checkData = await checkRes.json();

          if (!checkData.isRunning) {
            break;
          }
        }
      }

      setTaskRunning(false);
    } catch (err) {
      console.error('Error stopping task:', err);
      setTaskRunning(false);
    }
  };


  const handleRemoveAll = async () => {
    setRemoving(true);
    try {
      await fetch(`${API_URL}/files/clear`, { method: 'POST' });
      await fetch(`${API_URL}/task-runner/clear-logs`, { method: 'POST' });
      setShowRemoveConfirm(false);
      fetchFiles();
      setLogs([]);
    } catch (err) {
      console.error('Error removing:', err);
      setError('Failed to remove files');
    } finally {
      setRemoving(false);
    }
  };

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      await fetch(`${API_URL}/files/reset-processed`, { method: 'POST' });
      setShowResetConfirm(false);
      fetchFiles();
      setError(null);
    } catch (err) {
      console.error('Error resetting:', err);
      setError('Failed to reset progress');
    } finally {
      setResetting(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (type: LogMessage['type']) => {
    switch (type) {
      case 'success': return '#27ca40';
      case 'error': return '#ff5f56';
      case 'warning': return '#ffbd2e';
      default: return '#a0a0b0';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getImportantLogs = () => {
    // Filter out repetitive "waiting" messages, keep only important logs
    const filtered: LogMessage[] = [];
    let lastWaitingIndex = -1;

    logs.forEach((log, index) => {
      const isWaiting = log.message.includes('No unprocessed files. Waiting');

      if (isWaiting) {
        // Keep track of last waiting message
        lastWaitingIndex = index;
      } else {
        filtered.push(log);
      }
    });

    // Add the most recent waiting message if exists
    if (lastWaitingIndex !== -1) {
      filtered.push(logs[lastWaitingIndex]);
    }

    // Keep only last 5 important logs in compact mode
    return filtered.slice(-5);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-start gap-5 mb-8">
            {/* Stage Badge */}
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/25">
              <span className="text-white font-bold text-xl">01</span>
            </div>
            <div>
              <h1 className="m-0 mb-2 text-2xl font-bold text-text-primary">Stage 01: Raw Images</h1>
              <p className="m-0 text-text-secondary text-sm">Upload and manage raw document images before grouping</p>
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-500/10 to-red-500/5 text-red-400 p-4 rounded-xl mb-6 border border-red-500/20 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {!backendConnected && (
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 p-4 rounded-xl mb-6 border border-amber-500/20 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Backend server is not running. Start backend with: <code className="bg-black/20 px-2 py-0.5 rounded font-mono text-sm">cd ../backend && npm run dev</code></span>
            </div>
          )}

          {/* Status Cards */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Current Status</h2>
            </div>

            {/* Progress Bar */}
            {totalAllFiles > 0 && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-accent/5 to-transparent border border-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-primary">Processing Progress</span>
                  <span className="text-sm font-semibold text-accent">
                    {processedCount}/{totalAllFiles} ({totalAllFiles > 0 ? Math.round((processedCount / totalAllFiles) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-border-color/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-emerald-500 transition-all duration-500 ease-out rounded-full"
                    style={{
                      width: `${totalAllFiles > 0 ? (processedCount / totalAllFiles) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-emerald-400">✓ {processedCount} Processed</span>
                  <span className="text-amber-400">○ {pendingCount} Pending</span>
                  {lastActivityTime && taskRunning && (
                    <span className="text-text-secondary">
                      Last: {Math.floor((Date.now() - lastActivityTime.getTime()) / 1000)}s ago
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                <span className="block text-accent text-sm font-medium mb-2">Total Images</span>
                <span className="block text-4xl font-bold text-text-primary">{totalAllFiles || totalFiles}</span>
                <span className="block text-xs text-accent/70 mt-2">
                  {viewMode === 'all'
                    ? `Showing ${files.length} of ${totalFiles} files`
                    : `Progress Mode: ${totalFiles} pending files`}
                </span>
              </div>
              <div className={`bg-gradient-to-br p-5 rounded-xl border ${
                totalAllFiles === 0
                  ? 'from-warning/10 to-warning/5 border-warning/20'
                  : taskRunning
                    ? 'from-accent/10 to-accent/5 border-accent/20'
                    : pendingCount > 0
                      ? 'from-warning/10 to-warning/5 border-warning/20'
                      : 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
              }`}>
                <span className={`block text-sm font-medium mb-2 ${
                  totalAllFiles === 0 || pendingCount > 0 ? 'text-warning' : taskRunning ? 'text-accent' : 'text-emerald-400'
                }`}>Status</span>
                <div className="flex items-center gap-2.5 text-xl font-semibold my-2">
                  {totalAllFiles === 0 ? (
                    <><span className="w-3 h-3 bg-warning rounded-full"></span> <span className="text-text-primary">No Images</span></>
                  ) : taskRunning ? (
                    <><span className="w-3 h-3 bg-accent rounded-full animate-pulse"></span> <span className="text-text-primary">Processing...</span></>
                  ) : pendingCount > 0 ? (
                    <><span className="w-3 h-3 bg-warning rounded-full"></span> <span className="text-text-primary">Ready</span></>
                  ) : (
                    <><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> <span className="text-text-primary">All Processed</span></>
                  )}
                </div>
                <span className={`block text-xs mt-2 ${
                  totalAllFiles === 0 || pendingCount > 0 ? 'text-warning/70' : taskRunning ? 'text-accent/70' : 'text-emerald-400/70'
                }`}>
                  {totalAllFiles === 0
                    ? 'Upload images to 01-raw/'
                    : taskRunning
                    ? `Processing files... (${pendingCount} remaining)`
                    : pendingCount > 0
                    ? `${pendingCount} files waiting to be processed`
                    : 'All files have been processed'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6 flex-wrap items-center">
            <button
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white font-semibold text-sm shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
              onClick={() => setShowUploadModal(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Images
            </button>

            {/* View Mode Toggle */}
            {totalAllFiles > 0 && (
              <div className="flex bg-card-bg/80 backdrop-blur-sm rounded-xl p-1 border border-border-color/50">
                <button
                  onClick={() => {
                    setViewMode('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'all'
                      ? 'bg-gradient-to-r from-accent to-purple-600 text-white shadow-md'
                      : 'text-text-secondary hover:text-text-primary hover:bg-accent/10'
                  }`}
                >
                  All Files
                </button>
                <button
                  onClick={() => {
                    setViewMode('progress');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    viewMode === 'progress'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-text-secondary hover:text-text-primary hover:bg-warning/10'
                  }`}
                >
                  Progress ({pendingCount})
                </button>
              </div>
            )}

            {processedCount > 0 && (
              <button
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={() => setShowResetConfirm(true)}
                disabled={taskRunning || resetting}
              >
                Reset Progress
              </button>
            )}
            {totalAllFiles > 0 && (
              <button
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold text-sm shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={taskRunning || removing}
              >
                Remove All
              </button>
            )}
          </div>

      {showUploadModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={handleCloseUploadModal}>
          <div className="bg-card-bg rounded-2xl w-[90%] max-w-[600px] max-h-[90vh] overflow-hidden border border-border-color shadow-[0_20px_60px_rgba(0,0,0,0.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-color">
              <h2 className="m-0 text-xl font-semibold">Upload Images</h2>
              <button
                className="bg-none border-none text-[1.75rem] text-text-secondary cursor-pointer p-0 leading-none transition-colors duration-200 hover:text-text-primary disabled:opacity-50"
                onClick={handleCloseUploadModal}
                disabled={uploading}
              >
                ×
              </button>
            </div>
            <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
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
                  <h3 className="m-0 mb-4 text-base">Selected ({allSelectedFiles.length} files)</h3>

                  {/* Preview grid - only show first few files */}
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
                      {/* Progress bar */}
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
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="flex-1 bg-accent text-white border-none px-6 py-3 rounded-lg text-base font-medium cursor-pointer transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading
                        ? `Uploading ${uploadProgress ? `${uploadProgress.uploaded}/${uploadProgress.total}` : '...'}`
                        : `Upload ${allSelectedFiles.length} files`}
                    </button>
                    {uploading && (
                      <button
                        onClick={handleCancelUpload}
                        className="px-6 py-3 border border-danger text-danger bg-transparent rounded-lg text-base font-medium cursor-pointer transition-all duration-200 hover:bg-danger hover:text-white"
                      >
                        Cancel
                      </button>
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
            </div>
          </div>
        </div>
      )}

          {/* Terminal */}
          <div className="bg-[#1a1b26] rounded-2xl overflow-hidden mb-6 border border-[#2d2f3d]/50 shadow-xl">
            <div className="flex items-center gap-3 px-5 py-3.5 bg-[#16171f] border-b border-[#2d2f3d]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                <span className="w-3 h-3 rounded-full bg-[#27ca40]"></span>
              </div>
              <span className="text-[#a0a0b0] text-sm font-mono">task-01-raw-to-group.py</span>
              {taskRunning && (
                <span className="flex items-center gap-2 bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Running
                </span>
              )}
              {logs.length > 0 && (
                <button
                  className="ml-4 px-3 py-1.5 border border-[#5a5a6a]/50 bg-[#2a2a3a] text-[#c0c0d0] rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:border-accent/50 hover:text-accent hover:bg-accent/10"
                  onClick={() => setTerminalCompact(!terminalCompact)}
                  title={terminalCompact ? 'Show full logs' : 'Show compact mode'}
                >
                  {terminalCompact ? '📋 Full Logs' : '📊 Compact'}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                {!autoScrollEnabled && logs.length > 0 && (
                  <button
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-medium cursor-pointer transition-all duration-200 shadow-lg shadow-blue-500/25 hover:-translate-y-0.5"
                    onClick={() => setAutoScrollEnabled(true)}
                    title="Resume auto-scroll to bottom"
                  >
                    ↓ Resume Scroll
                  </button>
                )}
                {!taskRunning ? (
                  <button
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-xs font-semibold cursor-pointer transition-all duration-200 shadow-lg shadow-accent/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={handleStartTask}
                    disabled={files.length === 0}
                    title="Start infinite worker loop"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium cursor-pointer transition-all duration-200 shadow-lg shadow-red-500/25 hover:-translate-y-0.5"
                    onClick={handleStopTask}
                    title="Stop worker loop"
                  >
                    Stop
                  </button>
                )}
                {logs.length > 0 && (
                  <button
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium cursor-pointer transition-all duration-200 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={handleClearLogs}
                    disabled={taskRunning}
                    title="Clear logs"
                  >
                    Clear Log
                  </button>
                )}
              </div>
            </div>
            <div className={`p-5 overflow-y-auto font-mono ${terminalCompact ? 'min-h-[120px] max-h-[200px]' : 'min-h-[200px] max-h-[400px]'}`} ref={terminalBodyRef}>
          {logs.length === 0 ? (
            <p className="m-0 text-[#a0a0b0] text-[0.9rem] leading-relaxed">
              {taskRunning
                ? '∞ Worker Loop is running...'
                : 'Click "Start" to begin processing files...'}
            </p>
          ) : terminalCompact ? (
            <>
              {/* Compact Mode: Summary + Important Logs */}
              <div className="mb-4 p-3 bg-[#2a2a3a] rounded-lg border border-[#3a3a4a]">
                <div className="flex items-center justify-between text-[0.85rem]">
                  <span className="text-[#7aa2f7] font-semibold">📊 Summary</span>
                  <span className="text-[#a0a0b0]">{logs.length} total logs</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[0.8rem]">
                  <div className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    <span className="text-[#a0a0b0]">Processed: {processedCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-warning">○</span>
                    <span className="text-[#a0a0b0]">Pending: {pendingCount}</span>
                  </div>
                </div>
                {taskRunning && lastActivityTime && (
                  <div className="mt-2 text-[0.75rem] text-[#7aa2f7]">
                    ⏱️ Last activity: {Math.floor((Date.now() - lastActivityTime.getTime()) / 1000)}s ago
                  </div>
                )}
              </div>

              {/* Recent Important Logs */}
              <div className="space-y-1">
                <div className="text-[#7aa2f7] text-[0.75rem] font-semibold mb-2">Recent Activity:</div>
                {getImportantLogs().map((log, idx) => (
                  <div key={idx} className="m-0 py-0.5 text-[0.8rem] leading-normal flex gap-2 flex-wrap">
                    <span className="text-[#6a6a7a] flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                    {log.thread > 0 && (
                      <span className="text-[#7aa2f7] font-medium flex-shrink-0">[T{log.thread}]</span>
                    )}
                    <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Full Logs Mode */
            logs.map((log, idx) => (
              <div key={idx} className="m-0 py-0.5 text-[0.85rem] leading-normal flex gap-2 flex-wrap">
                <span className="text-[#6a6a7a] flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                {log.thread > 0 && (
                  <span className="text-[#7aa2f7] font-medium flex-shrink-0">[T{log.thread}]</span>
                )}
                <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

          {/* Files Table */}
          {totalAllFiles > 0 && (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="m-0 text-lg font-semibold text-text-primary">
                    {viewMode === 'all'
                      ? `Uploaded Files (${totalFiles} total)`
                      : `Files to Process (${totalFiles} remaining)`}
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
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">#</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">Preview</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">File Name</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">Status</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">Created</th>
                      <th className="p-4 text-left font-semibold text-accent text-sm whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-text-secondary">
                          {viewMode === 'progress'
                            ? '🎉 All files have been processed!'
                            : 'No files found'}
                        </td>
                      </tr>
                    ) : (
                      files.map((file) => (
                        <tr key={file.id} className="border-b border-border-color/30 transition-colors duration-200 last:border-b-0 hover:bg-accent/5">
                          <td className="p-4 text-accent text-sm font-bold font-mono">#{file.fileNumber}</td>
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
                            {file.processed ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-semibold whitespace-nowrap">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                Processed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-semibold whitespace-nowrap">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                                Pending
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
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-xs font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-accent/20"
                                title="View full image"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete ${file.originalName}?`)) {
                                    handleDelete(file.id);
                                  }
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-red-500/20"
                                title="Delete file"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and 2 pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
                              page === currentPage
                                ? 'bg-gradient-to-r from-accent to-purple-600 text-white font-semibold shadow-md shadow-accent/25'
                                : 'bg-card-bg/80 text-text-primary border border-border-color/50 hover:bg-accent/10 hover:border-accent/50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-2 text-text-secondary select-none">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Remove All Confirmation Dialog */}
          {showRemoveConfirm && (
            <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowRemoveConfirm(false)}>
              <div className="bg-card-bg/95 backdrop-blur-xl p-8 rounded-2xl max-w-[400px] w-[90%] shadow-2xl border border-border-color/50" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="m-0 mb-3 text-xl font-bold text-text-primary">Remove All Files?</h2>
                <p className="my-2 text-text-secondary text-sm">This will delete all {files.length} files and their data from the system.</p>
                <p className="text-red-400 text-sm mt-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 px-5 py-3 rounded-xl bg-card-bg border border-border-color/50 text-text-primary font-semibold text-sm cursor-pointer transition-all duration-200 hover:bg-accent/10 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setShowRemoveConfirm(false)}
                    disabled={removing}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold text-sm cursor-pointer transition-all duration-200 shadow-lg shadow-red-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={handleRemoveAll}
                    disabled={removing}
                  >
                    {removing ? 'Removing...' : 'Remove All'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Progress Confirmation Dialog */}
          {showResetConfirm && (
            <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowResetConfirm(false)}>
              <div className="bg-card-bg/95 backdrop-blur-xl p-8 rounded-2xl max-w-[400px] w-[90%] shadow-2xl border border-border-color/50" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h2 className="m-0 mb-3 text-xl font-bold text-text-primary">Reset Processing Status?</h2>
                <p className="my-2 text-text-secondary text-sm">This will mark all {files.filter(f => f.processed).length} processed files as unprocessed.</p>
                <p className="text-amber-400 text-sm mt-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Files will not be deleted, only reset for reprocessing.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 px-5 py-3 rounded-xl bg-card-bg border border-border-color/50 text-text-primary font-semibold text-sm cursor-pointer transition-all duration-200 hover:bg-accent/10 hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resetting}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm cursor-pointer transition-all duration-200 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={handleResetProgress}
                    disabled={resetting}
                  >
                    {resetting ? 'Resetting...' : 'Reset Progress'}
                  </button>
                </div>
              </div>
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
                      File #{previewFile.fileNumber} •{' '}
                      {previewFile.processed ? (
                        <span className="text-emerald-400">✓ Processed</span>
                      ) : (
                        <span className="text-amber-400">○ Pending</span>
                      )}
                      {' '}• Created: {new Date(previewFile.createdAt).toLocaleString('th-TH', {
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
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `${API_URL}/files/${previewFile.id}/preview`;
                      link.download = previewFile.originalName;
                      link.click();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white font-medium text-sm cursor-pointer transition-all duration-200 shadow-lg shadow-accent/25 hover:-translate-y-0.5"
                    title="Download image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${previewFile.originalName}?`)) {
                        handleDelete(previewFile.id);
                        setPreviewFile(null);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium text-sm cursor-pointer transition-all duration-200 shadow-lg shadow-red-500/25 hover:-translate-y-0.5"
                    title="Delete file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
