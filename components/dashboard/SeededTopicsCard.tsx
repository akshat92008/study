import React from 'react';
import Card from '@/components/ui/Card';
import { Target, CheckCircle2, PlayCircle, BookOpen } from 'lucide-react';

interface SeededTopic {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  microtarget: string;
  status: string;
  order_index: number;
}

interface SeededTopicsCardProps {
  seededTopics: SeededTopic[];
  onStartTopic?: (topic: SeededTopic) => void;
}

export default function SeededTopicsCard({ seededTopics, onStartTopic }: SeededTopicsCardProps) {
  if (!seededTopics || seededTopics.length === 0) return null;

  const activeTopic = seededTopics.find(t => t.status === 'active');
  const completedCount = seededTopics.filter(t => t.status === 'mastered').length;
  const progress = Math.round((completedCount / seededTopics.length) * 100);

  return (
    <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
        <div>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={18} color="var(--accent-purple)" />
            Learning Path
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>
            {completedCount} of {seededTopics.length} topics mastered
          </p>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          {progress}%
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, marginBottom: 'var(--sp-6)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-purple)', transition: 'width 0.5s ease-out' }} />
      </div>

      {activeTopic ? (
        <div style={{ background: 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 2 }}>Current Focus</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>{activeTopic.topic}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <BookOpen size={12} />
              {activeTopic.microtarget}
            </div>
          </div>
          <button
            onClick={() => onStartTopic?.(activeTopic)}
            style={{ 
              background: 'var(--accent-purple)', 
              color: 'white', 
              border: 'none', 
              padding: '6px 12px', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: 'var(--fs-xs)',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <PlayCircle size={14} />
            Start
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: '500' }}>All topics mastered!</span>
        </div>
      )}
    </Card>
  );
}
