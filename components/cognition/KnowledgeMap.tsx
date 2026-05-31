'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import { ChevronDown, ChevronRight, Eye, Brain, Sparkles, Shield, Zap, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MASTERY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  not_started: { color: 'var(--text-tertiary)', bg: 'var(--bg-tertiary)', label: 'Not Started', icon: Circle },
  exposed: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Exposed', icon: Eye },
  developing: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Developing', icon: Brain },
  proficient: { color: 'var(--info)', bg: 'var(--info-dim)', label: 'Proficient', icon: Shield },
  mastered: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'Mastered', icon: Sparkles },
  automated: { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)', label: 'Automated', icon: Zap },
};

import KnowledgeMapGraph from './KnowledgeMapGraph';

interface KnowledgeMapProps {
  concepts: any[];
  links?: any[];
  stats: { total: number; mastered: number; proficient: number; developing: number; weak: number; overallMastery: number };
  selectedSubject?: string;
}

export default function KnowledgeMap({ concepts: initialConcepts, links = [], stats, selectedSubject = 'all' }: KnowledgeMapProps) {
  const [concepts, setConcepts] = useState(initialConcepts);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [selectedConcept, setSelectedConcept] = useState<any>(null);

  useEffect(() => {
    setConcepts(initialConcepts);
  }, [initialConcepts]);

  const userId = initialConcepts[0]?.user_id;

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    
    // Subscribe to concept mastery changes
    const channel = supabase
      .channel(`atlas-live-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'concepts',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // Update the local concept state immediately
        setConcepts(prev => prev.map(c => 
          c.id === payload.new.id 
            ? { ...c, mastery: payload.new.mastery, confidence: payload.new.confidence }
            : c
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filteredConcepts = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') return concepts;
    return concepts.filter(c => c.subject.toLowerCase() === selectedSubject.toLowerCase());
  }, [concepts, selectedSubject]);

  const filteredLinks = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') return links;
    const conceptIds = new Set(filteredConcepts.map(c => c.id));
    return links.filter(l => conceptIds.has(l.source_concept_id) && conceptIds.has(l.target_concept_id));
  }, [links, filteredConcepts, selectedSubject]);

  const subjectStats = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') return stats;
    
    const total = filteredConcepts.length;
    const mastered = filteredConcepts.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length;
    const proficient = filteredConcepts.filter((c: any) => c.mastery === 'proficient').length;
    const developing = filteredConcepts.filter((c: any) => c.mastery === 'developing').length;
    const weak = filteredConcepts.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length;
    
    const masteryValues: Record<string, number> = {
      not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
    };
    const sum = filteredConcepts.reduce((acc: number, c: any) => acc + (masteryValues[c.mastery] || 0), 0);
    const overallMastery = total > 0 ? Math.round(sum / total) : 0;
    
    return { total, mastered, proficient, developing, weak, overallMastery };
  }, [filteredConcepts, selectedSubject, stats]);

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

  if (!concepts || concepts.length === 0) {
    return (
      <Card style={{ 
        padding: 'var(--sp-8) var(--sp-6)', 
        textAlign: 'center', 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-subtle)', 
        borderRadius: 'var(--radius-xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-3)'
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
          Not enough data to map mastery yet
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

      {/* Overview Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-3)' }}>
        {[
          { label: 'Total', value: subjectStats.total, color: 'var(--text-primary)' },
          { label: 'Mastered', value: subjectStats.mastered, color: 'var(--success)' },
          { label: 'Proficient', value: subjectStats.proficient, color: 'var(--info)' },
          { label: 'Developing', value: subjectStats.developing, color: 'var(--warning)' },
          { label: 'Weak', value: subjectStats.weak, color: 'var(--danger)' },
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
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            {selectedSubject === 'all' ? 'Overall Mastery' : `${selectedSubject} Mastery`}
          </span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)' }}>
            {subjectStats.overallMastery}%
          </span>
        </div>
        <div style={{ height: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${subjectStats.overallMastery}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%', borderRadius: 'var(--radius-full)',
              background: `linear-gradient(90deg, var(--danger) 0%, var(--warning) 30%, var(--success) 70%, var(--accent-cyan) 100%)`,
            }}
          />
        </div>
      </Card>

      {/* Interactive Node-Edge Graph */}
      <Card padding="none">
        <KnowledgeMapGraph concepts={filteredConcepts} links={filteredLinks} />
      </Card>

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
              onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
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
