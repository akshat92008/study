import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Card from '@/components/ui/Card';
import ScoreBridge from './ScoreBridge';
import AutopsyTrends from './AutopsyTrends';
import { ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';

interface AutopsyDashboardProps {
  result: any;
  trendsData: any[];
}

const COLORS = ['#00C2FF', '#FF5B5B', '#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#073B4C'];

export default function AutopsyDashboard({ result, trendsData }: AutopsyDashboardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', width: '100%' }}>
      
      {/* 1. Score Bridge */}
      <ScoreBridge 
        currentScore={result.currentScore}
        potentialScore={result.potentialScore}
        recoverableMarks={result.recoverableMarks}
        maxScore={result.examType === 'CUSTOM' ? 100 : 720}
      />

      <div className="grid-2">
        {/* 2. Mistake Category Breakdown */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <AlertTriangle color="var(--warning)" size={20} />
            Mistake Category Breakdown
          </h3>
          {result.categoryBreakdown && result.categoryBreakdown.length > 0 ? (
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={result.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="var(--accent-cyan)" label>
                    {result.categoryBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <p style={{ color: 'var(--text-secondary)' }}>No mistakes found to categorize.</p>
          )}
        </Card>

        {/* 3. Chapter Loss Heatmap */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)' }}>
            Chapter Loss Heatmap (Marks Lost)
          </h3>
          {result.chapterLoss && result.chapterLoss.length > 0 ? (
            <div style={{ height: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chapterLoss} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="chapter" type="category" width={100} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <RechartsTooltip 
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} 
                  />
                  <Bar dataKey="marksLost" fill="var(--error)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No chapters with lost marks.</p>
          )}
        </Card>
      </div>

      {/* 4. Mentor Quote */}
      <Card padding="lg" style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--warning-dim)', background: 'var(--warning-glow)' }}>
        <ShieldAlert color="var(--warning-dim)" size={150} style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.2 }} />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h3 style={{ color: 'var(--warning)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', marginBottom: 'var(--sp-4)' }}>Mentor Insight</h3>
          <p style={{ fontSize: 'var(--fs-xl)', color: 'var(--text-primary)', lineHeight: 'var(--lh-relaxed)', fontStyle: 'italic' }}>
            "{result.mentorQuote}"
          </p>
        </div>
      </Card>

      {/* 5. Recovery Sprint Plan */}
      {result.plan && (
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles color="var(--accent-cyan)" size={20} />
            {result.plan.title}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {result.plan.tasks.map((task: any, idx: number) => (
              <div key={idx} style={{ padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
                <div>
                  <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>Day {task.day} • {task.subject}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>{task.action}</div>
                </div>
                <div style={{ color: 'var(--success)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-lg)', whiteSpace: 'nowrap', background: 'var(--success-glow)', padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-md)', alignSelf: 'flex-start' }}>
                  +{task.marksGain} {result.examType === 'CUSTOM' ? '% points' : 'Marks'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. Historical Autopsy Trends */}
      <AutopsyTrends data={trendsData} />

    </motion.div>
  );
}
