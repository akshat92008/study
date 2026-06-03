'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Share2, Download, TrendingUp, Target } from 'lucide-react';

interface ShareCardProps {
  testName: string;
  currentScore: number;
  potentialScore: number;
  recoverableMarks: number;
  mentorQuote: string;
  examType: string;
}

export default function ShareCard({
  testName, currentScore, potentialScore, recoverableMarks, mentorQuote, examType,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const shareText = `🧠 ${examType} Mistake Review by Cognition OS\n\n📊 Score: ${currentScore}\n🎯 Potential: ${potentialScore}\n💚 Recoverable: +${recoverableMarks} marks\n\n"${mentorQuote}"\n\n#CognitionOS #${examType}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Mistake Review — Cognition OS', text: shareText });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert('Copied to clipboard!');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}
    >
      {/* The Card */}
      <div
        ref={cardRef}
        style={{
          background: 'linear-gradient(145deg, hsl(225, 25%, 8%) 0%, hsl(265, 30%, 12%) 50%, hsl(220, 35%, 10%) 100%)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid hsl(265, 40%, 25%)',
          padding: 'var(--sp-8)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          borderRadius: '50%', background: 'hsla(265, 80%, 60%, 0.08)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
          borderRadius: '50%', background: 'hsla(185, 80%, 50%, 0.06)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 'var(--sp-6)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-purple)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)' }}>
                Mock Mistake Review
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {testName}
              </div>
            </div>
            <div style={{
              padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-full)',
              background: 'var(--accent-purple)', color: 'white',
              fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)',
            }}>
              {examType}
            </div>
          </div>

          {/* Score Bridge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--sp-6)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>
                Current
              </div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)' }}>
                {currentScore}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-1)' }}>
              <TrendingUp size={20} style={{ color: 'var(--success)' }} />
              <div style={{
                padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-full)',
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-black)',
              }}>
                +{recoverableMarks}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>
                Potential
              </div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-cyan)' }}>
                {potentialScore}
              </div>
            </div>
          </div>

          {/* Mentor Quote */}
          <div style={{
            padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)',
            background: 'hsla(0, 0%, 100%, 0.03)', border: '1px solid hsla(0, 0%, 100%, 0.06)',
            marginBottom: 'var(--sp-6)',
          }}>
            <p style={{
              fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
              fontStyle: 'italic', lineHeight: 'var(--lh-relaxed)',
            }}>
              &ldquo;{mentorQuote}&rdquo;
            </p>
          </div>

          {/* Footer branding */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Target size={14} style={{ color: 'var(--accent-purple)' }} />
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)' }}>
                Cognition OS
              </span>
            </div>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              cognition.os
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        <button
          onClick={handleShare}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)',
            padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'var(--text-inverse)',
            border: 'none', cursor: 'pointer', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-sm)',
          }}
        >
          <Share2 size={16} /> Share Result
        </button>
      </div>
    </motion.div>
  );
}
