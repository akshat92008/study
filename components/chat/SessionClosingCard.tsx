import React from 'react';
import { CheckCircle2, Flame, TrendingUp, Layers } from 'lucide-react';

interface SessionClosingCardProps {
  closingMessage: string;
  oldMastery?: number;
  newMastery?: number;
  cardsCreated?: number;
  tomorrowFocus?: string;
  streakIncrement?: boolean;
}

/**
 * Strips <artifact ...>...</artifact> tags from a string, returning only the
 * text content outside them. Safety net for when closing message accidentally
 * contains artifact-wrapped content from the AI response fallback.
 */
export function stripArtifactTags(text: string): string {
  if (!text) return '';
  // Remove complete artifact blocks
  let cleaned = text.replace(/<artifact[^>]*>[\s\S]*?<\/artifact>/gi, '').trim();
  // Remove any orphaned opening tags (unclosed artifacts from truncated responses)
  cleaned = cleaned.replace(/<artifact[^>]*>/gi, '').trim();
  // If after stripping, only whitespace remains, return a safe fallback
  if (!cleaned || cleaned.length < 10) return 'Session recorded successfully.';
  return cleaned;
}

export const SessionClosingCard: React.FC<SessionClosingCardProps> = ({
  closingMessage,
  oldMastery,
  newMastery,
  cardsCreated,
  tomorrowFocus,
  streakIncrement = true,
}) => {
  const safeMessage = stripArtifactTags(closingMessage);

  return (
    <div style={{
      background: 'linear-gradient(to bottom right, var(--bg-primary), rgba(20, 184, 166, 0.05))',
      border: '1px solid rgba(20, 184, 166, 0.3)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--sp-4)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      marginTop: 'var(--sp-2)',
      marginBottom: 'var(--sp-2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <CheckCircle2 size={18} color="var(--success)" />
        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>Session Complete</span>
        {streakIncrement && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: '#fb923c', fontSize: '12px', fontWeight: 'bold' }}>
            <Flame size={14} /> +1 Streak
          </div>
        )}
      </div>

      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--sp-4)', whiteSpace: 'pre-wrap' }}>
        {safeMessage}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', fontSize: '12px' }}>
        {(oldMastery !== undefined && newMastery !== undefined) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 'var(--radius-md)' }}>
            <TrendingUp size={14} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>
              Mastery:{' '}
              <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{oldMastery}%</span>
              {' → '}
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{newMastery}%</span>
            </span>
          </div>
        )}

        {cardsCreated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 'var(--radius-md)' }}>
            <Layers size={14} color="var(--accent-purple)" />
            <span style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{cardsCreated}</span> Cards Added
            </span>
          </div>
        ) : null}
      </div>

      {tomorrowFocus && (
        <div style={{ marginTop: 'var(--sp-3)', fontSize: '12px', color: 'var(--text-tertiary)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 'var(--sp-2)' }}>
          <strong>Tomorrow's focus:</strong> {tomorrowFocus}
        </div>
      )}
    </div>
  );
};
