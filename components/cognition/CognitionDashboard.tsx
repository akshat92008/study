'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { generateCards } from '@/lib/actions/revision';
import { useAtlasSeedingStatus } from '@/hooks/useAtlasSeedingStatus';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import KnowledgeMap from './KnowledgeMap';
import InteractiveGraph from './InteractiveGraph';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';

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
  const [showMagic, setShowMagic] = useState(false);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);

  const searchParams = useSearchParams();
  const { status, isSeeding, isComplete, progressPercent, conceptsDone, conceptsTotal } = useAtlasSeedingStatus();
  const isMagicMoment = searchParams.get('magic') === 'true';
  const isFirstTime = searchParams.get('firstTime') === 'true';

  useEffect(() => {
    if (isMagicMoment) {
      if (isFirstTime) {
        // Show a welcome overlay for 3 seconds, then reveal the graph
        setShowWelcomeOverlay(true);
        setTimeout(() => setShowWelcomeOverlay(false), 3000);
      } else {
        setShowMagic(true);
        setTimeout(() => setShowMagic(false), 3500); // 3.5s magic overlay reveal
      }

      // Clear query params to keep URL clean
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [isMagicMoment, isFirstTime]);

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
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', position: 'relative' }}>
      
      <AnimatePresence>
        {showMagic && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-root)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <motion.div
              initial={{ scale: 0.8, filter: 'blur(10px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1.2, type: 'spring' }}
              style={{ textAlign: 'center' }}
            >
              <Sparkles size={64} style={{ color: 'var(--accent-cyan)', margin: '0 auto 24px', filter: 'drop-shadow(0 0 20px var(--accent-cyan))' }} />
              <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'white' }}>ATLAS Generated.</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginTop: 12 }}>Mapping dependencies across {data.stats?.total || 0} nodes...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showWelcomeOverlay && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-background-primary, var(--bg-primary, #090b0f))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeOut 0.5s ease forwards 2.5s'
        }}>
          <p style={{ fontSize: '32px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary, white)' }}>
            Your knowledge map is ready.
          </p>
          <p style={{ fontSize: '16px', color: 'var(--color-text-secondary, var(--text-secondary, #9ca3af))' }}>
            This is what you know. This is what we need to build.
          </p>
        </div>
      )}
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
          <KnowledgeMap concepts={concepts} links={data.links} stats={stats} selectedSubject={selectedSubject} />
        </>
      )}
    </div>
  );
}
