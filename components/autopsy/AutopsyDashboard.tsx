'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '@/components/ui/Card';
import ScoreBridge from './ScoreBridge';
import { Sparkles, Activity, CheckCircle2, MessageCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface AutopsyDashboardProps {
  result: any;
}

export default function AutopsyDashboard({ result }: AutopsyDashboardProps) {
  const { setAssistantOpen, addChatMessage } = useAppStore();
  const [completedTasks, setCompletedTasks] = React.useState<Record<number, boolean>>({});

  if (!result) return null;

  // =========================================================================
  // SECTION 2: Mistake Breakdown (Execution vs Knowledge)
  // =========================================================================
  const EXECUTION_TYPES = ['calculation', 'silly', 'time_pressure', 'misread', 'anxiety', 'recall_failure'];
  
  let executionLost = 0;
  let knowledgeLost = 0;

  const categoryBreakdown = result.categoryBreakdown || [];
  categoryBreakdown.forEach((c: any) => {
    if (EXECUTION_TYPES.includes(c.name)) executionLost += c.value;
    else knowledgeLost += c.value;
  });

  const chartData = [
    { name: 'Execution & Focus', marks: executionLost, color: 'var(--warning)', desc: 'Silly mistakes, time panic, misreads.' },
    { name: 'Knowledge & Concepts', marks: knowledgeLost, color: 'var(--accent-purple)', desc: 'Conceptual gaps, incomplete knowledge.' }
  ];

  // Action for clicking a sprint task
  const handleTackleInTutor = (task: any) => {
    addChatMessage({
      role: 'user',
      content: `I am executing my mistake review sprint plan. I need help with: ${task.subject} - ${task.action}. Can we review this?`,
      timestamp: new Date().toISOString()
    });
    setAssistantOpen(true);
  };

  const toggleTask = (idx: number) => {
    setCompletedTasks(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', width: '100%' }}>
      
      {/* SECTION 1: The Score Bridge */}
      <ScoreBridge 
        currentScore={result.currentScore}
        recoverableMarks={result.recoverableMarks}
        chapterLoss={result.chapterLoss}
        examType={result.examType}
      />

      {result.eventId && (
        <Card padding="md" style={{ border: '1px solid var(--accent-cyan-dim)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 6 }}>
            Downstream update queued
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Verified mistakes are queued to update your weak areas, create revision cards where supported, and influence the next mission.
          </p>
        </Card>
      )}

      {(result.pending_review_count > 0 || result.needsReviewCount > 0) && (
        <Card padding="md" style={{ border: '1px solid var(--warning-dim)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 6 }}>
            Manual Review Required
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            There are {result.pending_review_count || result.needsReviewCount} mistake(s) waiting for manual review because the confidence was too low. Once verified, they will update your learner profile.
          </p>
        </Card>
      )}

      <div className="grid-2">
        {/* SECTION 2: Mistake Taxonomy (Execution vs Knowledge) */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Activity color="var(--accent-blue)" size={18} />
            Root Cause Breakdown
          </h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
            Execution mistakes can be recovered through focus training, while knowledge gaps require conceptual study.
          </p>
          <div style={{ height: '180px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} />
                <Bar dataKey="marks" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
            {chartData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
                    {item.name}: {item.marks} marks lost
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Highest ROI Chapters (Marks Lost) */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
            Highest ROI Chapters (Marks Lost)
          </h3>
          {result.chapterLoss?.length > 0 ? (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chapterLoss} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="chapter" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} />
                  <Bar dataKey="marksLost" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No marks lost mapping found.</p>
          )}
        </Card>
      </div>

      {/* SECTION 3: Interactive 3-Day Sprint Plan Checklist */}
      {result.plan?.tasks && (
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles color="var(--accent-cyan)" size={20} />
            {result.plan.title || 'Recovery Sprint Plan'}
          </h3>
          
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
            Tackle these concepts with the AI tutor to recover your lost marks. Check them off as you complete them.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {result.plan.tasks.map((task: any, idx: number) => {
              const isChecked = completedTasks[idx] || false;
              return (
                <div 
                  key={idx} 
                  style={{ 
                    padding: 'var(--sp-4)', 
                    borderRadius: 'var(--radius-md)', 
                    background: isChecked ? 'rgba(6, 214, 160, 0.05)' : 'var(--bg-tertiary)', 
                    border: isChecked ? '1px solid var(--success-dim)' : '1px solid var(--border-default)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    gap: 'var(--sp-4)',
                    transition: 'all 0.2s ease-in-out',
                    opacity: isChecked ? 0.75 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                    {/* Interactive Checkbox */}
                    <button 
                      onClick={() => toggleTask(idx)}
                      style={{ 
                        background: isChecked ? 'var(--success)' : 'transparent',
                        border: isChecked ? 'var(--success)' : '2px solid var(--text-secondary)',
                        borderRadius: '4px',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isChecked && <CheckCircle2 size={14} color="var(--bg-primary)" />}
                    </button>

                    <div>
                      <div style={{ 
                        color: isChecked ? 'var(--text-secondary)' : 'var(--accent-cyan)', 
                        fontSize: 'var(--fs-xs)', 
                        fontWeight: 'var(--fw-bold)', 
                        textTransform: 'uppercase', 
                        letterSpacing: 'var(--ls-wide)', 
                        marginBottom: 'var(--sp-1)',
                        textDecoration: isChecked ? 'line-through' : 'none'
                      }}>
                        Day {task.day} • {task.subject}
                      </div>
                      <div style={{ 
                        color: isChecked ? 'var(--text-secondary)' : 'var(--text-primary)', 
                        fontWeight: 'var(--fw-medium)', 
                        fontSize: 'var(--fs-sm)',
                        textDecoration: isChecked ? 'line-through' : 'none'
                      }}>
                        {task.action}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <div style={{ 
                      color: 'var(--success)', 
                      fontWeight: 'var(--fw-bold)', 
                      fontSize: 'var(--fs-md)', 
                      whiteSpace: 'nowrap', 
                      background: 'var(--success-dim)', 
                      padding: 'var(--sp-1) var(--sp-3)', 
                      borderRadius: 'var(--radius-full)' 
                    }}>
                      +{task.marksGain} marks
                    </div>
                    
                    {/* Tackle with AI Tutor button */}
                    <button 
                      onClick={() => handleTackleInTutor(task)}
                      disabled={isChecked}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--sp-2)',
                        cursor: isChecked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-primary)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.borderColor = 'var(--accent-blue)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'var(--border-default)';
                        }
                      }}
                    >
                      <MessageCircle size={16} color="var(--accent-blue)" />
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)' }}>Ask AI Tutor</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
