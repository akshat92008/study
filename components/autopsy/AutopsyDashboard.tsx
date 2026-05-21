'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Card from '@/components/ui/Card';
import ScoreBridge from './ScoreBridge';
import { ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';

interface AutopsyDashboardProps {
  result: any;
}

const COLORS = ['#00C2FF', '#FF5B5B', '#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#073B4C'];

export default function AutopsyDashboard({ result }: AutopsyDashboardProps) {
  if (!result) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', width: '100%' }}>
      
      {/* 1. Score Bridge */}
      <ScoreBridge 
        currentScore={result.currentScore}
        recoverableMarks={result.recoverableMarks}
        potentialScore={result.potentialScore}
        examType={result.examType}
        mentorQuote={result.mentorQuote || ''}
        categoryBreakdown={result.categoryBreakdown || []}
        chapterLoss={result.chapterLoss || []}
      />

      {/* 2. Charts Row */}
      <div className="grid-2">
        {/* Mistake Category Pie */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <AlertTriangle color="var(--warning)" size={18} />
            Mistake Taxonomy
          </h3>
          {result.categoryBreakdown?.length > 0 ? (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={result.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {result.categoryBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--accent-cyan)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No categorized mistakes found.</p>}
        </Card>

        {/* Chapter Loss Bar */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)' }}>
            Highest ROI Chapters (Marks Lost)
          </h3>
          {result.chapterLoss?.length > 0 ? (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chapterLoss} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="chapter" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: 'var(--bg-hover)'}} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} />
                  <Bar dataKey="marksLost" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p style={{ color: 'var(--text-secondary)' }}>No marks lost mapping found.</p>}
        </Card>
      </div>

      {/* 3. Mentor Insight Quote */}
      <Card padding="lg" style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--warning-dim)', background: 'var(--warning-glow)' }}>
        <ShieldAlert color="var(--warning-dim)" size={120} style={{ position: 'absolute', right: '-10px', top: '-20px', opacity: 0.2 }} />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h3 style={{ color: 'var(--warning)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', marginBottom: 'var(--sp-2)' }}>Mentor Insight</h3>
          <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-primary)', lineHeight: 'var(--lh-relaxed)', fontStyle: 'italic' }}>
            "{result.mentorQuote}"
          </p>
        </div>
      </Card>

      {/* 4. Sprint Plan */}
      {result.plan?.tasks && (
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles color="var(--accent-cyan)" size={20} />
            {result.plan.title || 'Recovery Sprint Plan'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {result.plan.tasks.map((task: any, idx: number) => (
              <div key={idx} style={{ padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <div>
                  <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>Day {task.day} • {task.subject}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>{task.action}</div>
                </div>
                <div style={{ color: 'var(--success)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-md)', whiteSpace: 'nowrap', background: 'var(--success-dim)', padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-full)' }}>
                  +{task.marksGain}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
