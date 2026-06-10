'use client';

import React from 'react';
import { X, Headphones, FileText, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface SourceDashboardModalProps {
  material: any;
  onClose: () => void;
}

export default function SourceDashboardModal({ material, onClose }: SourceDashboardModalProps) {
  if (!material) return null;

  const briefingDoc = material.briefing_doc || {};
  const podcastTranscript = material.podcast_transcript || [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-primary)', width: '100%', maxWidth: 800, maxHeight: '90vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold' }}>Source Deep Dive</h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{material.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 'var(--sp-4)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          
          {/* Briefing Doc */}
          <section>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
              <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
              Briefing Document
            </h3>
            {briefingDoc.executiveSummary ? (
              <Card padding="md" style={{ background: 'var(--bg-tertiary)' }}>
                <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: 'var(--sp-2)' }}>Executive Summary</h4>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {briefingDoc.executiveSummary}
                </p>

                {briefingDoc.keyEntities && briefingDoc.keyEntities.length > 0 && (
                  <div style={{ marginTop: 'var(--sp-4)' }}>
                    <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: 'var(--sp-2)' }}>Key Entities</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                      {briefingDoc.keyEntities.map((entity: string, i: number) => (
                        <Badge key={i} color="blue">{entity}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {briefingDoc.faqs && briefingDoc.faqs.length > 0 && (
                  <div style={{ marginTop: 'var(--sp-4)' }}>
                    <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: 'var(--sp-2)' }}>FAQs</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      {briefingDoc.faqs.map((faq: any, i: number) => (
                        <div key={i}>
                          <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <ChevronRight size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--accent-cyan)' }} />
                            {faq.question}
                          </p>
                          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginLeft: 20, marginTop: 4 }}>
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Briefing document is not available.</p>
            )}
          </section>

          {/* Podcast Transcript */}
          <section>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
              <Headphones size={18} style={{ color: 'var(--accent-purple)' }} />
              Podcast Transcript
            </h3>
            {podcastTranscript.length > 0 ? (
              <Card padding="md" style={{ background: 'var(--bg-tertiary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {podcastTranscript.map((turn: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: 'var(--fs-xs)', 
                        color: turn.speaker === 'Host 1' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                        width: 60,
                        flexShrink: 0,
                        textAlign: 'right'
                      }}>
                        {turn.speaker}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {turn.text}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Podcast transcript is not available.</p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
