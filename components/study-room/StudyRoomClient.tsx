'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CopyPlus,
  FileSearch,
  HelpCircle,
  ListChecks,
  RotateCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { useAppStore } from '@/stores/appStore';
import { materialStudyStats } from '@/lib/materials/study-room-analysis';

const ACTIONS = [
  { label: 'Teach this', icon: BookOpen, prompt: (topic: string) => `Teach this topic: ${topic}.` },
  { label: 'Quiz me', icon: ListChecks, prompt: (topic: string) => `Quiz me on ${topic}. Ask one question at a time and check my answer.` },
  { label: 'Solve a doubt', icon: HelpCircle, prompt: (topic: string) => `Help me solve a doubt in ${topic}.` },
  { label: 'Generate similar questions', icon: CopyPlus, prompt: (topic: string) => `Generate similar questions for ${topic} using the style of my uploaded question bank if available.` },
  { label: 'Revise key points', icon: RotateCw, prompt: (topic: string) => `Revise the key points for ${topic}.` },
  { label: 'Find weak areas', icon: Search, prompt: (topic: string) => `Find my weak areas in ${topic}.` },
  { label: 'Explain from source', icon: FileSearch, prompt: (topic: string) => `Explain ${topic} from my uploaded material.` },
  { label: 'Ask harder questions', icon: TrendingUp, prompt: (topic: string) => `Ask harder questions on ${topic}.` },
];

type StudyRoomClientProps = {
  materials: any[];
  weakAreas: any[];
  initialMaterialId?: string | null;
};

