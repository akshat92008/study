// components/tutor/TutorChat.tsx
'use client';

import { useMemo } from 'react';
import { BookOpenCheck, ClipboardCheck, FileText, Target, TrendingUp } from 'lucide-react';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { useAppStore } from '@/stores/appStore';

function formatLabel(value: unknown, fallback = 'Not set') {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getWeakAreaLabel(weakArea: any) {
  if (!weakArea) return null;
  if (typeof weakArea === 'string') return formatLabel(weakArea);
  const displayPath = Array.isArray(weakArea.displayPath) ? weakArea.displayPath.filter(Boolean) : [];
  if (displayPath.length > 0) return displayPath.map((item: string) => formatLabel(item)).join(' > ');
  return formatLabel(weakArea.concept_tag || weakArea.conceptTag || weakArea.topicSlug || weakArea.chapterSlug || null, '');
}

function TutorStateRail() {
  const activeGoalId = useAppStore((state) => state.activeGoalId);
  const learningGoals = useAppStore((state) => state.learningGoals);
  const chatMessages = useAppStore((state) => state.chatMessages);

  const activeGoal = useMemo(
    () => learningGoals.find((goal) => goal.id === activeGoalId) || null,
    [activeGoalId, learningGoals]
  );

  const tutorMetadata = useMemo(() => {
    return chatMessages
      .slice()
      .reverse()
      .find((message) => message.role === 'assistant' && message.metadata?.tutorMode)?.metadata ?? null;
  }, [chatMessages]);

  const evaluation = tutorMetadata?.evaluation as any;
  const question = tutorMetadata?.question as any;
  const weakAreas = Array.isArray(tutorMetadata?.weakAreas) ? tutorMetadata.weakAreas : [];
  const counts = activeGoal?.counts ?? {};
  const masteryLabel = evaluation
    ? `${Math.round(Number(evaluation.numericScore ?? 0) * 100)}% on last answer`
    : `${Math.round(Number(activeGoal?.progress ?? 0))}% goal progress`;
  const modeLabel = evaluation
    ? evaluation.nextAction === 'advance'
      ? 'Practice'
      : evaluation.nextAction === 'repair'
        ? 'Review'
        : 'Diagnose'
    : tutorMetadata?.tutorMode === 'provider'
      ? 'Explain'
      : 'Diagnose';
  const nextAction = evaluation
    ? evaluation.nextAction === 'advance'
      ? 'Answer one more check question, then advance.'
      : evaluation.nextAction === 'repair'
        ? 'Repair the missing points before moving on.'
        : 'Repeat the concept with a smaller prompt.'
    : 'Start with an explanation or diagnostic question.';

  const railItems = [
    { label: 'Goal', value: activeGoal?.title ?? 'Create or select a goal' },
    { label: 'Chapter', value: formatLabel(tutorMetadata?.chapterSlug ?? activeGoal?.metadata?.chapterSlug ?? activeGoal?.preset_id) },
    { label: 'Topic', value: formatLabel(tutorMetadata?.topicSlug ?? activeGoal?.metadata?.topicSlug, 'Next mapped topic') },
    { label: 'Mode', value: modeLabel },
  ];

  return (
    <aside className="hidden md:flex w-[360px] flex-shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="border-b border-[var(--border-subtle)] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-[var(--text-tertiary)]">
          <Target size={15} />
          Tutor Loop
        </div>
        <div className="mt-3 space-y-2">
          {railItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[var(--text-tertiary)]">{item.label}</span>
              <span className="max-w-[210px] text-right font-medium text-[var(--text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
        {[
          ['Weak', counts.weakConcepts ?? weakAreas.length ?? 0],
          ['Cards', counts.dueCards ?? 0],
          ['Mistakes', counts.recentMistakes ?? 0],
          ['Sources', counts.sourcesReady ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--bg-elevated)] p-3">
            <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4 p-4 text-sm">
        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <TrendingUp size={15} />
            Progress
          </div>
          <div className="h-2 overflow-hidden rounded bg-[var(--bg-secondary)]">
            <div
              className="h-full bg-[var(--accent-purple)] transition-all"
              style={{ width: `${Math.max(4, Math.min(100, evaluation ? Number(evaluation.numericScore ?? 0) * 100 : Number(activeGoal?.progress ?? 0)))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">{masteryLabel}</p>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <ClipboardCheck size={15} />
            Weak Areas
          </div>
          <div className="space-y-2">
            {(weakAreas.length > 0 ? weakAreas.slice(0, 3) : [null]).map((weakArea: any, index: number) => (
              <div key={index} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                {getWeakAreaLabel(weakArea) || 'None detected yet'}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <BookOpenCheck size={15} />
            Next Action
          </div>
          <p className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {nextAction}
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <FileText size={15} />
            Practice Question
          </div>
          <p className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {question?.question ?? 'Ask for a diagnostic question to begin.'}
          </p>
        </section>

        <section className="text-xs text-[var(--text-tertiary)]">
          Source references: {tutorMetadata?.ragGrounded ? 'grounded in selected material' : (counts.sourcesReady ?? 0) > 0 ? 'available when requested' : 'no ready source selected'}
        </section>
      </div>
    </aside>
  );
}

export default function TutorChat() {
  return (
    <div className="flex flex-col md:flex-row gap-[var(--sp-4)] h-full">
      <div className="flex-1 min-h-0 h-full">
        <GlobalChat endpoint="/api/ai/tutor" tutorSurface titleSuffix="Tutor" />
      </div>
      <TutorStateRail />
    </div>
  );
}
