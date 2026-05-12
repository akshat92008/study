'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { Brain, TrendingUp, AlertTriangle, Zap } from 'lucide-react';

interface Props {
  data: any; // CognitionGraph data from server
}

const masteryColor: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  automated: 'green', mastered: 'green', proficient: 'blue',
  developing: 'yellow', exposed: 'red', not_started: 'gray',
};

export default function CognitionDashboard({ data }: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  if (!data) return <p style={{ color: 'var(--text-tertiary)' }}>Loading cognition graph...</p>;

  const { grouped, stats, concepts } = data;
  const subjects = Object.keys(grouped);

  const filteredGrouped = selectedSubject === 'all'
    ? grouped
    : { [selectedSubject]: grouped[selectedSubject] };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <Brain size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-purple)' }} />
          Cognition Graph
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          Your knowledge state across {stats.total} concepts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 stagger">
        <Card id="stat-mastery" variant="glow">
          <div className="label">Overall Mastery</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', marginTop: 'var(--sp-1)' }}>
            {stats.overallMastery}%
          </div>
          <Progress value={stats.overallMastery} color="blue" size="sm" />
        </Card>
        <Card id="stat-mastered">
          <div className="label">Mastered</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)', marginTop: 'var(--sp-1)' }}>
            {stats.mastered}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>of {stats.total} concepts</div>
        </Card>
        <Card id="stat-developing">
          <div className="label">Developing</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--warning)', marginTop: 'var(--sp-1)' }}>
            {stats.developing}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>need more practice</div>
        </Card>
        <Card id="stat-weak">
          <div className="label">Weak / Not Started</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--danger)', marginTop: 'var(--sp-1)' }}>
            {stats.weak}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>critical gaps</div>
        </Card>
      </div>

      {/* Subject Filter */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button onClick={() => setSelectedSubject('all')} style={{
          padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-full)',
          background: selectedSubject === 'all' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
          color: selectedSubject === 'all' ? 'white' : 'var(--text-secondary)',
          border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)',
        }}>All</button>
        {subjects.map((sub) => (
          <button key={sub} onClick={() => setSelectedSubject(sub)} style={{
            padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-full)',
            background: selectedSubject === sub ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: selectedSubject === sub ? 'white' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)',
          }}>{sub}</button>
        ))}
      </div>

      {/* Concept Grid by Chapter */}
      {Object.entries(filteredGrouped).map(([subject, chapters]: [string, any]) => (
        <div key={subject}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
            {subject}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Object.entries(chapters).map(([chapter, chapterConcepts]: [string, any]) => {
              const c = chapterConcepts[0]; // Each chapter = 1 concept in initial seed
              if (!c) return null;
              const masteryPercent: Record<string, number> = {
                not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
              };
              return (
                <Card key={chapter} padding="sm" style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                  cursor: 'pointer', transition: 'all var(--duration-fast)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>{chapter}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
                      <Badge color={masteryColor[c.mastery] || 'gray'}>{c.mastery.replace('_', ' ')}</Badge>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {c.times_reviewed}x reviewed
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 120 }}>
                    <Progress value={masteryPercent[c.mastery] || 0} color={masteryColor[c.mastery] === 'green' ? 'green' : masteryColor[c.mastery] === 'red' ? 'red' : 'blue'} size="sm" showLabel />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
