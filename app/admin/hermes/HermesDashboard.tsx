'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Play, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function HermesDashboard() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/hermes/runs');
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Unauthorized or Forbidden. Are you an admin?');
        }
        throw new Error('Failed to fetch runs');
      }
      const data = await res.json();
      setRuns(data.runs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleReplay = async (runId: string) => {
    try {
      setActionLoading(runId);
      const res = await fetch(`/api/admin/hermes/runs/${runId}/replay`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to replay run');
      const data = await res.json();
      alert(`Replay started successfully. New Run ID: ${data.newRunId}`);
      await fetchRuns();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
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
            Amaura Runtime Cockpit
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Production Grade Agent Runtime Monitoring & Replay
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchRuns}
            disabled={loading || actionLoading !== null}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-medium text-gray-900 dark:text-white">Recent Agent Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3">Run ID</th>
                <th className="px-6 py-3">Agent</th>
                <th className="px-6 py-3">Trigger</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Duration (s)</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const duration = run.completed_at ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1) : '-';
                return (
                  <tr key={run.id} className="bg-white border-b dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-mono text-xs">{run.id.split('-')[0]}...</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{run.agent_name}</td>
                    <td className="px-6 py-4">{run.trigger_type}</td>
                    <td className="px-6 py-4">
                      {run.status === 'completed' && <span className="text-green-500 font-medium">Completed</span>}
                      {run.status === 'failed' && <span className="text-red-500 font-medium" title={run.error}>Failed</span>}
                      {run.status === 'running' && <span className="text-blue-500 font-medium">Running</span>}
                    </td>
                    <td className="px-6 py-4">{duration}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleReplay(run.id)}
                        disabled={actionLoading === run.id}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 flex items-center justify-end gap-1"
                      >
                        {actionLoading === run.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        Replay
                      </button>
                    </td>
                  </tr>
                );
              })}
              {runs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
