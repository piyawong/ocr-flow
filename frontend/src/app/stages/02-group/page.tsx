'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface GroupedFile {
  id: number;
  groupId: number;
  orderInGroup: number;
  originalRawFileId: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  ocrText: string;
  isBookmark: boolean;
  createdAt: string;
}

interface GroupMetadata {
  groupId: number;
  fileCount: number;
  isComplete: boolean;
  completedAt: string | null;
  isAutoLabeled: boolean;
  labeledAt: string | null;
  createdAt: string;
}

interface GroupData {
  groupId: number;
  files: GroupedFile[]; // Lazy loaded when clicked
  fileCount: number; // From metadata
  isComplete?: boolean;
  isAutoLabeled?: boolean;
  labeledCount?: number;
  matchPercentage?: number;
}

interface LabeledStats {
  totalGroups: number;
  totalLabeled: number;
  totalPages: number;
  labeledPages: number;
  matchPercentage: number;
  groupStats: Map<number, { labeled: number; total: number; percentage: number }>;
}

interface LogMessage {
  timestamp: string;
  thread: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

export default function Stage02Group() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupCount, setGroupCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [taskRunning, setTaskRunning] = useState(false);
  const [labeledStats, setLabeledStats] = useState<LabeledStats | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [infinityLoopMode, setInfinityLoopMode] = useState(false);
  const [showLabeledGroups, setShowLabeledGroups] = useState(false);
  const [terminalCompact, setTerminalCompact] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const groupEventSourceRef = useRef<EventSource | null>(null);
  const taskRunnerEventSourceRef = useRef<EventSource | null>(null);
  const infinityLoopModeRef = useRef(infinityLoopMode);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const hasUnprocessedGroups = useCallback((groupsList?: GroupData[]) => {
    const checkGroups = groupsList || groups;
    // Groups ready to label: isComplete = true AND isAutoLabeled = false
    return checkGroups.some(g => g.isComplete && !g.isAutoLabeled);
  }, [groups]);

  const fetchLabeledStats = useCallback(async (updateGroups: boolean = false) => {
    try {
      // Fetch groups metadata (isComplete, isAutoLabeled)
      const metadataRes = await fetch(`${API_URL}/files/groups-metadata`);
      const metadataData = await metadataRes.json();
      const groupsMetadata = new Map<number, GroupMetadata>();
      (metadataData.groups || []).forEach((g: GroupMetadata) => {
        groupsMetadata.set(g.groupId, g);
      });

      // Only update groups if requested (to avoid flickering)
      if (updateGroups) {
        setGroups(prev => prev.map(group => {
          const metadata = groupsMetadata.get(group.groupId);
          return {
            ...group,
            isComplete: metadata?.isComplete || false,
            isAutoLabeled: metadata?.isAutoLabeled || false,
          };
        }));
      }

      const labeledGroups = Array.from(groupsMetadata.values()).filter(g => g.isAutoLabeled);
      if (labeledGroups.length === 0) {
        setLabeledStats(null);
        return;
      }

      // Fetch labeled files for stats
      const res = await fetch(`${API_URL}/labeled-files`);
      const data = await res.json();

      if (!data.files || data.files.length === 0) {
        setLabeledStats(null);
        return;
      }

      // Calculate stats per group
      const groupStatsMap = new Map<number, { labeled: number; total: number; percentage: number }>();

      data.files.forEach((file: any) => {
        const groupNum = file.groupId;
        if (!groupStatsMap.has(groupNum)) {
          groupStatsMap.set(groupNum, { labeled: 0, total: 0, percentage: 0 });
        }
        const stats = groupStatsMap.get(groupNum)!;
        stats.total++;
        if (file.labelStatus !== 'unmatched') {
          stats.labeled++;
        }
      });

      // Calculate percentages
      groupStatsMap.forEach((stats) => {
        stats.percentage = stats.total > 0 ? (stats.labeled / stats.total) * 100 : 0;
      });

      // Overall stats
      const totalPages = data.files.length;
      const labeledPages = data.files.filter((f: any) => f.labelStatus !== 'unmatched').length;
      const matchPercentage = totalPages > 0 ? (labeledPages / totalPages) * 100 : 0;

      setLabeledStats({
        totalGroups: groupStatsMap.size,
        totalLabeled: groupStatsMap.size,
        totalPages,
        labeledPages,
        matchPercentage,
        groupStats: groupStatsMap,
      });
    } catch (err) {
      console.error('Error fetching labeled stats:', err);
      setLabeledStats(null);
    }
  }, []);

