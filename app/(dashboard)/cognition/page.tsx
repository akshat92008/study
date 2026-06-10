'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { Brain, Search, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function AtlasPage() {
  const [masteryData, setMasteryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [conceptDetails, setConceptDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { addToast } = useAppStore();

  useEffect(() => {
    fetch('/api/atlas/mastery')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setMasteryData(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const openConceptDetails = async (conceptId: string) => {
    setSelectedConcept(conceptId);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/atlas/mastery/${conceptId}`);
      const data = await res.json();
      if (!data.error) {
        setConceptDetails(data);
      }
    } catch (e) {
      addToast('Failed to load concept details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCorrection = async (conceptId: string, action: string) => {
    try {
      const res = await fetch(`/api/atlas/mastery/${conceptId}/correct`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        addToast('Concept status updated', 'success');
        openConceptDetails(conceptId);
      } else {
        addToast('Failed to update concept', 'error');
      }
    } catch (e) {
      addToast('Failed to update concept', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <Skeleton width="200px" height="40px" />
        <Skeleton width="100%" height="200px" />
        <Skeleton width="100%" height="400px" />
      </div>
    );
  }

  if (!masteryData || !masteryData.subjects) {
    return (
      <div style={{ padding: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'bold', marginBottom: 'var(--sp-4)' }}>ATLAS: Knowledge Engine</h1>
        <Card>
          <CardContent style={{ padding: 'var(--sp-10)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Brain size={48} style={{ margin: '0 auto var(--sp-4) auto', opacity: 0.2 }} />
            <p>No knowledge graph data found.</p>
            <p style={{ fontSize: 'var(--fs-sm)' }}>Start taking sessions to build your knowledge graph.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)', maxWidth: '80rem', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'bold', letterSpacing: '-0.02em' }}>ATLAS Knowledge Graph</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>
          Your evolving cognitive model. ATLAS continuously tracks what you know, what you've forgotten, and what needs review.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-6)' }}>
        <Card>
          <CardHeader>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>Syllabus Completion</p>
            <CardTitle style={{ fontSize: 'var(--fs-4xl)', marginTop: 'var(--sp-2)' }}>{masteryData.overallPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              {masteryData.coveredChapters} / {masteryData.totalChapters} chapters covered
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <AlertCircle size={16} /> Top Weakness
            </p>
            <CardTitle style={{ fontSize: 'var(--fs-lg)', marginTop: 'var(--sp-2)' }}>Analyzing...</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Based on recent mistakes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <TrendingUp size={16} /> Gaining Mastery
            </p>
            <CardTitle style={{ fontSize: 'var(--fs-lg)', marginTop: 'var(--sp-2)' }}>Analyzing...</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Based on recent practice</p>
          </CardContent>
        </Card>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>Subject Mastery</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--sp-6)' }}>
          {masteryData.subjects.map((subject: any) => (
            <Card key={subject.subject}>
              <CardHeader>
                <CardTitle style={{ textTransform: 'capitalize' }}>{subject.subject}</CardTitle>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  {subject.masteryPct}% Mastered • {subject.totalChapters} Chapters
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <div style={{ height: '8px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div 
                      style={{ height: '100%', background: 'var(--accent-purple)', width: `${subject.masteryPct}%` }}
                    />
                  </div>
                  
                  <div style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    <h4 style={{ fontWeight: 500, margin: 0 }}>Chapter Breakdown</h4>
                    <div style={{ maxHeight: '12rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', paddingRight: 'var(--sp-2)' }}>
                      {subject.chapters.map((chapter: any) => (
                        <div key={chapter.chapter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-2)' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 'var(--sp-4)' }} title={chapter.chapter}>{chapter.chapter}</span>
                          <Badge color={chapter.pct > 70 ? 'green' : chapter.pct > 30 ? 'yellow' : 'red'}>
                            {chapter.pct}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Modal isOpen={!!selectedConcept} onClose={() => setSelectedConcept(null)} title="Concept Explainability">
        {detailsLoading ? (
          <div style={{ padding: 'var(--sp-8)', textAlign: 'center' }}><Skeleton width="100%" height="128px" /></div>
        ) : conceptDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            <div>
              <h3 style={{ fontWeight: 'bold', fontSize: 'var(--fs-lg)', margin: 0 }}>{conceptDetails.concept.name}</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {conceptDetails.concept.subject} &gt; {conceptDetails.concept.chapter}
              </p>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                <Badge color="blue">{conceptDetails.concept.mastery}</Badge>
                <Badge color="gray">Confidence: {conceptDetails.explainability.confidence}</Badge>
              </div>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>Why this?</h4>
              <p style={{ fontSize: 'var(--fs-sm)', background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', margin: 0 }}>
                {conceptDetails.explainability.lastUpdateReason}
              </p>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>Recent Evidence ({conceptDetails.explainability.totalEvents} total)</h4>
              <div style={{ maxHeight: '12rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {conceptDetails.explainability.recentEvidence.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>No recent events.</p>
                ) : (
                  conceptDetails.explainability.recentEvidence.map((evt: any) => (
                    <div key={evt.id} style={{ fontSize: 'var(--fs-xs)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: 'var(--sp-2)', borderRadius: 'var(--radius-sm)' }}>
                      <span>{new Date(evt.created_at).toLocaleDateString()} - {evt.evidence_type || evt.source}</span>
                      <span style={{ fontFamily: 'monospace' }}>{evt.old_mastery} → {evt.new_mastery}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <h4 style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', margin: 0 }}>Correct ATLAS</h4>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: 0 }}>If you believe this assessment is incorrect, you can override it. This creates an auditable event.</p>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <Button size="sm" onClick={() => handleCorrection(selectedConcept, 'mark_known')} variant="secondary">
                  <CheckCircle2 size={16} style={{ marginRight: '8px' }} /> Mark as Known
                </Button>
                <Button size="sm" onClick={() => handleCorrection(selectedConcept, 'reset')} variant="secondary">
                  Reset Progress
                </Button>
                <Button size="sm" onClick={() => handleCorrection(selectedConcept, 'mark_irrelevant')} variant="secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  Mark Irrelevant
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>Failed to load details</div>
        )}
      </Modal>
    </div>
  );
}
