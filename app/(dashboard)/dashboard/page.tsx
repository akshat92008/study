'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  Brain, RefreshCw, Loader2, Upload, X, Activity
} from 'lucide-react';
import CognitionDashboard from '@/components/cognition/CognitionDashboard';
import RevisionQueue from '@/components/revision/RevisionQueue';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CurrentTaskCard from '@/components/dashboard/CurrentTaskCard';

export default function DashboardPage() {
  const {
    activeGoalId,
    learningGoals,
    activeDrawer,
    setActiveDrawer,
    autopsyResult,
    setAutopsyResult,
    isUploadingMock,
    setIsUploadingMock,
    uploadStatus,
    setUploadStatus,
    addToast,
    addChatMessage
  } = useAppStore();

  const handleStartSession = (topic: string, subject: string) => {
    addChatMessage({
      role: 'user',
      content: `Let's start a Socratic tutoring session on "${topic}" (${subject}).`,
      timestamp: new Date().toISOString()
    });
    addToast(`Session started: ${topic}`, 'success');
  };

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [masteryData, setMasteryData] = useState<any>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);

  // Local state for the drawer upload mechanism
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  // 1. Initial Data Loading
  const loadTelemetry = async () => {
    try {
      const [resDash, resMastery] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/atlas/mastery')
      ]);
      if (resDash.ok) {
        const data = await resDash.json();
        setDashboardData(data);
      }
      if (resMastery.ok) {
        const mData = await resMastery.json();
        setMasteryData(mData);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const loadAutopsy = async () => {
    try {
      const res = await fetch('/api/autopsy');
      if (res.ok) {
        const data = await res.json();
        setAutopsyResult(data.result);
      }
    } catch (e) {
      console.error('Failed to load autopsy data', e);
    }
  };

  useEffect(() => {
    loadTelemetry();
    loadAutopsy();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('magic') === 'true') {
        setActiveDrawer('cognition');
      }
    }
  }, [setActiveDrawer]);

  // 2. Mock Autopsy Ingest within Drawer
  const handleMockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return addToast('Please select a mock paper', 'error');

    setIsUploadingMock(true);
    setUploadStatus('Uploading and running OCR extraction...');

    const statuses = [
      'Extracting answers via Gemini 2.5 Flash...',
      'Mapping incorrect responses to syllabus chapters...',
      'Diagnosing root cognitive failures...',
      'Generating Mentor sprint plan...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < statuses.length) setUploadStatus(statuses[i++]);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('testName', fileToUpload.name);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autopsy failed');

      setAutopsyResult(data);
      addToast('Autopsy completed successfully!', 'success');
      loadTelemetry(); // refresh telemetry
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      clearInterval(interval);
      setIsUploadingMock(false);
      setUploadStatus('');
    }
  };

  // Find active goal title
  const activeGoal = learningGoals.find(g => g.id === activeGoalId);

  // Numeric Stats definitions
  const overallMastery = masteryData?.overallPct ?? dashboardData?.cognition?.stats?.overallMastery ?? dashboardData?.profile?.overall_mastery ?? 0;
  const cardsDue = dashboardData?.revision?.dueCards?.length ?? 0;
  const marksLost = autopsyResult?.recoverableMarks ?? 0;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', minHeight: '100%' }}>
      
      {/* Floating Telemetry Toolbar */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 10
      }}>
        {activeGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)' }} />
            Active Goal: <strong>{activeGoal.title}</strong>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Select or create a learning goal in the sidebar
          </div>
        )}

        {/* Telemetry Pills */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {/* Atlas Pill */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'cognition' ? null : 'cognition')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: activeDrawer === 'cognition' ? 'var(--accent-purple-dim)' : 'var(--bg-secondary)',
              border: `1px solid ${activeDrawer === 'cognition' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
              color: activeDrawer === 'cognition' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Brain size={12} style={{ color: 'var(--accent-purple)' }} />
            <span>ATLAS: {overallMastery}%</span>
          </button>

          {/* Memory Pill */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'revision' ? null : 'revision')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: activeDrawer === 'revision' ? 'var(--accent-blue-dim)' : 'var(--bg-secondary)',
              border: `1px solid ${activeDrawer === 'revision' ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
              color: activeDrawer === 'revision' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={12} style={{ color: 'var(--accent-blue)' }} />
            <span>MEMORY: {cardsDue} due</span>
          </button>

          {/* Autopsy Pill */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'autopsy' ? null : 'autopsy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: activeDrawer === 'autopsy' ? 'var(--danger-glow)' : 'var(--bg-secondary)',
              border: `1px solid ${activeDrawer === 'autopsy' ? 'var(--danger)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
              color: activeDrawer === 'autopsy' ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={12} style={{ color: 'var(--danger)' }} />
            <span>AUTOPSY: -{marksLost} pts</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <CurrentTaskCard />
        
        <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', marginBottom: 'var(--sp-2)' }}>Syllabus Coverage & Mastery</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)' }}>
              Your real-time cognitive metrics are constantly updated as you complete study sessions, practice spaced-repetition flashcards, and run autopsies on mock test failures.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
              <div style={{ flex: '1 1 200px', background: 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Overall Mastery</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-purple)', marginTop: 4 }}>{overallMastery}%</div>
              </div>
              <div style={{ flex: '1 1 200px', background: 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Due Reviews</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)', marginTop: 4 }}>{cardsDue} cards</div>
              </div>
              <div style={{ flex: '1 1 200px', background: 'var(--bg-primary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Autopsy Points Staged</div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--danger)', marginTop: 4 }}>{marksLost} marks</div>
              </div>
            </div>
          </Card>
      </div>

      {/* Backdrop overlay for drawers */}
      {activeDrawer && (
        <div
          onClick={() => setActiveDrawer(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)',
            zIndex: 90, animation: 'var(--animation-fade-in)'
          }}
        />
      )}

      {/* Contextual Drawers */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)', background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)', zIndex: 100,
          transform: activeDrawer ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--duration-normal) var(--ease-out)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {activeDrawer === 'cognition' && (
              <>
                <Brain size={18} style={{ color: 'var(--accent-purple)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>ATLAS: Cognition Graph</span>
              </>
            )}
            {activeDrawer === 'revision' && (
              <>
                <RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>MEMORY: Spaced Repetition Queue</span>
              </>
            )}
            {activeDrawer === 'autopsy' && (
              <>
                <Activity size={18} style={{ color: 'var(--danger)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>AUTOPSY: Mistake Diagnoser</span>
              </>
            )}
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)' }}>
          {/* A. ATLAS / Cognition Graph Drawer */}
          {activeDrawer === 'cognition' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {dashboardData?.cognition ? (
                <CognitionDashboard data={dashboardData.cognition} />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
                  <Loader2 className="animate-spin" color="var(--accent-purple)" size={32} />
                </div>
              )}
            </div>
          )}

          {/* B. MEMORY / Revision Queue Drawer */}
          {activeDrawer === 'revision' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <RevisionQueue />
            </div>
          )}

          {/* C. AUTOPSY / Mock Ingester Drawer */}
          {activeDrawer === 'autopsy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              
              {/* Autopsy Upload State */}
              {!autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <Card
                    padding="lg"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) setFileToUpload(file);
                    }}
                    style={{
                      borderStyle: 'dashed', borderWidth: '2px',
                      borderColor: dragging ? 'var(--accent-cyan)' : 'var(--border-strong)',
                      background: dragging ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', minHeight: '260px', transition: 'all 0.25s'
                    }}
                  >
                    <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-3)' }}>
                      <Upload color="var(--accent-cyan)" size={24} />
                    </div>
                    <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)', marginBottom: '4px' }}>
                      {dragging ? 'Drop to upload' : 'Drag & Drop Mock Paper'}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
                      Support PDF, TXT, MD, or Image up to 10MB
                    </p>

                    <form onSubmit={handleMockUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', maxWidth: '16rem' }}>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,image/*"
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                        style={{
                          width: '100%', padding: '4px var(--sp-2)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)'
                        }}
                      />
                      {fileToUpload && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', textAlign: 'center', background: 'var(--accent-cyan-dim)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', width: '100%' }}>
                          Staged: <strong>{fileToUpload.name}</strong>
                        </div>
                      )}
                      <Button type="submit" disabled={!fileToUpload} size="sm" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)' }}>
                        Run Diagnostic Autopsy
                      </Button>
                    </form>
                  </Card>
                </div>
              )}

              {/* Autopsy Loading State */}
              {isUploadingMock && (
                <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
                  <Loader2 color="var(--accent-cyan)" size={32} className="animate-spin" style={{ marginBottom: 'var(--sp-4)' }} />
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>Extracting Mock Data...</h4>
                  <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>{uploadStatus}</p>
                </Card>
              )}

              {/* Autopsy Results Dashboard */}
              {autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <AutopsyDashboard result={autopsyResult} />
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
                    <Button variant="secondary" size="sm" onClick={() => { setAutopsyResult(null); setFileToUpload(null); }}>
                      Analyze Another Mock Test
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
