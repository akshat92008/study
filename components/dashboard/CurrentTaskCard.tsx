'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Brain, Flame, Clock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function CurrentTaskCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addChatMessage, addToast } = useAppStore();

  const fetchSessionCard = async () => {
    try {
      const res = await fetch('/api/dashboard/session-card');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch daily session card', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionCard();
  }, []);

  const handleStartSession = () => {
    if (!data) return;

    // Send a message to the Socratic assistant to kick off tutoring
    addChatMessage({
      role: 'user',
      content: `Let's start a Socratic tutoring session on "${data.focusTopic}" (${data.subject}).`,
      timestamp: new Date().toISOString()
    });

    addToast(`Session started: ${data.focusTopic}`, 'success');
  };

  if (loading) {
    return (
      <Card style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-subtle)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '200px' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Analyzing mastery gaps...</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-subtle)', 
        padding: 'var(--sp-4)', 
        textAlign: 'center' 
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          No session card available. Tell the tutor what you want to learn to get started!
        </p>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <Card variant="glow" style={{
        background: 'linear-gradient(135deg, #111115, #0a0a0d)',
        border: '1px solid var(--accent-blue-dim)', 
        padding: 'var(--sp-5)',
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--sp-3)', 
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={12} style={{ color: 'var(--warning)' }} />
            DAY {data.dayNumber || 1} · {data.streakDays || 0}D STREAK
          </span>
          <Badge color="cyan">Today's Focus</Badge>
        </div>
        
        <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)' }}>
          {data.focusTopic}
        </h3>
        
        <p style={{ color: 'var(--accent-purple)', fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain size={14} style={{ color: 'var(--accent-purple)' }} />
          {data.subject} · <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> {data.estimatedMinutes || 45} mins
        </p>
        
        {data.rationale && (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 12, 
            fontSize: '11px', 
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6
          }}>
            <Sparkles size={12} style={{ color: 'var(--accent-cyan)', marginTop: 2, flexShrink: 0 }} />
            <span>{data.rationale}</span>
          </div>
        )}

        <Button onClick={handleStartSession} style={{
          width: '100%', 
          padding: '14px', 
          background: 'linear-gradient(135deg, #0055ff, #00f0ff)',
          color: 'white', 
          border: 'none', 
          borderRadius: 'var(--radius-md)', 
          cursor: 'pointer',
          fontWeight: 700, 
          fontSize: 'var(--fs-sm)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 8,
          boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
        }}>
          Start Socratic Session <ArrowRight size={16} />
        </Button>
      </Card>
    </div>
  );
}
