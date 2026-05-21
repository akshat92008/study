'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { BarChart3, TrendingUp, Target, Clock, Brain, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

const CHART_COLORS = ['hsl(220,90%,56%)', 'hsl(265,80%,60%)', 'hsl(185,80%,50%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(0,84%,60%)'];

export default function AnalyticsDashboard({ data }: { data: any }) {
  if (!data) return <p style={{ color: 'var(--text-tertiary)' }}>No data yet.</p>;

  const { scoreTrend, subjectMastery, mistakeDistribution, taskCompletionRate,
    predictedScore, totalStudyHours, totalMockTests, totalMistakes, totalMarksLost,
    latestScore, maxMarks, examType, peakHours, productivityScore } = data;

  const displayMax = maxMarks || '—';
  const yAxisMax = maxMarks || 100;

  const mistakeData = Object.entries(mistakeDistribution).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <BarChart3 size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-blue)' }} />
          Performance Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          Your {examType || 'academic'} intelligence dashboard
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 stagger">
        <Card variant="glow">
          <div className="label">Latest Score</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
            {latestScore ?? '—'}<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>/{displayMax}</span>
          </div>
        </Card>
        <Card>
          <div className="label">Predicted Score</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
            {predictedScore ?? '—'}
          </div>
          {predictedScore && <Badge color="purple">AI Predicted</Badge>}
        </Card>
        <Card>
          <div className="label">Study Hours</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {totalStudyHours}h
          </div>
        </Card>
        <Card>
          <div className="label">Task Completion</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
            {taskCompletionRate}%
          </div>
          <Progress value={taskCompletionRate} color="green" size="sm" />
        </Card>
      </div>

      {/* Behavioral Insights */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
        <Brain size={20} color="var(--accent-amber)" />
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
          Behavioral Insights
        </h2>
      </div>
      <div className="grid-2 stagger">
        <Card variant="glow">
          <div className="label">Peak Productivity Hours</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-amber)' }}>
            {peakHours || 'Analyzing...'}
          </div>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-2)' }}>
            When you achieve the highest flow states
          </p>
        </Card>
        <Card>
          <div className="label">Productivity Score</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
            {productivityScore ?? '—'}<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>/100</span>
          </div>
          <Progress value={productivityScore || 0} color="green" size="sm" />
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        {/* Score Trend */}
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <TrendingUp size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Score Trend
          </h3>
          {scoreTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} domain={[0, yAxisMax]} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(220,90%,56%)" strokeWidth={2} dot={{ fill: 'hsl(220,90%,56%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--sp-8)' }}>Take mock tests to see trends</p>}
        </Card>

        {/* Subject Mastery Radar */}
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <Brain size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Subject Mastery
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={subjectMastery}>
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <Radar name="Mastery" dataKey="mastery" stroke="hsl(265,80%,60%)" fill="hsla(265,80%,60%,0.3)" />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Mistake Distribution */}
      {mistakeData.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <Target size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Mistake Distribution ({totalMistakes} total, -{totalMarksLost} marks)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mistakeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {mistakeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
