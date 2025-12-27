'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getActivityLogs, ActivityLog, ActivityLogsResponse } from '@/lib/api';

export default function LogsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Filters
  const [filters, setFilters] = useState({
    userId: undefined as number | undefined,
    groupId: undefined as number | undefined,
    action: undefined as string | undefined,
    entityType: undefined as string | undefined,
    stage: undefined as string | undefined,
    search: '',
  });

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch logs
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchLogs();
    }
  }, [user, currentPage, limit, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await getActivityLogs({
        page: currentPage,
        limit,
        ...filters,
      });
      setLogs(response.logs);
      setTotalPages(response.totalPages);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Activity Logs</h1>
          <p className="text-text-secondary">View all system activity and changes (Admin Only)</p>
        </div>

        {/* Filters */}
        <div className="bg-card-bg rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Search (name, description, field)
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Search..."
              />
            </div>

            {/* Group ID */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Group ID
              </label>
              <input
                type="number"
                value={filters.groupId || ''}
                onChange={(e) =>
                  setFilters({ ...filters, groupId: e.target.value ? Number(e.target.value) : undefined })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Filter by Group ID"
              />
            </div>

            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Stage
              </label>
              <select
                value={filters.stage || ''}
                onChange={(e) =>
                  setFilters({ ...filters, stage: e.target.value || undefined })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All Stages</option>
                <option value="03-pdf-label">03 - PDF Label</option>
                <option value="04-extract">04 - Extract</option>
                <option value="05-review">05 - Review</option>
              </select>
            </div>

            {/* Action */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Action
              </label>
              <select
                value={filters.action || ''}
                onChange={(e) =>
                  setFilters({ ...filters, action: e.target.value || undefined })
                }
                className="w-full px-3 py-2 bg-bg-secondary border border-border-color rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="review">Review</option>
                <option value="approve">Approve</option>
              </select>
            </div>

            {/* Reset button */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    userId: undefined,
                    groupId: undefined,
                    action: undefined,
                    entityType: undefined,
                    stage: undefined,
                    search: '',
                  });
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-bg-secondary hover:bg-hover-bg text-text-primary rounded-md transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-card-bg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-40">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-32">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-24">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-28">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-20">
                    Group ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-hover-bg">
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{log.userName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.action === 'create'
                              ? 'bg-success/20 text-success'
                              : log.action === 'update'
                              ? 'bg-accent/20 text-accent-foreground'
                              : log.action === 'delete'
                              ? 'bg-danger/20 text-danger'
                              : log.action === 'review'
                              ? 'bg-warning/20 text-warning'
                              : log.action === 'approve'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-bg-secondary text-text-secondary'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{log.stage}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {log.groupId || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary max-w-md">
                        <div className="break-words whitespace-pre-wrap">
                          {log.description}
                        </div>
                        {log.fieldName && log.oldValue && log.newValue && (
                          <div className="text-xs text-text-secondary/70 mt-1 font-mono">
                            {log.fieldName}: {log.oldValue} → {log.newValue}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-bg-secondary px-4 py-3 flex items-center justify-between border-t border-border-color">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Items per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 bg-bg-secondary border border-border-color rounded-md text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-bg-secondary hover:bg-hover-bg disabled:bg-bg-primary disabled:text-text-secondary/50 text-text-primary rounded-md text-sm transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-text-secondary">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-bg-secondary hover:bg-hover-bg disabled:bg-bg-primary disabled:text-text-secondary/50 text-text-primary rounded-md text-sm transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
