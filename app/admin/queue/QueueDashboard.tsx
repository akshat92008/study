'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Play, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function QueueDashboard() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/queue/status');
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Unauthorized or Forbidden. Are you an admin?');
        }
        throw new Error('Failed to fetch status');
      }
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleProcess = async () => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/queue/process', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to process queue');
      const data = await res.json();
      alert(`Processed ${data.processed} events. Failed: ${data.failed}. Skipped: ${data.skipped}.`);
      await fetchStatus();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryDlq = async () => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/admin/queue/retry-dlq', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to retry DLQ');
      const data = await res.json();
      alert(`Recovered ${data.recovered} DLQ events.`);
      await fetchStatus();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 flex flex-col items-center text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Access Denied or Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-indigo-500" />
            Queue Recovery Panel
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manual controls for the asynchronous event worker system
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchStatus}
            disabled={loading || actionLoading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleProcess}
            disabled={loading || actionLoading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Process Now
          </button>
          <button
            onClick={handleRetryDlq}
            disabled={loading || actionLoading || (status?.dlqCount === 0)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            Retry DLQ
          </button>
        </div>
      </div>

      {!status && loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Pending Events"
            value={status.pendingEvents}
            icon={<Clock className="h-6 w-6 text-blue-500" />}
            subtitle={`Oldest: ${status.oldestPendingAgeSeconds}s ago`}
          />
          <StatCard
            title="Processing Events"
            value={status.processingEvents}
            icon={<Activity className="h-6 w-6 text-green-500" />}
            subtitle={`Locks: ${status.processingLocks}`}
          />
          <StatCard
            title="Failed Events"
            value={status.failedEvents}
            icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
            subtitle={`Locks FAILED: ${status.failedLocks}`}
            alert={status.failedEvents > 0}
          />
          <StatCard
            title="DLQ Events"
            value={status.dlqCount}
            icon={<AlertTriangle className="h-6 w-6 text-amber-500" />}
            subtitle="Requires manual retry"
            alert={status.dlqCount > 0}
          />
        </div>
      ) : null}

      {status?.errors && status.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-400 font-medium mb-2">Recent Errors</h3>
          <ul className="list-disc pl-5 space-y-1">
            {status.errors.map((err: string, i: number) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-300">{err}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-medium text-gray-900 dark:text-white">To view failed events and details, check the API</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">GET /api/admin/queue/failed-events</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle, alert }: { title: string, value: number, icon: React.ReactNode, subtitle: string, alert?: boolean }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border rounded-xl p-6 shadow-sm ${alert ? 'border-red-300 dark:border-red-800 ring-1 ring-red-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</h3>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );
}
