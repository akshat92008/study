import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Flame, BookOpen } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface Session {
  id: string;
  durationMinutes: number;
  understood: boolean;
  cardsCreated: number;
}

interface SessionTrackerData {
  completionPercent: number;
  plannedMinutes: number;
  actualMinutes: number;
  sessionCount: number;
  daysToExam: number | null;
  tasks: Task[];
  sessions: Session[];
  timeStudiedToday: number;
}

export default function SessionTracker() {
  const [data, setData] = useState<SessionTrackerData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sessions/today')
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
        Loading session tracker…
      </div>
    );
  }

  if (!data) return null;

  const { completionPercent, sessionCount, daysToExam, tasks, sessions, timeStudiedToday } = data;

  const ringColor =
    completionPercent >= 80 ? '#4ade80' : completionPercent >= 40 ? '#fbbf24' : '#60a5fa';

  const progressRing = (
    <svg width={60} height={60} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx="18"
        cy="18"
        r="15.9155"
        fill="none"
        stroke="var(--bg-tertiary)"
        strokeWidth="4"
      />
      <circle
        cx="18"
        cy="18"
        r="15.9155"
        fill="none"
        stroke={ringColor}
        strokeWidth="4"
        strokeDasharray={`${completionPercent} ${100 - completionPercent}`}
        strokeLinecap="round"
      />
      <text x="18" y="20.35" fill="var(--text-primary)" fontSize="8" textAnchor="middle">
        {completionPercent}%
      </text>
    </svg>
  );

  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginTop: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
      {/* Header (collapsed) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {completionPercent}% complete • {sessionCount} sessions today
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '16px' }}>
          {/* Progress ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{progressRing}</div>

          {/* Planned tasks */}
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>Planned Tasks</h4>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 4 }}>
              {tasks.map((t) => (
                <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {t.completed ? (
                    <CheckCircle size={14} color="#4ade80" />
                  ) : (
                    <XCircle size={14} color="#f87171" />
                  )}
                  <span style={{ flexGrow: 1, color: 'var(--text-primary)' }}>{t.title}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color:
                        t.priority === 'high'
                          ? '#f87171'
                          : t.priority === 'medium'
                          ? '#fbbf24'
                          : '#60a5fa',
                    }}
                  >
                    {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Completed sessions */}
          <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>Completed Sessions</h4>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 4 }}>
              {sessions.map((s) => (
                <li key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} />
                    <span>{s.durationMinutes} min</span>
                    {s.understood && (
                      <span style={{ background: '#4ade80', color: 'white', borderRadius: 4, padding: '2px 4px', fontSize: '11px' }}>Understood</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cards created: {s.cardsCreated}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Studied today: {timeStudiedToday} min</span>
            {daysToExam !== null && <span>Days to exam: {daysToExam}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