  const fetchGroups = useCallback(async (showLabeled?: boolean) => {
    try {
      // Use parameter or current state
      const shouldShowLabeled = showLabeled !== undefined ? showLabeled : showLabeledGroups;

      // Fetch only group metadata (no files)
      const res = await fetch(`${API_URL}/files/groups-metadata`);
      const data = await res.json();
      const groupsMetadata: GroupMetadata[] = data.groups || [];

      // Filter: based on toggle state
      const filteredGroups = shouldShowLabeled
        ? groupsMetadata.filter(meta => meta.isAutoLabeled) // แสดง groups ที่ label แล้ว
        : groupsMetadata.filter(meta => !meta.isAutoLabeled); // แสดง groups ที่ยังไม่ label

      // Sort: เรียงตาม createdAt มากไปน้อย (ล่าสุดก่อน)
      filteredGroups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Convert to GroupData format
      const groupsArray: GroupData[] = filteredGroups.map((meta) => ({
        groupId: meta.groupId,
        files: [], // Will be lazy loaded when clicked
        fileCount: meta.fileCount,
        isComplete: meta.isComplete,
        isAutoLabeled: meta.isAutoLabeled,
      }));

      setGroups(groupsArray);
      setGroupCount(groupsArray.length);

      // Calculate total files from fileCount
      const totalFiles = groupsArray.reduce((sum, g) => sum + g.fileCount, 0);
      setTotalFiles(totalFiles);

      // Fetch labeled stats after groups (with group update)
      await fetchLabeledStats(true);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  }, [fetchLabeledStats, showLabeledGroups]);

  const connectToLogs = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/label-runner/logs`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);

        // Update last activity time
        lastActivityTimeRef.current = Date.now();
        setLastActivityTime(new Date());

        // Check for GROUP_PROCESSED event
        if (log.message.startsWith('GROUP_PROCESSED:')) {
          const parts = log.message.split(':');
          const groupNum = parseInt(parts[1]);
          const matched = parseInt(parts[2]);
          const total = parseInt(parts[3]);
          const percentage = (matched / total) * 100;

          // Remove labeled group from list (since table shows only unlabeled groups)
          setGroups((prevGroups) => {
            const filtered = prevGroups.filter((group) => group.groupId !== groupNum);
            // Update counts
            setGroupCount(filtered.length);
            const newTotalFiles = filtered.reduce((sum, g) => sum + g.fileCount, 0);
            setTotalFiles(newTotalFiles);
            return filtered;
          });

          // Add success log to terminal
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            thread: 0,
            message: `✅ Group ${groupNum} labeled: ${matched}/${total} pages matched (${percentage.toFixed(1)}%)`,
            type: 'success'
          }]);

          // Refresh stats
          setTimeout(() => fetchLabeledStats(false), 500);
          return;
        }

        setLogs((prev) => [...prev, log]);
      } catch (e) {
        console.error('Error parsing log:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };
  }, [fetchGroups, fetchLabeledStats, infinityLoopMode, hasUnprocessedGroups]);


  // Sync ref with state
  useEffect(() => {
    infinityLoopModeRef.current = infinityLoopMode;
  }, [infinityLoopMode]);

  useEffect(() => {
    fetchGroups();
    fetchLogsHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Refetch when toggle changes
  useEffect(() => {
    fetchGroups(showLabeledGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLabeledGroups]);


  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Removed: Polling for ready-to-label groups (replaced by SSE GROUP_COMPLETE events)

  // Listen for GROUP_COMPLETE events from backend (realtime via SSE)
  // ⚠️ SSE connects always, regardless of Infinity Loop mode
  useEffect(() => {
    if (groupEventSourceRef.current) {
      groupEventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/files/events`);
    groupEventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'GROUP_COMPLETE') {
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            thread: 0,
            message: `📦 SSE: Group ${data.groupId} is now complete and ready to label`,
            type: 'info'
          }]);

          // Refetch groups to get new group metadata
          await fetchGroups();

          // ℹ️ Backend infinite loop will auto-detect and process new groups
        }
      } catch (e) {
        console.error('Error parsing group event:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('Group events SSE connection error');
    };

    return () => {
      if (groupEventSourceRef.current) {
        groupEventSourceRef.current.close();
        groupEventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ Connect once on mount, disconnect on unmount

  // Listen for Task Runner (Stage 01) events to update group file counts in real-time
  useEffect(() => {
    if (taskRunnerEventSourceRef.current) {
      taskRunnerEventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/task-runner/logs`);
    taskRunnerEventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const log: LogMessage = JSON.parse(event.data);

        // Listen for "File #X is BOOKMARK - created new Group ID=Y"
        const newGroupMatch = log.message.match(/created (?:new|initial) Group ID=(\d+)/);
        if (newGroupMatch) {
          const groupId = parseInt(newGroupMatch[1]);

          // Check if group already exists
          setGroups((prevGroups) => {
            const exists = prevGroups.some(g => g.groupId === groupId);
            if (!exists) {
              // Add new group to list
              const newGroup: GroupData = {
                groupId,
                files: [],
                fileCount: 0,
                isComplete: false,
                isAutoLabeled: false,
              };
              setGroupCount((prev) => prev + 1);
              return [...prevGroups, newGroup].sort((a, b) => a.groupId - b.groupId);
            }
            return prevGroups;
          });
        }

        // Listen for "Grouped #X → Group ID=Y, Order Z" messages
        const groupedMatch = log.message.match(/Grouped #(\d+) → Group ID=(\d+), Order (\d+)/);
        if (groupedMatch) {
          const groupId = parseInt(groupedMatch[2]);
          const orderInGroup = parseInt(groupedMatch[3]);

          // Update group file count and total files in real-time
          setGroups((prevGroups) => {
            const updated = prevGroups.map((group) =>
              group.groupId === groupId
                ? { ...group, fileCount: orderInGroup }
                : group
            );

            // Recalculate total files from all groups
            const newTotal = updated.reduce((sum, g) => sum + g.fileCount, 0);
            setTotalFiles(newTotal);

            return updated;
          });
        }
      } catch (e) {
        console.error('Error parsing task-runner log:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('Task-runner events SSE connection error');
    };

    return () => {
      if (taskRunnerEventSourceRef.current) {
        taskRunnerEventSourceRef.current.close();
        taskRunnerEventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ⚠️ Connect once on mount

  // Removed: Background polling for groups metadata (fetch on demand instead)

  useEffect(() => {
    // Cleanup SSE on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (groupEventSourceRef.current) {
        groupEventSourceRef.current.close();
      }
    };
  }, []);

  const fetchLogsHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/label-runner/logs-history`);
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      }

      // ✅ Restore task if it's running on backend
      if (data.isRunning) {
        setLogs((prev) => [...prev, {
          timestamp: new Date().toISOString(),
          thread: 0,
          message: '🔄 Detected running task. Reconnecting...',
          type: 'info'
        }]);
        setTaskRunning(true);
        setInfinityLoopMode(true);
        connectToLogs();
      } else {
        // ✅ Auto-start if infinity mode was ON before refresh
        const savedMode = localStorage.getItem('infinityLoopMode02');
        if (savedMode === 'true') {
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            thread: 0,
            message: '🔄 Infinity Loop Mode restored. Starting worker...',
            type: 'info'
          }]);
          setInfinityLoopMode(true);
          setTaskRunning(true);
          connectToLogs();
          setTimeout(async () => {
            try {
              await fetch(`${API_URL}/label-runner/start`, { method: 'POST' });
            } catch (err) {
              console.error('Error auto-starting task:', err);
              setTaskRunning(false);
            }
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Error fetching logs history:', err);
    }
  };

  const handleStartTask = async () => {
    if (taskRunning) return;

    setTaskRunning(true);
    connectToLogs();

    try {
      await fetch(`${API_URL}/label-runner/start`, { method: 'POST' });
    } catch (err) {
      console.error('Error starting task:', err);
      setTaskRunning(false);
    }
  };

  const handleStopTask = async () => {
    try {
      await fetch(`${API_URL}/label-runner/stop`, { method: 'POST' });
      setTaskRunning(false);
    } catch (err) {
      console.error('Error stopping task:', err);
    }
  };

  const handleInfinityToggle = useCallback(async () => {
    if (taskRunning) {
      // Currently running → STOP
      setInfinityLoopMode(false);
      localStorage.setItem('infinityLoopMode02', 'false');

      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '⏹️ Stopping Infinity Loop Worker...',
        type: 'warning'
      }]);

      await handleStopTask();
    } else {
      // Currently stopped → START
      setInfinityLoopMode(true);
      localStorage.setItem('infinityLoopMode02', 'true');

      setLogs((prev) => [...prev, {
        timestamp: new Date().toISOString(),
        thread: 0,
        message: '🔄 Starting Infinity Loop Worker...',
        type: 'info'
      }]);

      setTaskRunning(true);
      connectToLogs();
      try {
        await fetch(`${API_URL}/label-runner/start`, { method: 'POST' });
      } catch (err) {
        console.error('Error starting task:', err);
        setTaskRunning(false);
      }
    }
  }, [taskRunning, connectToLogs]);

  const handleClearLogs = async () => {
    try {
      await fetch(`${API_URL}/label-runner/clear-logs`, { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.error('Error clearing logs:', err);
    }
  };

  const addLog = (message: string, type: LogMessage['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      thread: 0,
      message,
      type
    }]);
  };

  const handleGroupClick = async (group: GroupData) => {
    addLog(`Opening Group ${group.groupId} (${group.fileCount} files)`, 'info');

    // Lazy load files if not already loaded
    if (group.files.length === 0 && group.fileCount > 0) {
      try {
        const res = await fetch(`${API_URL}/files/group/${group.groupId}`);
        const data = await res.json();

        // Update group with loaded files
        const updatedGroup = {
          ...group,
          files: data.files || [],
        };

        setSelectedGroup(updatedGroup);

        // Update groups state to cache loaded files
        setGroups(prevGroups =>
          prevGroups.map(g =>
            g.groupId === group.groupId ? updatedGroup : g
          )
        );
      } catch (err) {
        console.error('Error loading group files:', err);
        addLog(`Failed to load files for Group ${group.groupId}`, 'error');
      }
    } else {
      setSelectedGroup(group);
    }
  };

  const closeModal = () => {
    if (selectedGroup) {
      addLog(`Closed Group ${selectedGroup.groupId}`, 'info');
    }
    setSelectedGroup(null);
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

  const handleRevertAll = async () => {
    setReverting(true);
    try {
      // Clear both files grouping AND labeled_files to maintain consistency
      await fetch(`${API_URL}/files/clear-grouping`, { method: 'POST' });
      await fetch(`${API_URL}/labeled-files/clear`, { method: 'POST' });
      await fetch(`${API_URL}/label-runner/clear-logs`, { method: 'POST' });
      setShowRevertConfirm(false);
      fetchGroups();
      setLogs([]);
    } catch (err) {
      console.error('Error reverting:', err);
      addLog('Failed to clear grouped files', 'error');
    } finally {
      setReverting(false);
    }
  };

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      await fetch(`${API_URL}/labeled-files/clear`, { method: 'POST' });
      await fetch(`${API_URL}/label-runner/clear-logs`, { method: 'POST' });
      setShowResetConfirm(false);
      fetchGroups();
      setLogs([]);
    } catch (err) {
      console.error('Error resetting:', err);
      addLog('Failed to reset label progress', 'error');
    } finally {
      setResetting(false);
    }
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
              <span className="text-white font-bold text-xl">02</span>
            </div>
            <div>
              <h1 className="m-0 mb-2 text-2xl font-bold text-text-primary">Stage 02: Grouped Documents</h1>
              <p className="m-0 text-text-secondary text-sm">View grouped document sets from OCR processing</p>
            </div>
          </div>

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
            {(labeledStats || groupCount > 0) && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-accent/5 to-transparent border border-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-secondary text-sm font-medium">Labeling Progress</span>
                  <span className="text-text-primary text-sm font-semibold">
                    {labeledStats ? (
                      <>
                        {labeledStats.totalLabeled}/{labeledStats.totalLabeled + groupCount}
                        <span className="text-text-secondary"> ({Math.round((labeledStats.totalLabeled / (labeledStats.totalLabeled + groupCount)) * 100)}%)</span>
                      </>
                    ) : (
                      <>0/{groupCount} <span className="text-text-secondary">(0%)</span></>
                    )}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-border-color/50 rounded-full overflow-hidden">
                  <div className="flex h-full">
                    {/* Labeled portion */}
                    {labeledStats && labeledStats.totalLabeled > 0 && (
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 rounded-full"
                        style={{ width: `${(labeledStats.totalLabeled / (labeledStats.totalLabeled + groupCount)) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-emerald-400">✓ {labeledStats?.totalLabeled || 0} Labeled</span>
                  <span className="text-amber-400">○ {groupCount} Pending</span>
                  {taskRunning && lastActivityTime && (
                    <span className="text-text-secondary">
                      ⏱️ Last: {Math.floor((Date.now() - lastActivityTime.getTime()) / 1000)}s ago
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                <span className="block text-accent text-sm font-medium mb-2">Total Groups</span>
                <span className="block text-4xl font-bold text-text-primary">
                  {labeledStats ? labeledStats.totalLabeled + groupCount : groupCount}
                </span>
                <span className="block text-xs text-accent/70 mt-2">
                  {labeledStats ? `${labeledStats.totalLabeled} labeled, ${groupCount} pending` :
                   groupCount > 0 ? 'document sets created' : 'no groups yet'}
                </span>
              </div>
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 rounded-xl border border-blue-500/20">
                <span className="block text-blue-400 text-sm font-medium mb-2">Total Pages</span>
                <span className="block text-4xl font-bold text-text-primary">
                  {labeledStats ? labeledStats.totalPages + totalFiles : totalFiles}
                </span>
                <span className="block text-xs text-blue-400/70 mt-2">
                  {labeledStats ? `${labeledStats.labeledPages} matched` :
                   totalFiles > 0 ? 'files grouped' : 'no files yet'}
                </span>
              </div>
              <div className={`bg-gradient-to-br p-5 rounded-xl border ${
                labeledStats
                  ? labeledStats.matchPercentage === 100
                    ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
                    : 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
                  : taskRunning
                    ? 'from-accent/10 to-accent/5 border-accent/20'
                    : groupCount > 0
                      ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
                      : 'from-gray-500/10 to-gray-500/5 border-gray-500/20'
              }`}>
                <span className={`block text-sm font-medium mb-2 ${
                  labeledStats
                    ? labeledStats.matchPercentage === 100
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                    : taskRunning
                      ? 'text-accent'
                      : groupCount > 0
                        ? 'text-amber-400'
                        : 'text-gray-400'
                }`}>Status</span>
                <div className="flex items-center gap-2.5 text-xl font-semibold my-2">
                  {labeledStats ? (
                    labeledStats.matchPercentage === 100 ? (
                      <><span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span> <span className="text-text-primary">All Matched</span></>
                    ) : labeledStats.matchPercentage >= 75 ? (
                      <><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> <span className="text-text-primary">Labeled ({labeledStats.matchPercentage.toFixed(0)}%)</span></>
                    ) : (
                      <><span className="w-3 h-3 bg-amber-500 rounded-full"></span> <span className="text-text-primary">Partial ({labeledStats.matchPercentage.toFixed(0)}%)</span></>
                    )
                  ) : taskRunning ? (
                    <><span className="w-3 h-3 bg-accent rounded-full animate-pulse"></span> <span className="text-text-primary">Processing...</span></>
                  ) : groupCount > 0 ? (
                    <><span className="w-3 h-3 bg-amber-500 rounded-full"></span> <span className="text-text-primary">Ready</span></>
                  ) : (
                    <><span className="w-3 h-3 bg-gray-500 rounded-full"></span> <span className="text-text-primary">No Groups</span></>
                  )}
                </div>
                <span className={`block text-xs mt-2 ${
                  labeledStats
                    ? labeledStats.matchPercentage === 100
                      ? 'text-emerald-400/70'
                      : 'text-amber-400/70'
                    : taskRunning
                      ? 'text-accent/70'
                      : groupCount > 0
                        ? 'text-amber-400/70'
                        : 'text-gray-400/70'
                }`}>
                  {labeledStats
                    ? `${labeledStats.labeledPages}/${labeledStats.totalPages} pages matched`
                    : groupCount > 0
                    ? 'Click Start to label groups'
                    : 'Run Task 01 first'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {groups.length > 0 && (
            <div className="flex gap-3 mb-6">
              {labeledStats && (
                <button
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={resetting || taskRunning}
                >
                  Reset Label Progress
                </button>
              )}
              <button
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold text-sm shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                onClick={() => setShowRevertConfirm(true)}
                disabled={reverting || taskRunning}
              >
                Revert All Groups
              </button>
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
              <span className="text-[#a0a0b0] text-sm font-mono">task-02-label-pdf.py</span>
              {taskRunning && (
                <span className="flex items-center gap-2 bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Running
                </span>
              )}
              {infinityLoopMode && (
                <span className="flex items-center gap-2 bg-accent/15 text-accent px-3 py-1.5 rounded-lg text-xs font-semibold" title="Infinity Loop Mode: Auto-restart when unprocessed groups exist">
                  ∞ Loop
                </span>
              )}
          {logs.length > 0 && (
            <button
              className="px-3 py-1.5 border border-[#5a5a6a] rounded text-[0.85rem] font-medium cursor-pointer transition-all duration-200 font-mono bg-[#2a2a3a] text-[#c0c0d0] hover:border-[#7b61ff] hover:text-[#7b61ff] hover:bg-[rgba(123,97,255,0.1)]"
              onClick={() => setTerminalCompact(!terminalCompact)}
              title={terminalCompact ? 'Show full logs' : 'Show compact view'}
            >
              {terminalCompact ? '📋 Full Logs' : '📊 Compact'}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              className={`px-4 py-1.5 border ${taskRunning ? 'border-[#7b61ff] bg-gradient-to-br from-[#7b61ff] to-[#9b7bff] text-white shadow-[0_2px_8px_rgba(123,97,255,0.4)]' : 'border-[#5a5a6a] bg-[#3a3a4a] text-[#c0c0d0] hover:border-[#7b61ff] hover:text-[#7b61ff] hover:bg-[rgba(123,97,255,0.15)] hover:shadow-[0_2px_6px_rgba(123,97,255,0.2)]'} rounded text-[0.85rem] font-semibold cursor-pointer transition-all duration-200 font-mono shadow-[0_1px_3px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={handleInfinityToggle}
              title={taskRunning ? 'Stop Infinity Loop Worker' : 'Start Infinity Loop Worker'}
            >
              {taskRunning ? 'STOP' : 'START'}
            </button>
            {logs.length > 0 && (
              <button
                className="px-4 py-1.5 border-none rounded text-[0.85rem] font-medium cursor-pointer transition-all duration-200 bg-[#ffbd2e] text-[#1a1b26] hover:bg-[#e5a926] disabled:bg-[#4a4a5a] disabled:text-[#808090] disabled:cursor-not-allowed"
                onClick={handleClearLogs}
                disabled={taskRunning}
                title="Clear logs"
              >
                Clear Log
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body */}
        <div className={`p-4 px-6 ${terminalCompact ? 'min-h-[100px]' : 'min-h-[100px] max-h-[400px]'} overflow-y-auto font-mono`} ref={terminalBodyRef}>
          {logs.length === 0 ? (
            <p className="m-0 text-[#a0a0b0] text-[0.85rem]">
              {infinityLoopMode
                ? '∞ Infinity Loop Mode Active - Waiting for groups...'
                : 'Toggle ON to start Infinity Loop...'}
            </p>
          ) : terminalCompact ? (
            // Compact Mode: Show summary + recent important logs
            <div className="space-y-3">
              {/* Summary Section */}
              <div className="bg-[rgba(123,97,255,0.08)] rounded-lg p-3 border border-[rgba(123,97,255,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#7b61ff] text-[0.85rem] font-semibold">📊 Summary</span>
                  <span className="text-[#a0a0b0] text-[0.75rem]">{logs.length} total logs</span>
                </div>
                <div className="flex items-center gap-4 text-[0.75rem]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#27ca40]">✓</span>
                    <span className="text-[#a0a0b0]">Labeled: {labeledStats?.totalLabeled || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#ffbd2e]">○</span>
                    <span className="text-[#a0a0b0]">Pending: {groupCount}</span>
                  </div>
                </div>
                {lastActivityTime && (
                  <div className="text-[0.75rem] text-[#a0a0b0] mt-1">
                    ⏱️ Last activity: {Math.floor((Date.now() - lastActivityTime.getTime()) / 1000)}s ago
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div>
                <div className="text-[#7b61ff] text-[0.75rem] font-semibold mb-1">Recent Activity:</div>
                {logs.slice(-5).filter(log =>
                  !log.message.includes('Waiting for groups') &&
                  !log.message.includes('No groups ready')
                ).slice(-5).map((log, idx) => (
                  <div key={idx} className="m-0 py-0.5 text-[0.85rem] leading-normal flex gap-2">
                    <span className="text-[#6a6a7a] flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                    {log.thread !== undefined && log.thread > 0 && (
                      <span className="text-[#7b61ff] flex-shrink-0">[T{log.thread}]</span>
                    )}
                    <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Full Logs Mode
            logs.map((log, idx) => (
              <div key={idx} className="m-0 py-0.5 text-[0.85rem] leading-normal flex gap-2">
                <span className="text-[#6a6a7a] flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

          {/* Filter Toggle */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-text-secondary text-sm font-medium">View:</span>
                <div className="flex bg-bg-secondary/80 rounded-xl border border-border-color/50 p-1">
                  <button
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                      !showLabeledGroups
                        ? 'bg-gradient-to-r from-accent to-purple-600 text-white shadow-lg shadow-accent/25'
                        : 'text-text-secondary hover:text-text-primary hover:bg-accent/10'
                    }`}
                    onClick={() => setShowLabeledGroups(false)}
                  >
                    Unlabeled
                  </button>
                  <button
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                      showLabeledGroups
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-text-secondary hover:text-text-primary hover:bg-emerald-500/10'
                    }`}
                    onClick={() => setShowLabeledGroups(true)}
                  >
                    Labeled
                  </button>
                </div>
              </div>
              <span className="text-text-secondary text-sm">
                {groupCount} {showLabeledGroups ? 'labeled' : 'unlabeled'} groups
              </span>
            </div>
          </div>

          {/* Groups Table */}
          {groups.length === 0 ? (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-12 text-center border border-border-color/50 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <p className="m-0 mb-2 text-text-primary text-lg font-semibold">
                {showLabeledGroups ? 'No labeled groups yet' : 'No unlabeled groups yet'}
              </p>
              <p className="m-0 text-text-secondary text-sm">
                {showLabeledGroups
                  ? 'Run the label task to process groups'
                  : 'Run Task 01 in Stage 01 to process and group files'}
              </p>
            </div>
          ) : (
            <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-border-color/50 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-accent/10 via-purple-500/5 to-transparent">
                    <th className="p-4 px-5 text-left font-semibold text-accent text-sm uppercase tracking-wider">Group ID</th>
                    <th className="p-4 px-5 text-left font-semibold text-accent text-sm uppercase tracking-wider">File Count</th>
                    <th className="p-4 px-5 text-left font-semibold text-accent text-sm uppercase tracking-wider">Status</th>
                    <th className="p-4 px-5 text-left font-semibold text-accent text-sm uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.groupId} className="border-t border-border-color/30 transition-all duration-200 hover:bg-accent/5">
                      <td className="p-4 px-5 text-text-primary">
                        <div className="flex items-center gap-3 font-semibold text-text-primary">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          Group {group.groupId}
                        </div>
                      </td>
                      <td className="p-4 px-5 text-text-primary">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="font-semibold">{group.fileCount}</span>
                          <span className="text-text-secondary">files</span>
                        </span>
                      </td>
                      <td className="p-4 px-5 text-text-primary">
                        {group.isAutoLabeled ? (
                          (() => {
                            const stats = labeledStats?.groupStats.get(group.groupId);
                            const percentage = stats?.percentage || 0;
                            return percentage === 100 ? (
                              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-500/20">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                100% Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-500/20">
                                <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                                {percentage.toFixed(0)}% Matched
                              </span>
                            );
                          })()
                        ) : !group.isComplete ? (
                          <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-500/20">
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                            Grouping...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500/15 to-blue-500/5 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-500/20">
                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                            Ready to Label
                          </span>
                        )}
                      </td>
                      <td className="p-4 px-5 text-text-primary">
                        <button
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-purple-600 text-white text-sm font-semibold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 transition-all duration-300"
                          onClick={() => handleGroupClick(group)}
                        >
                          View Files
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal */}
          {selectedGroup && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={closeModal}>
              <div className="bg-card-bg/95 backdrop-blur-xl rounded-2xl w-[90%] max-w-[1000px] max-h-[90vh] overflow-hidden border border-border-color/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-4 px-6 py-5 border-b border-border-color/50 bg-gradient-to-r from-accent/10 via-purple-500/5 to-transparent">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/25">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h2 className="m-0 text-xl font-bold text-text-primary">Group {selectedGroup.groupId}</h2>
                  <span className="bg-gradient-to-r from-accent to-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-md shadow-accent/20">
                    {selectedGroup.files.length > 0 ? selectedGroup.files.length : selectedGroup.fileCount} files
                  </span>
                  <button className="ml-auto w-10 h-10 rounded-xl bg-bg-secondary/80 border border-border-color/50 text-text-secondary cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400" onClick={closeModal}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
                  {selectedGroup.files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 animate-pulse">
                        <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-text-secondary text-sm">Loading files...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                      {selectedGroup.files.map((file) => (
                        <div key={file.id} className="bg-bg-secondary/80 rounded-xl overflow-hidden border border-border-color/50 shadow-sm hover:shadow-md hover:border-accent/30 transition-all duration-300">
                          <img
                            src={`${API_URL}/files/${file.id}/preview`}
                            alt={file.originalName}
                            className="w-full h-[180px] object-cover"
                          />
                          <div className="p-3 flex items-center gap-2">
                            <span className="bg-gradient-to-r from-accent to-purple-600 text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-sm">#{file.orderInGroup}</span>
                            <span className="text-sm text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">{file.originalName}</span>
                          </div>
                          {file.ocrText && (
                            <div className="px-3 pb-3 pt-2 text-xs text-text-secondary bg-card-bg/50 border-t border-border-color/30 leading-relaxed max-h-[60px] overflow-hidden">
                              {file.ocrText.substring(0, 150)}
                              {file.ocrText.length > 150 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Revert Confirmation Dialog */}
          {showRevertConfirm && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowRevertConfirm(false)}>
              <div className="bg-card-bg/95 backdrop-blur-xl p-8 rounded-2xl max-w-[420px] w-[90%] shadow-2xl border border-border-color/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="m-0 text-xl font-bold text-text-primary">Revert All Grouped Files?</h2>
                </div>
                <p className="my-3 text-text-secondary text-sm">This will delete all <span className="font-semibold text-text-primary">{groupCount} groups</span> ({totalFiles} files) from Stage 02.</p>
                <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-3 border border-red-500/20">⚠️ This action cannot be undone.</p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 bg-bg-secondary/80 text-text-primary border border-border-color/50 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 hover:bg-accent/10 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setShowRevertConfirm(false)}
                    disabled={reverting}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white border-none px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-red-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleRevertAll}
                    disabled={reverting}
                  >
                    {reverting ? 'Reverting...' : 'Revert All'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Progress Confirmation Dialog */}
          {showResetConfirm && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowResetConfirm(false)}>
              <div className="bg-card-bg/95 backdrop-blur-xl p-8 rounded-2xl max-w-[420px] w-[90%] shadow-2xl border border-border-color/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h2 className="m-0 text-xl font-bold text-text-primary">Reset Label Progress?</h2>
                </div>
                <p className="my-3 text-text-secondary text-sm">This will clear all labeled data for <span className="font-semibold text-text-primary">{labeledStats?.totalLabeled || 0} groups</span>.</p>
                <p className="text-amber-400 text-sm bg-amber-500/10 rounded-lg px-4 py-3 border border-amber-500/20">💡 Groups will not be deleted, only label data will be reset for reprocessing.</p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 bg-bg-secondary/80 text-text-primary border border-border-color/50 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 hover:bg-accent/10 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resetting}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleResetProgress}
                    disabled={resetting}
                  >
                    {resetting ? 'Resetting...' : 'Reset Progress'}
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
