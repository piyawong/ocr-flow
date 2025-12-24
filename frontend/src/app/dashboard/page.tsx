'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api';

// Types
interface SummaryData {
  totalFiles: number;
  totalGroups: number;
  totalDocuments: number;
  foundationsProcessed: number;
  finalApproved: number;
  trends: {
    files: string;
    groups: string;
    documents: string;
    foundations: string;
    approved: string;
  };
}

interface StageProgressData {
  stage01: { pending: number };
  stage02: { unlabeled: number; labeled: number };
  stage03: { unreviewed: number; reviewed: number };
  stage04: { unreviewed: number; reviewed: number };
  stage05: { pending: number; approved: number };
}

interface MetricsData {
  matchRate: number;
  ocrSuccessRate: number;
  reviewRate: number;
  approvalRate: number;
  avgProcessingTime: number;
  throughput: number;
}

interface Activity {
  type: string;
  message: string;
  count: number;
  timestamp: Date;
}

interface Alert {
  level: string;
  message: string;
  count: number;
  action: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [stageProgress, setStageProgress] = useState<StageProgressData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard data (initial load + fallback)
  const fetchDashboardData = async () => {
    try {
      // Fetch all dashboard data in parallel using fetchWithAuth
      const [summaryRes, stageRes, metricsRes, activityRes, alertsRes] = await Promise.all([
        fetchWithAuth('/dashboard/summary'),
        fetchWithAuth('/dashboard/stage-progress'),
        fetchWithAuth('/dashboard/metrics'),
        fetchWithAuth('/dashboard/activity?limit=5'),
        fetchWithAuth('/dashboard/alerts'),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (stageRes.ok) setStageProgress(await stageRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (activityRes.ok) setActivities(await activityRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());

      setLoading(false);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  // Setup SSE connection for real-time updates
  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // Setup SSE
    const token = localStorage.getItem('auth-token');
    if (!token) {
      console.warn('No auth token found');
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';
    const eventSource = new EventSource(`${API_URL}/dashboard/stream`, {
      withCredentials: false, // Note: SSE doesn't support custom headers, so we can't send Bearer token
    });

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('Dashboard SSE connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);

        // Update all dashboard data
        if (update.summary) setSummary(update.summary);
        if (update.stageProgress) setStageProgress(update.stageProgress);
        if (update.metrics) setMetrics(update.metrics);
        if (update.activity) setActivities(update.activity);
        if (update.alerts) setAlerts(update.alerts);

        setLastUpdate(new Date(update.timestamp));
        setLoading(false);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Dashboard SSE error:', error);
      setIsConnected(false);

      // Start fallback polling if SSE fails
      if (!fallbackIntervalRef.current) {
        console.log('Starting fallback polling (every 10 seconds)');
        fallbackIntervalRef.current = setInterval(() => {
          fetchDashboardData();
        }, 10000);
      }
    };

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--accent)' }}></div>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>OCR Flow v2 - System Overview</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isConnected ? 'Live' : 'Polling'}
              </span>
              {lastUpdate && (
                <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                  {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchDashboardData()}
              className="px-4 py-2 text-white rounded-lg transition hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Top Stats Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              icon="📁"
              title="Total Files"
              value={summary.totalFiles}
              trend={summary.trends.files}
              color="blue"
            />
            <StatCard
              icon="📦"
              title="Total Groups"
              value={summary.totalGroups}
              trend={summary.trends.groups}
              color="green"
            />
            <StatCard
              icon="📄"
              title="Documents"
              value={summary.totalDocuments}
              trend={summary.trends.documents}
              color="yellow"
            />
            <StatCard
              icon="🏛️"
              title="Foundations"
              value={summary.foundationsProcessed}
              trend={summary.trends.foundations}
              color="purple"
            />
            <StatCard
              icon="✅"
              title="Approved"
              value={summary.finalApproved}
              trend={summary.trends.approved}
              color="teal"
            />
          </div>
        )}

        {/* Workflow Pipeline */}
        {stageProgress && (
          <div className="rounded-lg p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Workflow Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <StageCard
                stage="01-RAW"
                pending={stageProgress.stage01.pending}
                icon="📤"
              />
              <StageCard
                stage="02-GROUP"
                pending={stageProgress.stage02.unlabeled}
                completed={stageProgress.stage02.labeled}
                icon="📦"
              />
              <StageCard
                stage="03-LABEL"
                pending={stageProgress.stage03.unreviewed}
                completed={stageProgress.stage03.reviewed}
                icon="🏷️"
              />
              <StageCard
                stage="04-EXTRACT"
                pending={stageProgress.stage04.unreviewed}
                completed={stageProgress.stage04.reviewed}
                icon="📊"
              />
              <StageCard
                stage="05-REVIEW"
                pending={stageProgress.stage05.pending}
                completed={stageProgress.stage05.approved}
                icon="✅"
              />
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <div className="rounded-lg p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Performance Metrics</h2>
              <div className="space-y-4">
                <MetricBar
                  label="Match Rate"
                  value={metrics.matchRate}
                  color="green"
                />
                <MetricBar
                  label="OCR Success"
                  value={metrics.ocrSuccessRate}
                  color="blue"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Avg Processing Time</span>
                  <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {metrics.avgProcessingTime.toFixed(1)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="rounded-lg p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Quality Metrics</h2>
              <div className="space-y-4">
                <MetricBar
                  label="Review Rate"
                  value={metrics.reviewRate}
                  color="purple"
                />
                <MetricBar
                  label="Approval Rate"
                  value={metrics.approvalRate}
                  color="teal"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Throughput (24h)</span>
                  <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {metrics.throughput} files/day
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity & Alerts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Activity */}
          <div className="rounded-lg p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{activity.message}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recent activity</p>
            )}
          </div>

          {/* Alerts */}
          <div className="rounded-lg p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Alerts & Issues</h2>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg"
                    style={{
                      background: alert.level === 'error'
                        ? 'var(--danger-light)'
                        : alert.level === 'warning'
                        ? 'var(--warning-light)'
                        : 'var(--info-light)',
                      border: `1px solid ${
                        alert.level === 'error'
                          ? 'var(--danger)'
                          : alert.level === 'warning'
                          ? 'var(--warning)'
                          : 'var(--info)'
                      }`
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{alert.message}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{alert.action}</p>
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded uppercase font-semibold"
                        style={{
                          background: alert.level === 'error'
                            ? 'var(--danger)'
                            : alert.level === 'warning'
                            ? 'var(--warning)'
                            : 'var(--info)',
                          color: '#ffffff'
                        }}
                      >
                        {alert.level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>✅ No alerts - All systems running smoothly</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components

interface StatCardProps {
  icon: string;
  title: string;
  value: number;
  trend: string;
  color: string;
}

function StatCard({ icon, title, value, trend, color }: StatCardProps) {
  const colorStyles = {
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#f59e0b',
    purple: '#a855f7',
    teal: '#14b8a6',
  };

  return (
    <div className="rounded-lg p-6 hover:shadow-lg transition" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{icon}</span>
        <span className="text-xs px-2 py-1 rounded text-white" style={{ background: colorStyles[color as keyof typeof colorStyles] }}>
          {trend}
        </span>
      </div>
      <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{title}</div>
    </div>
  );
}

interface StageCardProps {
  stage: string;
  pending: number;
  completed?: number;
  icon: string;
}

function StageCard({ stage, pending, completed, icon }: StageCardProps) {
  const total = pending + (completed || 0);
  const percentage = total > 0 ? Math.round(((completed || 0) / total) * 100) : 0;

  return (
    <div className="text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{stage}</div>
      <div className="w-full rounded-full h-2 mb-2" style={{ background: 'var(--bg-secondary)' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${percentage}%`, background: 'var(--accent)' }}
        ></div>
      </div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {pending > 0 && <span>{pending} pending</span>}
        {completed !== undefined && <span className="ml-2">{completed} done</span>}
      </div>
    </div>
  );
}

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
}

function MetricBar({ label, value, color }: MetricBarProps) {
  const colorStyles = {
    green: 'var(--success)',
    blue: 'var(--accent)',
    purple: '#a855f7',
    teal: '#14b8a6',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{value}%</span>
      </div>
      <div className="w-full rounded-full h-3" style={{ background: 'var(--bg-secondary)' }}>
        <div
          className="h-3 rounded-full transition-all"
          style={{ width: `${value}%`, background: colorStyles[color as keyof typeof colorStyles] }}
        ></div>
      </div>
    </div>
  );
}