export function StudyRoomClient({ materials, weakAreas, initialMaterialId }: StudyRoomClientProps) {
  const selectedMaterialIds = useAppStore((state) => state.selectedMaterialIds);
  const setSelectedMaterialIds = useAppStore((state) => state.setSelectedMaterialIds);
  const toggleSelectedMaterial = useAppStore((state) => state.toggleSelectedMaterial);
  const readyMaterials = useMemo(() => materials.filter((material) => material.status === 'ready'), [materials]);
  const fallbackMaterial = readyMaterials[0] ?? materials[0] ?? null;
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(initialMaterialId || fallbackMaterial?.id || null);

  const currentMaterial = useMemo(
    () => materials.find((material) => material.id === currentMaterialId) ?? fallbackMaterial,
    [materials, currentMaterialId, fallbackMaterial]
  );

  const currentStats = materialStudyStats(currentMaterial);
  const topics = currentStats.topics.length > 0
    ? currentStats.topics
    : [currentMaterial?.topic, currentMaterial?.chapter, currentMaterial?.subject].filter(Boolean).map(String);
  const [currentTopic, setCurrentTopic] = useState(topics[0] || 'this material');

  useEffect(() => {
    if (!currentMaterial?.id || currentMaterial.status !== 'ready') return;
    if (!selectedMaterialIds.includes(currentMaterial.id)) {
      setSelectedMaterialIds([currentMaterial.id, ...selectedMaterialIds].slice(0, 4));
    }
  }, [currentMaterial?.id, currentMaterial?.status, selectedMaterialIds, setSelectedMaterialIds]);

  useEffect(() => {
    setCurrentTopic(topics[0] || 'this material');
  }, [currentMaterial?.id]);

  function sendAction(prompt: string) {
    window.dispatchEvent(new CustomEvent('study-room:send-prompt', {
      detail: { message: prompt },
    }));
  }

  return (
    <main
      style={{
        display: 'grid',
        gridTemplateColumns: '280px minmax(420px, 1fr) 300px',
        gap: 'var(--sp-4)',
        minHeight: 'calc(100vh - var(--header-height))',
        padding: 'var(--sp-4)',
        width: '100%',
      }}
    >
      <aside style={panelStyle}>
        <PanelHeader eyebrow="Materials" title="Library" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflowY: 'auto' }}>
          {materials.length === 0 ? (
            <EmptyPanel text="No uploaded material yet." />
          ) : materials.map((material) => {
            const stats = materialStudyStats(material);
            const selected = selectedMaterialIds.includes(material.id);
            const active = currentMaterial?.id === material.id;
            return (
              <button
                key={material.id}
                onClick={() => {
                  setCurrentMaterialId(material.id);
                  if (material.status === 'ready' && !selected) toggleSelectedMaterial(material.id);
                }}
                style={{
                  ...rowButtonStyle,
                  borderColor: active ? 'var(--accent-blue)' : 'var(--border-subtle)',
                  background: active ? 'var(--accent-blue-dim)' : 'var(--bg-secondary)',
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {material.original_filename || material.title}
                  </strong>
                  {material.status === 'ready' && (
                    <input
                      aria-label="Select material"
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleSelectedMaterial(material.id);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      style={{ accentColor: 'var(--accent-blue)', flexShrink: 0 }}
                    />
                  )}
                </span>
                <span style={mutedStyle}>
                  {stats.sourceType.replaceAll('_', ' ')} · {stats.counts.questions} questions · {stats.counts.formulas} formulas
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-3)' }}>
          <PanelHeader eyebrow="Topics" title="Current Focus" compact />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {topics.length === 0 ? (
              <EmptyPanel text="Topics will appear after extraction." />
            ) : topics.slice(0, 10).map((topic) => (
              <button
                key={topic}
                onClick={() => setCurrentTopic(topic)}
                style={{
                  ...topicButtonStyle,
                  background: currentTopic === topic ? 'var(--accent-cyan-dim)' : 'transparent',
                  color: currentTopic === topic ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'var(--bg-elevated)',
          minHeight: 0,
        }}
      >
        <GlobalChat
          tutorSurface
          embedded
          titleSuffix="Study Room"
          currentMaterialId={currentMaterial?.id ?? null}
          currentTopic={currentTopic}
          quickPrompts={ACTIONS.map((action) => action.label)}
        />
      </section>

      <aside style={panelStyle}>
        <PanelHeader eyebrow="Now Studying" title={currentMaterial?.original_filename || currentMaterial?.title || 'No material'} />
        {currentMaterial ? (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Badge color={currentMaterial.status === 'ready' ? 'cyan' : 'yellow'}>{currentMaterial.status}</Badge>
            <Badge color="gray">{currentStats.sourceType.replaceAll('_', ' ')}</Badge>
          </div>
        ) : null}

        <section style={sectionBlockStyle}>
          <h3 style={sectionTitleStyle}>Source snippets</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topics.slice(0, 4).map((topic) => (
              <div key={topic} style={snippetStyle}>{topic}</div>
            ))}
            {topics.length === 0 && <EmptyPanel text="No snippets yet." />}
          </div>
        </section>

        <section style={sectionBlockStyle}>
          <h3 style={sectionTitleStyle}>Weak areas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weakAreas.length === 0 ? (
              <EmptyPanel text="None active." />
            ) : weakAreas.slice(0, 5).map((area) => (
              <div key={area.id} style={snippetStyle}>
                <strong>{area.weakness_description || area.concept_tag || 'Weak area'}</strong>
                <span style={mutedStyle}>{area.repair_suggestion || area.recommended_action || 'Targeted repair question'}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={sectionBlockStyle}>
          <h3 style={sectionTitleStyle}>Actions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => sendAction(action.prompt(currentTopic || 'this material'))}
                  style={actionButtonStyle}
                >
                  <Icon size={15} />
                  {action.label}
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </main>
  );
}

function PanelHeader({ eyebrow, title, compact = false }: { eyebrow: string; title: string; compact?: boolean }) {
  return (
    <div style={{ marginBottom: compact ? 'var(--sp-2)' : 'var(--sp-3)' }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
        {eyebrow}
      </div>
      <h2 style={{ margin: 0, fontSize: compact ? 'var(--fs-base)' : 'var(--fs-lg)', fontWeight: 900, letterSpacing: 0 }}>
        {title}
      </h2>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p style={{ ...mutedStyle, margin: 0 }}>{text}</p>;
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--sp-4)',
  minHeight: 0,
  overflow: 'hidden',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)',
  padding: 'var(--sp-4)',
};

const rowButtonStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  textAlign: 'left',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--sp-3)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const topicButtonStyle: CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 10px',
  fontSize: 'var(--fs-sm)',
  textAlign: 'left',
  cursor: 'pointer',
};

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 36,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  padding: '0 var(--sp-3)',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 'var(--fs-sm)',
};

const sectionBlockStyle: CSSProperties = {
  borderTop: '1px solid var(--border-subtle)',
  paddingTop: 'var(--sp-3)',
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 var(--sp-2)',
  fontSize: 'var(--fs-sm)',
  fontWeight: 900,
};

const snippetStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-tertiary)',
  padding: 'var(--sp-3)',
  fontSize: 'var(--fs-sm)',
  lineHeight: 1.4,
};

const mutedStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--fs-xs)',
  lineHeight: 1.4,
};
