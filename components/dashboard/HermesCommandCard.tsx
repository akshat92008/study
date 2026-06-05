'use client';

import { useState } from 'react';
import { Loader2, Send, Sparkles, RotateCcw, BookOpen, Target, AlertCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { HermesCard } from '@/lib/hermes/ui/types';

const QUICK_PROMPTS = [
  'What should I do now?',
  'Create a goal',
  'Generate a quiz',
  'Autopsy a mistake',
  'Show weak areas',
  'Show source status',
];

function CardRenderer({ card }: { card: HermesCard }) {
  if (card.type === 'mission') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <strong>{card.title}</strong>
        {card.tasks.map((task, index) => (
          <div key={task.id ?? index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
            <Target size={14} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{task.title}</span>
            {task.estimatedMinutes ? <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{task.estimatedMinutes}m</span> : null}
          </div>
        ))}
      </div>
    );
  }

  if (card.type === 'source_status') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <strong>Sources</strong>
        {card.sources.length === 0 ? (
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>No sources for this goal yet.</span>
        ) : card.sources.map((source) => (
          <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <BookOpen size={14} style={{ color: source.status === 'ready' ? 'var(--success)' : 'var(--accent-blue)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.title}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>{source.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (card.type === 'roadmap') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <strong>{card.goalTitle}</strong>
        {card.nodes.slice(0, 6).map((node, index) => (
          <div key={node.id ?? index} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {index + 1}. {node.title}
          </div>
        ))}
      </div>
    );
  }

  if (card.type === 'review_queue') {
    return <strong>{card.dueCount} review cards due</strong>;
  }

  if (card.type === 'weak_areas') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong>Weak areas</strong>
        {(card.topics.length ? card.topics : [{ name: 'No weak concepts found' }]).map((topic: any, index: number) => (
          <span key={topic.id ?? index} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {topic.name ?? topic.topic ?? topic.chapter ?? 'Concept'}
          </span>
        ))}
      </div>
    );
  }

  if (card.type === 'clarification') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
        <div>
          <strong>{card.question}</strong>
          {card.suggestions.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {card.suggestions.map((suggestion) => (
                <span key={suggestion} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 6px' }}>{suggestion}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (card.type === 'quiz') {
    return <strong>{card.title} · {card.questions.length} questions</strong>;
  }

  if (card.type === 'flashcards') {
    return <strong>{card.title} · {card.cards.length} cards</strong>;
  }

  if (card.type === 'autopsy') {
    return <strong>{card.title}: {card.diagnosis}</strong>;
  }

  if (card.type === 'progress_summary') {
    return <span>{card.summary}</span>;
  }

  return <span>{card.text}</span>;
}

export default function HermesCommandCard({ goalId }: { goalId?: string | null }) {
  const [message, setMessage] = useState('');
  const [cards, setCards] = useState<HermesCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ costMode?: string; usedLLM?: boolean } | null>(null);

  const sendCommand = async (text: string) => {
    const command = text.trim();
    if (!command || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/hermes/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command, goalId: goalId ?? undefined }),
      });
      const data = await res.json();
      setCards(Array.isArray(data.cards) ? data.cards : []);
      setMeta({ costMode: data.costMode, usedLLM: data.usedLLM });
      if (!res.ok) {
        setCards([{ type: 'text', text: data.message || 'Hermes could not complete that command.' }]);
      }
      window.dispatchEvent(new Event('refresh-dashboard'));
    } catch {
      setCards([{ type: 'text', text: 'Hermes could not connect. Try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Sparkles size={17} style={{ color: 'var(--accent-cyan)' }} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>Hermes</h3>
        </div>
        {meta?.costMode && (
          <span style={{ fontSize: '10px', color: meta.usedLLM ? 'var(--warning)' : 'var(--success)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 6px' }}>
            {meta.costMode}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendCommand(prompt)}
            disabled={loading}
            style={{
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              sendCommand(message);
            }
          }}
          placeholder="Ask Hermes what to do next..."
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            padding: '10px 12px',
            fontSize: 'var(--fs-sm)',
            outline: 'none',
          }}
        />
        <Button onClick={() => sendCommand(message)} disabled={loading || !message.trim()}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
        {cards.length > 0 && (
          <button
            onClick={() => setCards([])}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 6 }}
            title="Clear Hermes cards"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {cards.map((card, index) => (
            <div key={`${card.type}-${index}`} style={{ padding: 'var(--sp-3) 0', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              <CardRenderer card={card} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
