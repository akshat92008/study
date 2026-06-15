'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bell, Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';

type AmauraNotification = {
  id: string;
  type: string;
  priority: 'silent' | 'low' | 'normal' | 'important' | 'urgent';
  title: string;
  message: string;
  action_label?: string | null;
  action_type?: string | null;
  action_payload?: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
};

export default function AmauraNotificationFeed() {
  const router = useRouter();
  const setActiveDrawer = useAppStore((state) => state.setActiveDrawer);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AmauraNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/amaura/notifications?limit=10', { cache: 'no-store' });
      if (!res.ok) throw new Error('Notifications are temporarily unavailable.');
      const data = await res.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
      setError(null);
      setOffline(false);
    } catch (cause) {
      setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
      setError(cause instanceof Error ? cause.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const markRead = async (input: { id?: string; all?: boolean }) => {
    await fetch('/api/amaura/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => undefined);
    await load();
  };

  const runAction = async (notification: AmauraNotification) => {
    const action = notification.action_type;
    if (action === 'open_revision') {
      setActiveDrawer('revision');
      router.push('/dashboard');
    } else if (action === 'open_repair') {
      router.push('/mistakes');
    } else if (action === 'open_mission') {
      router.push('/dashboard');
      window.dispatchEvent(new Event('refresh-dashboard'));
    } else if (action === 'open_autopsy') {
      router.push('/autopsy/deep');
    } else if (action === 'open_session') {
      router.push('/dashboard');
    } else if (action === 'open_practice') {
      router.push('/chat?intent=practice');
    } else if (action === 'open_atlas_concept') {
      const conceptId = notification.action_payload?.conceptId;
      router.push(typeof conceptId === 'string' ? `/cognition?conceptId=${conceptId}` : '/cognition');
    }
    await markRead({ id: notification.id });
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        title="Amaura updates"
        onClick={() => setOpen((value) => !value)}
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          background: open ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread`}
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 'min(380px, calc(100vw - 32px))',
            zIndex: 50,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: 'var(--fs-sm)' }}>Amaura</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                title="Refresh"
                onClick={load}
                style={iconButtonStyle}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
              <button
                type="button"
                title="Mark all read"
                onClick={() => markRead({ all: true })}
                style={iconButtonStyle}
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                title="Close"
                onClick={() => setOpen(false)}
                style={iconButtonStyle}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {error ? (
              <div role="alert" style={{ padding: '18px 14px', color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>
                {offline ? 'You are offline. Notifications will refresh when the connection returns.' : error}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '18px 14px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                No updates yet. Important repair, autopsy, material, and session changes will appear here.
              </div>
            ) : notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '12px 14px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: notification.read ? 'transparent' : 'rgba(34, 211, 238, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={priorityDot(notification.priority)} />
                      <strong style={{ fontSize: 'var(--fs-sm)', overflowWrap: 'anywhere' }}>{notification.title}</strong>
                    </div>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                      {notification.message}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      type="button"
                      title="Dismiss"
                      onClick={() => markRead({ id: notification.id })}
                      style={iconButtonStyle}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {notification.action_type && (
                  <button
                    type="button"
                    onClick={() => runAction(notification)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                    }}
                  >
                    <ExternalLink size={13} />
                    {notification.action_label ?? 'Open'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function priorityDot(priority: AmauraNotification['priority']): CSSProperties {
  const color = priority === 'urgent' || priority === 'important'
    ? 'var(--danger)'
    : priority === 'normal'
      ? 'var(--accent-cyan)'
      : 'var(--text-tertiary)';
  return {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: color,
    flexShrink: 0,
  };
}
