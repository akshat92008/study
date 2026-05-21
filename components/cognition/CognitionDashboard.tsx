'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { generateCards } from '@/lib/actions/revision';
import { Brain, RefreshCw } from 'lucide-react';
import KnowledgeMap from './KnowledgeMap';
import InteractiveGraph from './InteractiveGraph';

interface Props {
  data: any; // CognitionGraph data from server
}

const masteryColor: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  automated: 'green', mastered: 'green', proficient: 'blue',
  developing: 'yellow', exposed: 'red', not_started: 'gray',
};

export default function CognitionDashboard({ data }: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  if (!data) return <p style={{ color: 'var(--text-tertiary)' }}>Loading cognition graph...</p>;

  const { grouped, stats, concepts } = data;
  const subjects = Object.keys(grouped);

  const filteredGrouped = selectedSubject === 'all'
    ? grouped
    : { [selectedSubject]: grouped[selectedSubject] };

  async function handleGenerateCards(concept: any) {
    if (!concept?.id || generatingId) return;
    setGeneratingId(concept.id);
    try {
      await generateCards(concept.id, concept.subject, concept.chapter || concept.name);
      setGeneratedIds(prev => new Set(prev).add(concept.id));
    } finally {
      setGeneratingId(null);
    }
  }

  const tiers = { not_started: 0, exposed: 0, developing: 0, proficient: 0, mastered: 0, automated: 0 };
  (concepts || []).forEach((c: any) => {
    if (tiers[c.mastery as keyof typeof tiers] !== undefined) {
      tiers[c.mastery as keyof typeof tiers]++;
    }
  });

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Mastery Legend + Stats Banner */}
      <div style={{ padding: 'var(--sp-4) var(--sp-6)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
          <div style={{ border: '1px solid #666', color: '#666', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Not Started: {tiers.not_started}
          </div>
          <div style={{ border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Exposed: {tiers.exposed}
          </div>
          <div style={{ border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Developing: {tiers.developing}
          </div>
          <div style={{ border: '1px solid #8b5cf6', color: '#8b5cf6', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Proficient: {tiers.proficient}
          </div>
          <div style={{ border: '1px solid #10b981', color: '#10b981', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Mastered: {tiers.mastered}
          </div>
          <div style={{ border: '1px solid #06b6d4', color: '#06b6d4', borderRadius: 999, padding: '2px 12px', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)', background: 'transparent' }}>
            Automated: {tiers.automated}
          </div>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {(concepts || []).length} concepts tracked · {tiers.mastered + tiers.automated} mastered · {tiers.not_started} not started
        </div>
      </div>

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

      {concepts.length === 0 ? (
        <Card style={{ 
          padding: 'var(--sp-8) var(--sp-6)', 
          textAlign: 'center', 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          marginTop: 'var(--sp-4)'
        }}>
          <Brain size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
            Not enough data to map neural pathways yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', maxWidth: '400px', lineHeight: 'var(--lh-relaxed)' }}>
            Complete onboarding and start reviewing concepts or taking mock tests to generate your personalized cognition map.
          </p>
        </Card>
      ) : (
        <>
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

          {/* Interactive Node-Edge Graph Visualization */}
          <KnowledgeMap concepts={concepts} links={data.links} stats={stats} />
        </>
      )}
    </div>
  );
}
