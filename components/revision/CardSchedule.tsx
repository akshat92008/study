'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import { Calendar, TrendingUp, Shield, Clock } from 'lucide-react';

interface CardScheduleProps {
  cards: any[]; // All revision cards for this user
}

const STATE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'New', color: 'var(--text-tertiary)' },
  1: { label: 'Learning', color: 'var(--warning)' },
  2: { label: 'Review', color: 'var(--success)' },
  3: { label: 'Relearning', color: 'var(--danger)' },
};

export default function CardSchedule({ cards }: CardScheduleProps) {
  // Group cards by upcoming review date (next 14 days)
  const schedule = useMemo(() => {
    const today = new Date();
    const days: Record<string, number> = {};

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days[d.toISOString().split('T')[0]] = 0;
    }

    (cards || []).forEach((c: any) => {
      if (!c.due) return;
      const dueDate = new Date(c.due).toISOString().split('T')[0];
      if (days[dueDate] !== undefined) {
        days[dueDate]++;
      }
    });

    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [cards]);

  // Stability distribution
  const stabilityBuckets = useMemo(() => {
    const buckets = { fragile: 0, developing: 0, stable: 0, mature: 0 };
    (cards || []).forEach((c: any) => {
      const s = c.stability || 0;
      if (s <= 1) buckets.fragile++;
      else if (s <= 7) buckets.developing++;
      else if (s <= 21) buckets.stable++;
      else buckets.mature++;
    });
    return buckets;
  }, [cards]);

  const maxCount = Math.max(1, ...schedule.map(d => d.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

      {/* Upcoming Reviews Heatmap */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <Calendar size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            Upcoming Reviews (14 Days)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'flex-end', height: 80 }}>
          {schedule.map((day, i) => {
            const height = day.count > 0 ? Math.max(8, (day.count / maxCount) * 70) : 4;
            const isToday = i === 0;
            const dateObj = new Date(day.date);
            const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });

            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} cards due`}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height,
                    borderRadius: 'var(--radius-sm)',
                    background: day.count === 0
                      ? 'var(--bg-tertiary)'
                      : isToday
                        ? 'var(--warning)'
                        : `hsla(185, 80%, 50%, ${0.3 + (day.count / maxCount) * 0.7})`,
                    transition: 'height 0.3s ease',
                  }}
                />
                <span style={{
                  fontSize: '9px',
                  color: isToday ? 'var(--warning)' : 'var(--text-tertiary)',
                  fontWeight: isToday ? 'var(--fw-bold)' : 'var(--fw-normal)',
                }}>
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stability Distribution */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <Shield size={16} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            Review Stability Distribution
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          {([
            { key: 'fragile', label: 'Fragile', sub: '≤1 day', color: 'var(--danger)', value: stabilityBuckets.fragile },
            { key: 'developing', label: 'Developing', sub: '1–7 days', color: 'var(--warning)', value: stabilityBuckets.developing },
            { key: 'stable', label: 'Stable', sub: '7–21 days', color: 'var(--info)', value: stabilityBuckets.stable },
            { key: 'mature', label: 'Mature', sub: '21+ days', color: 'var(--success)', value: stabilityBuckets.mature },
          ] as const).map((bucket) => (
            <div key={bucket.key} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: bucket.color,
              }}>
                {bucket.value}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: bucket.color }}>
                {bucket.label}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                {bucket.sub}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Average Retention Estimate */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
          <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            FSRS Target Retention
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
            90%
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            calibrated via FSRS-5 algorithm
          </span>
        </div>
        <div style={{ marginTop: 'var(--sp-2)', height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ width: '90%', height: '100%', background: 'linear-gradient(90deg, var(--danger) 0%, var(--warning) 40%, var(--success) 90%)', borderRadius: 'var(--radius-full)' }} />
        </div>
      </Card>
    </div>
  );
}
