'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import { ChevronDown, ChevronRight, Eye, Brain, Sparkles, Shield, Zap, Circle } from 'lucide-react';

const MASTERY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  not_started: { color: 'var(--text-tertiary)', bg: 'var(--bg-tertiary)', label: 'Not Started', icon: Circle },
  exposed: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Exposed', icon: Eye },
  developing: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Developing', icon: Brain },
  proficient: { color: 'var(--info)', bg: 'var(--info-dim)', label: 'Proficient', icon: Shield },
  mastered: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'Mastered', icon: Sparkles },
  automated: { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)', label: 'Automated', icon: Zap },
};

interface KnowledgeMapProps {
  concepts: any[];
  stats: { total: number; mastered: number; proficient: number; developing: number; weak: number; overallMastery: number };
}

export default function KnowledgeMap({ concepts, stats }: KnowledgeMapProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [selectedConcept, setSelectedConcept] = useState<any>(null);

  // Group by subject → chapter
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    (concepts || []).forEach((c: any) => {
      if (!map[c.subject]) map[c.subject] = [];
      map[c.subject].push(c);
    });
    return map;
  }, [concepts]);

  const subjects = Object.keys(grouped);

  const toggleSubject = (subject: string) => {
    const next = new Set(expandedSubjects);
    next.has(subject) ? next.delete(subject) : next.add(subject);
    setExpandedSubjects(next);
  };

  // Calculate subject-level mastery
  const getSubjectMastery = (chapters: any[]) => {
    const masteryValues: Record<string, number> = {
      not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
    };
    const sum = chapters.reduce((acc: number, c: any) => acc + (masteryValues[c.mastery] || 0), 0);
    return Math.round(sum / chapters.length);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

      {/* Overview Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-3)' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Mastered', value: stats.mastered, color: 'var(--success)' },
          { label: 'Proficient', value: stats.proficient, color: 'var(--info)' },
          { label: 'Developing', value: stats.developing, color: 'var(--warning)' },
          { label: 'Weak', value: stats.weak, color: 'var(--danger)' },
        ].map((s) => (
          <Card key={s.label} padding="md" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Overall Mastery Bar */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>Overall Mastery</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)' }}>
            {stats.overallMastery}%
          </span>
        </div>
        <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.overallMastery}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%', borderRadius: 'var(--radius-full)',
              background: `linear-gradient(90deg, var(--danger) 0%, var(--warning) 30%, var(--success) 70%, var(--accent-cyan) 100%)`,
            }}
          />
        </div>
      </Card>

      {/* Subject Tree Map */}
      {subjects.map((subject) => {
        const chapters = grouped[subject];
        const subjectMastery = getSubjectMastery(chapters);
        const isExpanded = expandedSubjects.has(subject);

        return (
          <Card key={subject} padding="none" style={{ overflow: 'hidden' }}>
            {/* Subject Header */}
            <button
              onClick={() => toggleSubject(subject)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--sp-4) var(--sp-5)', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>{subject}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  {chapters.length} chapters
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: subjectMastery > 70 ? 'var(--success)' : subjectMastery > 40 ? 'var(--warning)' : 'var(--danger)' }}>
                  {subjectMastery}%
                </span>
                {/* Mini mastery bar */}
                <div style={{ width: 80, height: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${subjectMastery}%`, height: '100%', background: subjectMastery > 70 ? 'var(--success)' : subjectMastery > 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </button>

            {/* Chapter Grid */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 'var(--sp-2)', padding: '0 var(--sp-4) var(--sp-4)',
                  }}>
                    {chapters.map((c: any, i: number) => {
                      const mConfig = MASTERY_CONFIG[c.mastery] || MASTERY_CONFIG.not_started;
                      const Icon = mConfig.icon;
                      return (
                        <motion.button
                          key={c.id || i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => setSelectedConcept(c)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                            padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
                            background: mConfig.bg, border: `1px solid ${mConfig.color}33`,
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'all 150ms ease',
                          }}
                        >
                          <Icon size={14} style={{ color: mConfig.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 'var(--fs-xs)', color: mConfig.color, fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-tight)' }}>
                            {c.chapter || c.name}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}

      {/* Selected Concept Detail Panel */}
      <AnimatePresence>
        {selectedConcept && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedConcept(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)', padding: 'var(--sp-8)',
                maxWidth: 400, width: '90vw',
              }}
            >
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>
                {selectedConcept.chapter || selectedConcept.name}
              </h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
                {selectedConcept.subject}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                {[
                  { label: 'Mastery', value: MASTERY_CONFIG[selectedConcept.mastery]?.label || 'Unknown' },
                  { label: 'Reviews', value: selectedConcept.times_reviewed || 0 },
                  { label: 'Correct', value: selectedConcept.times_correct || 0 },
                  { label: 'Forgetting', value: `${Math.round((selectedConcept.forgetting_probability || 0) * 100)}%` },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', justifyContent: 'center',
        padding: 'var(--sp-4)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
      }}>
        {Object.entries(MASTERY_CONFIG).map(([key, config]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: config.color }} />
            {config.label}
          </div>
        ))}
      </div>
    </div>
  );
}
